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
papers=json.loads((ROOT/'test-centre/gate-ee-index.json').read_text())
generated={}
for paper in papers:
    file=SOURCE/(paper['id']+'.pdf')
    if file.is_file():
        data=file.read_bytes()
    else:
        with urllib.request.urlopen(paper['sourceURL'],timeout=60) as response:
            data=response.read(20_000_001)
    if hashlib.sha256(data).hexdigest()!=paper['sourceSHA256']:
        raise ValueError('PDF differs from supplied original: '+paper['id'])
    with fitz.open(stream=data,filetype='pdf') as doc:
        images=[]
        for q in paper['questions']:
            page,top,bottom=q['crop']
            pix=doc[page-1].get_pixmap(matrix=fitz.Matrix(2.6,2.6),clip=fitz.Rect(71,top,524,bottom),alpha=False)
            im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
            buf=io.BytesIO();im.save(buf,'WEBP',quality=85,method=4)
            images.append(base64.b64encode(buf.getvalue()).decode())
        assert len(images)==65
        for offset in range(0,len(images),8):
            generated[paper['id']+'-'+str(offset//8)+'.json']=json.dumps(images[offset:offset+8],separators=(',',':'))
OUT.mkdir(parents=True,exist_ok=True)
for name,data in generated.items():
    (OUT/name).write_text(data)
print('Generated',len(generated),'batches for',len(papers),'complete papers')
