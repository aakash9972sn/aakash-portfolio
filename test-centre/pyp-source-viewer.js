/* Original PDF page viewer and image-based question practice.
 * Documents are stored only in this browser via IndexedDB, not uploaded.
 */
(function(){
'use strict';
const entries=window.PYPOriginalSourceManifest||[];
const metaById=Object.fromEntries(entries.map(x=>[x.id,x]));
const $=id=>document.getElementById(id);
const DBNAME='tclab.original-papers.v1';
let dbPromise,pdfLibPromise,active,renderSerial=0,renderTask=null,selectedId;
const input=document.createElement('input');input.type='file';input.accept='application/pdf,.pdf';input.multiple=true;input.hidden=true;input.id='pyp-original-file-input';document.body.appendChild(input);
function db(){
 if(dbPromise)return dbPromise;
 dbPromise=new Promise((resolve,reject)=>{
  if(!window.indexedDB)return reject(Error('Browser storage not supported.'));
  const r=indexedDB.open(DBNAME,1);
  r.onupgradeneeded=()=>r.result.createObjectStore('papers',{keyPath:'id'});
  r.onsuccess=()=>resolve(r.result);
  r.onerror=()=>reject(r.error);
 });return dbPromise;
}
async function read(id){
 const d=await db();
 return new Promise((resolve,reject)=>{
  const r=d.transaction('papers','readonly').objectStore('papers').get(id);
  r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);
 });
}
async function write(item){
 const d=await db();
 return new Promise((resolve,reject)=>{
  const tx=d.transaction('papers','readwrite');
  tx.objectStore('papers').put(item);
  tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);
 });
}
function pdfjs(){
 if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
 if(pdfLibPromise)return pdfLibPromise;
 pdfLibPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
  script.onload=()=>{
   if(!window.pdfjsLib)return reject(Error('PDF reader did not start.'));
   window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
   resolve(window.pdfjsLib);
  };
  script.onerror=()=>reject(Error('PDF reader could not load. Check your connection.'));
  document.head.appendChild(script);
 }).catch(e=>{pdfLibPromise=null;throw e});
 return pdfLibPromise;
}
function dialog(){
 let d=$('pyp-original-dialog');if(d)return d;
 d=document.createElement('dialog');d.id='pyp-original-dialog';d.className='pyp-original-dialog';
 d.innerHTML=[
  '<header class="pyp-source-head"><div><small>ORIGINAL IMAGE-BASED PAPER</small><h2 id="pyp-source-name"></h2></div><button type="button" id="pyp-source-close" aria-label="Close original PDF">×</button></header>',
  '<p class="pyp-source-warning">Source PDFs are kept only on your device. Uploaded question keys are not independently verified.</p>',
  '<div class="pyp-source-toolbar"><button id="pyp-source-attach" type="button">Choose / replace original PDF</button><small id="pyp-source-filename"></small></div>',
  '<p id="pyp-source-message" role="status"></p>',
  '<div id="pyp-source-content" hidden>',
  '<nav class="pyp-source-navigation" aria-label="Question navigation"><button id="pyp-source-prev-q" type="button">← Question</button><b id="pyp-source-question"></b><button id="pyp-source-next-q" type="button">Question →</button></nav>',
  '<nav class="pyp-source-navigation" aria-label="PDF page navigation"><button id="pyp-source-prev-page" type="button">← Page</button><b id="pyp-source-page"></b><button id="pyp-source-next-page" type="button">Page →</button></nav>',
  '<p id="pyp-source-page-hint" class="pyp-source-hint"></p><div class="pyp-source-canvas-box"><canvas id="pyp-source-canvas"></canvas></div>',
  '<section id="pyp-source-answer-panel" class="pyp-source-answer-panel"><h3>Unscored practice answer</h3><p>No verified answer key is included for this paper. Select an option to save your practice response locally; marks will not be calculated.</p><div id="pyp-source-choices"></div><small id="pyp-source-progress"></small></section>',
  '</div>'
 ].join('');
 document.body.appendChild(d);
 $('pyp-source-close').addEventListener('click',()=>d.close());
 $('pyp-source-attach').addEventListener('click',()=>{selectedId=active?.id;input.click()});
 $('pyp-source-prev-q').addEventListener('click',()=>setQuestion(active.q-1));
 $('pyp-source-next-q').addEventListener('click',()=>setQuestion(active.q+1));
 $('pyp-source-prev-page').addEventListener('click',()=>setPage(active.page-1));
 $('pyp-source-next-page').addEventListener('click',()=>setPage(active.page+1));
 d.addEventListener('close',()=>{renderSerial++;if(renderTask){try{renderTask.cancel()}catch{}renderTask=null}});
 return d;
}
function message(text,error){
 const e=$('pyp-source-message');if(e){e.textContent=text;e.classList.toggle('is-error',!!error)}
}
async function open(id,q=1){
 const meta=metaById[id];if(!meta)return;
 const d=dialog();if(!d.open)d.showModal();
 const old=active,keep=old?.id===id?old.pdf:null;
 if(old?.pdf&&old.id!==id)old.pdf.destroy().catch(()=>{});
 active={id,meta,q:Math.max(1,Math.min(meta.count,Number(q)||1)),pdf:keep,page:1};
 $('pyp-source-name').textContent=meta.title;
 $('pyp-source-content').hidden=true;
 $('pyp-source-filename').textContent='';
 message('Checking whether this original PDF is saved on this device…');
 try{
  const saved=await read(id);
  if(active.id!==id)return;
  if(!saved){
   message('Choose '+meta.file+' on your device once. The ChatGPT attachment is not automatically available to the website.');
   return;
  }
  $('pyp-source-filename').textContent=saved.name+' · saved locally';
  if(!keep){
   const lib=await pdfjs();
   const pdf=await lib.getDocument({data:new Uint8Array(await saved.blob.arrayBuffer())}).promise;
   if(pdf.numPages!==meta.totalPages)throw Error('This PDF has '+pdf.numPages+' pages, expected '+meta.totalPages+'. Choose the correct original.');
   active.pdf=pdf;
  }
  if(active.id!==id)return;
  $('pyp-source-content').hidden=false;
  $('pyp-source-answer-panel').hidden=Boolean(meta.test);
  message(meta.test?'This is the original source for an existing scored Test Centre paper. Answer questions using the regular test screen.':'Image-based unscored practice. No verified key or marks are available.');
  setQuestion(active.q);
 }catch(e){message('Cannot open PDF: '+(e.message||e),true)}
}
function localAnswers(){
 try{let v=JSON.parse(localStorage.getItem('tclab.pdf.responses.'+active.id)||'{}');return v&&typeof v==='object'?v:{}}catch{return{}}
}
function setAnswer(value){
 const v=localAnswers();if(value)v[active.q]=value;else delete v[active.q];
 try{localStorage.setItem('tclab.pdf.responses.'+active.id,JSON.stringify(v))}catch{}
 drawChoices();
}
function drawChoices(){
 if(!active||active.meta.test)return;
 const v=localAnswers(),root=$('pyp-source-choices');root.replaceChildren();
 for(const key of ['A','B','C','D']){
  const b=document.createElement('button');b.type='button';b.textContent=key;
  b.className=v[active.q]===key?'is-selected':'';
  b.setAttribute('aria-pressed',String(v[active.q]===key));
  b.onclick=()=>setAnswer(key);root.appendChild(b);
 }
 const b=document.createElement('button');b.type='button';b.textContent='Clear';b.onclick=()=>setAnswer(null);root.appendChild(b);
 const n=Object.keys(v).filter(x=>Number(x)>=1&&Number(x)<=active.meta.count&&/^[A-D]$/.test(v[x])).length;
 $('pyp-source-progress').textContent=n+' / '+active.meta.count+' selected · saved on this device (not scored)';
}
function setQuestion(q){
 if(!active?.pdf)return;
 const x=active; x.q=Math.min(x.meta.count,Math.max(1,q));
 $('pyp-source-question').textContent='Q'+x.q+'/'+x.meta.count;
 $('pyp-source-prev-q').disabled=x.q===1;
 $('pyp-source-next-q').disabled=x.q===x.meta.count;
 const mapped=x.meta.pages[x.q-1];
 $('pyp-source-page-hint').textContent=mapped
  ? 'Mapped to the original PDF page. Use Page ± if the question or its options extend onto another page.'
  : 'This source PDF has unreadable text encoding. Locate the question with the page controls.';
 setPage(mapped||1);
 drawChoices();
}
async function setPage(page){
 if(!active?.pdf)return;
 const x=active;
 x.page=Math.min(x.pdf.numPages,Math.max(1,page));
 $('pyp-source-page').textContent='Page '+x.page+'/'+x.pdf.numPages;
 $('pyp-source-prev-page').disabled=x.page===1;
 $('pyp-source-next-page').disabled=x.page===x.pdf.numPages;
 const serial=++renderSerial;
 if(renderTask){try{renderTask.cancel()}catch{}renderTask=null;}
 try{
  const pageObj=await x.pdf.getPage(x.page);
  if(serial!==renderSerial||x!==active)return;
  const canvas=$('pyp-source-canvas'),area=canvas.parentElement;
  const initial=pageObj.getViewport({scale:1});
  const scale=Math.min(2,Math.max(.5,Math.min(1050,area.clientWidth-24)/initial.width));
  const viewport=pageObj.getViewport({scale});
  const density=Math.min(2,window.devicePixelRatio||1);
  canvas.width=Math.ceil(viewport.width*density);canvas.height=Math.ceil(viewport.height*density);
  canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
  renderTask=pageObj.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport,transform:[density,0,0,density,0,0]});
  await renderTask.promise;
  if(serial===renderSerial)renderTask=null;
 }catch(e){if(serial===renderSerial&&e.name!=='RenderingCancelledException')message('Cannot render PDF page: '+e.message,true)}
}
input.addEventListener('change',async()=>{
 const selected=[...(input.files||[])],id=selectedId,meta=metaById[id];input.value='';
 if(!selected.length)return;
 if(!meta){
  const status=$('pyp-bulk-pdf-status');const ok=[],failed=[];
  for(const file of selected){
   const paper=entries.find(p=>p.file.toLowerCase()===file.name.toLowerCase());
   if(!paper){failed.push(file.name+' (unknown filename)');continue}
   try{
    if(file.size>32*1024*1024)throw Error('larger than 32 MB');
    if(new TextDecoder().decode(await file.slice(0,5).arrayBuffer())!=='%PDF-')throw Error('not a PDF');
    const lib=await pdfjs();
    const pdf=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
    if(pdf.numPages!==paper.totalPages)throw Error('page count differs: '+pdf.numPages+' vs '+paper.totalPages);
    await write({id:paper.id,blob:file,name:file.name});
    await pdf.destroy(); // Do not retain all ten parsed PDFs in memory on a phone.
    ok.push(paper.title);
   }catch(e){failed.push(file.name+' ('+e.message+')')}
  }
  if(status)status.textContent=ok.length+' source PDF(s) attached to this browser.'+
   (failed.length?' Could not import: '+failed.join('; '):'');
  await refresh();return;
 }
 const file=selected[0];
 try{
  if(file.size>32*1024*1024)throw Error('This browser viewer supports PDFs up to 32 MB.');
  if(new TextDecoder().decode(await file.slice(0,5).arrayBuffer())!=='%PDF-')throw Error('Not a PDF file.');
  const lib=await pdfjs(),pdf=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  if(pdf.numPages!==meta.totalPages)throw Error('Wrong PDF: '+pdf.numPages+' pages found; expected '+meta.totalPages+'.');
  if(file.name.toLowerCase()!==meta.file.toLowerCase()&&!window.confirm('Filename differs. Attach it to '+meta.title+' anyway?'))return;
  await write({id,blob:file,name:file.name});
  if(active?.id===id){active.pdf=pdf;await open(id,active.q)}
  refresh();
 }catch(e){message('Could not attach original PDF: '+e.message,true)}
});
function list(){
 const target=$('pyp-original-library');if(!target)return;
 target.innerHTML='<span class="section-kicker">ORIGINAL PAPER ARCHIVE</span><h3>10 image-based source PDFs · original diagrams and tables</h3>'+
  '<p class="muted">Attach the matching source PDF once to this browser. The PDF stays on your device. Four additional papers are available for unscored question-by-question practice; without verified answer keys, they cannot receive marks.</p>'+
  '<button type="button" class="pyp-bulk-import-btn" id="pyp-bulk-import">Attach all 10 original PDFs at once</button>'+
  '<p class="pyp-bulk-status" id="pyp-bulk-pdf-status" role="status"></p>'+
  '<div class="pyp-original-grid" id="pyp-original-grid"></div>';
 $('pyp-bulk-import').addEventListener('click',()=>{selectedId=null;input.click()});
 const grid=$('pyp-original-grid');
 for(const m of entries){
  const card=document.createElement('article');card.className='pyp-original-card';
  const title=document.createElement('h4');title.textContent=m.title;
  const sub=document.createElement('p');sub.textContent=m.count+' questions · '+m.duration+' min · '+(m.test?'Scored test already available':'Ungraded image-based practice');
  const badge=document.createElement('small');badge.id='pyp-src-state-'+m.id;badge.textContent='Source not attached';
  const btn=document.createElement('button');btn.type='button';btn.textContent=m.test?'Open original PDF':'Open image-based practice';
  btn.onclick=()=>open(m.id);
  card.append(title,sub,badge,btn);grid.appendChild(card);
 }
 refresh();
}
async function refresh(){
 for(const m of entries){
  const e=$('pyp-src-state-'+m.id);if(!e)continue;
  try{e.textContent=await read(m.id)?'✓ Source saved in this browser':'Choose PDF to view original pages'}
  catch{e.textContent='Browser storage unavailable'}
 }
}
function syncQuestion(id,q){
 let b=$('pyp-source-question-btn');
 if(!b){
  const heading=$('q-text');
  if(!heading)return;
  b=document.createElement('button');b.type='button';b.id='pyp-source-question-btn';b.className='pyp-original-question-btn';
  heading.parentElement.insertBefore(b,heading);
 }
 b.hidden=!metaById[id];
 if(metaById[id]){b.textContent='View original PDF · Q'+q;b.onclick=()=>open(id,q)}
}
window.PYPSource=Object.freeze({open,syncQuestion,exists:id=>!!metaById[id]});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',list,{once:true});
else list();
})();
