"""Generate the same 8-question WebP JSON batches as the EC archive.
Requires the exact supplied PDFs or their byte-identical official downloads.
Usage: python scripts/import-gate-ee.py [directory containing EE2024.pdf and EE2025.pdf]
"""
import base64, hashlib, io, json, pathlib, sys, urllib.request
import fitz
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'assets/gate-ee'
OUT=ROOT/'test-centre/gate-papers'
INDEX=ROOT/'test-centre/gate-ee-index.json'
current=json.loads(INDEX.read_text())
pending_path=ROOT/'test-centre/gate-ee-pending.json'
pending=json.loads(pending_path.read_text()) if pending_path.exists() else []
papers=list({p['id']:p for p in current+pending}.values())
papers.sort(key=lambda p:p['year'],reverse=True)
generated={}
for paper in papers:
    # Keep existing verified image batches rather than downloading completed papers again.
    if all((OUT/(paper['id']+'-'+str(i)+'.json')).is_file() for i in range(9)):
        continue
    file=SOURCE/(paper['id']+'.pdf')
    if file.is_file():
        data=file.read_bytes()
    else:
        data=None
        for url in paper.get('sourceURLs',[paper['sourceURL']]):
            try:
                req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 GATE practice archive'})
                with urllib.request.urlopen(req,timeout=45) as response:
                    candidate=response.read(20_000_001)
                if hashlib.sha256(candidate).hexdigest()!=paper['sourceSHA256']:
                    raise ValueError('Hash mismatch')
                data=candidate
                print('Verified official source:',url)
                break
            except Exception as exc:
                print('Source failed:',url,str(exc))
        if data is None:
            raise RuntimeError('No exact source available for '+paper['id'])
    if hashlib.sha256(data).hexdigest()!=paper['sourceSHA256']:
        raise ValueError('PDF differs from supplied original: '+paper['id'])
    with fitz.open(stream=data,filetype='pdf') as doc:
        images=[]
        for q in paper['questions']:
            page,top,bottom=q['crop']
            left,right=paper.get('xRange',[71,524])
            pix=doc[page-1].get_pixmap(matrix=fitz.Matrix(2.6,2.6),clip=fitz.Rect(left,top,right,bottom),alpha=False)
            im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
            buf=io.BytesIO();im.save(buf,'WEBP',quality=85,method=4)
            images.append(base64.b64encode(buf.getvalue()).decode())
        assert len(images)==65
        for offset in range(0,len(images),8):
            generated[paper['id']+'-'+str(offset//8)+'.json']=json.dumps(images[offset:offset+8],separators=(',',':'))
OUT.mkdir(parents=True,exist_ok=True)
for name,data in generated.items():
    (OUT/name).write_text(data)
# Publish only after every question batch exists.
for p in papers:
    for i in range(9):
        path=OUT/(p['id']+'-'+str(i)+'.json')
        batch=json.loads(path.read_text())
        assert len(batch)==(1 if i==8 else 8)
        for raw in batch:
            with Image.open(io.BytesIO(base64.b64decode(raw,validate=True))) as picture:
                assert picture.format=='WEBP'
                picture.load()
INDEX.write_text(json.dumps(papers,separators=(',',':')))
print('Generated',len(generated),'batches for',len(papers),'complete papers')
