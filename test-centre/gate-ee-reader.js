// Render the exact original question if pre-generated image batches are unavailable.
// The bytes must match the user's supplied original, not merely a similarly named paper.
const documents=new Map();
let pdfjs;
async function load(paper){
 if(!documents.has(paper.id))documents.set(paper.id,(async()=>{
  const res=await fetch(paper.sourceURL,{signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw Error('Source unavailable');
  const bytes=await res.arrayBuffer();
  const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
  if(sha!==paper.sourceSHA256)throw Error('Source differs from supplied paper');
  pdfjs ||= import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs').then(m=>{m.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';return m;});
  return (await pdfjs).getDocument({data:bytes}).promise;
 })().catch(e=>{documents.delete(paper.id);throw e;}));
 return documents.get(paper.id);
}
export async function renderEEQuestion(paper,index){
 const [pageNo,top,bottom]=paper.questions[index].crop;
 const page=await (await load(paper)).getPage(pageNo),scale=2.6;
 const canvas=document.createElement('canvas');canvas.width=Math.ceil(453*scale);canvas.height=Math.ceil((bottom-top)*scale);
 await page.render({canvasContext:canvas.getContext('2d'),viewport:page.getViewport({scale}),transform:[1,0,0,1,-71*scale,-top*scale],background:'white'}).promise;
 const img=new Image();img.alt=paper.name+' '+paper.questions[index].number;img.src=canvas.toDataURL('image/png');return img;
}
