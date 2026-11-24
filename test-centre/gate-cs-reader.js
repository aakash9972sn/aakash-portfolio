// Render one cropped question, not a full PDF viewer.
let pdfjsPromise;
const docs=new Map();
async function getPDF(url){
 if(!pdfjsPromise) pdfjsPromise=import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs').then(m=>{m.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';return m;}).catch(e=>{pdfjsPromise=null;throw e;});
 if(!docs.has(url))docs.set(url,pdfjsPromise.then(m=>m.getDocument(url).promise).catch(e=>{docs.delete(url);throw e;}));
 return docs.get(url);
}
export async function renderCSQuestion(paper,index){
 const [pageNo,top,bottom]=paper.questions[index].crop;
 const doc=await getPDF(paper.sourcePdf),page=await doc.getPage(pageNo),scale=2.3;
 const vp=page.getViewport({scale});
 const x=66,y=top-2,w=470,h=bottom-top+4;
 const canvas=document.createElement('canvas');canvas.width=Math.ceil(w*scale);canvas.height=Math.ceil(h*scale);
 await page.render({canvasContext:canvas.getContext('2d'),viewport:vp,transform:[1,0,0,1,-x*scale,-y*scale],background:'white'}).promise;
 const img=new Image();img.alt=paper.name+' '+paper.questions[index].number+' — question and printed answer choices';img.src=canvas.toDataURL('image/png');return img;
}