'use strict';
/* Read-only proxy for ten publicly available original exam PDFs. No user URL
 * accepted: every source is allowlisted to avoid SSRF and private network fetches.
 * This ensures PDF.js works on GitHub Pages even when the original host has no CORS.
 */
const {Readable}=require('node:stream');
const SOURCES=Object.freeze({
 'cuet-pg-life-sciences-2025':'pyqs/cuet-pg-life-sciences-2025.pdf',
 'cuet-pg-life-sciences-2024':'pyqs/cuet-pg-life-sciences-2024.pdf',
 'cuet-pg-life-sciences-2023-shift2':'pyqs/cuet-pg-life-sciences-2023-english-shift-2.pdf',
 'cuet-pg-life-sciences-2023-shift3':'pyqs/cuet-pg-life-sciences-2023-english-shift-3.pdf',
 'cuet-pg-life-sciences-2022-shift1':'PYQP/CUET-PG-life-science-question-paper-2022-shift-1.pdf',
 'cuet-pg-zoology-2024':'pyqs/cuet-pg-zoology-2024.pdf',
 'cuet-pg-zoology-2023-shift3':'pyqs/cuet-pg-zoology-2023-english-shift-3.pdf',
 'cuet-pg-zoology-2023-shift1':'pyqs/cuet-pg-zoology-2023-english-shift-1.pdf',
 'cuet-pg-zoology-2022':'PYQP/CUET-PG-zoology-question-paper-2022-shift-1.pdf',
 'cucet-life-sciences-2021':'PYQP/CUCET-Life%20Sciences-2021-shift-2-previous-year-paper.pdf'
});
const ORIGIN='https://pathfinderacademy.in/assets/downloads/';
function registerPypPDFRoute(app){
 app.get('/api/pyp-source/:paperId',async(req,res)=>{
  const id=String(req.params.paperId||'');
  if(!Object.prototype.hasOwnProperty.call(SOURCES,id))return res.status(404).json({error:'Unknown paper.'});
  let upstream;
  try{
   upstream=await fetch(ORIGIN+SOURCES[id],{
    redirect:'error',signal:AbortSignal.timeout(25000),
    headers:{Accept:'application/pdf'}
   });
   if(!upstream.ok||!upstream.body)throw Error('Source PDF is unavailable');
   const type=upstream.headers.get('content-type')||'';
   const length=Number(upstream.headers.get('content-length')||0);
   if(length>25*1024*1024)throw Error('Source PDF exceeds safe size');
   // Some publishers send application/octet-stream for PDFs. Check the first
   // bytes instead of trusting MIME headers for security and correct rendering.
   const reader=upstream.body.getReader(),first=await reader.read();
   const magic=first.value&&first.value.length>=5?
    String.fromCharCode(...first.value.subarray(0,5)):'';
   if(magic!=='%PDF-')throw Error('The source response is not a PDF');
   const stream=Readable.fromWeb(new ReadableStream({
    start(controller){controller.enqueue(first.value)},
    async pull(controller){const {done,value}=await reader.read();if(done)controller.close();else controller.enqueue(value)},
    cancel(reason){reader.cancel(reason).catch(()=>{})}
   }));
   let sent=0;
   res.status(200);
   res.setHeader('Content-Type','application/pdf');
   res.setHeader('Content-Disposition','inline; filename="'+id+'.pdf"');
   res.setHeader('Cache-Control','public, max-age=86400');
   stream.on('data',chunk=>{sent+=chunk.length;if(sent>25*1024*1024){stream.destroy(Error('PDF exceeds safe size'))}});
   stream.on('error',()=>{if(!res.headersSent)res.status(502).end();else res.destroy()});
   req.on('close',()=>{if(!res.writableEnded)stream.destroy()});
   stream.pipe(res);
  }catch(error){
   if(!res.headersSent)res.status(502).json({error:'Original PDF proxy unavailable; use the direct source link.'});
  }
 });
}
module.exports={registerPypPDFRoute,SOURCES};
