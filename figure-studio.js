'use strict';
(()=>{
const $=id=>document.getElementById(id);
const form=$('figure-form'),status=$('figure-status'),ref=$('figure-reference'),preview=$('figure-preview'),dl=$('figure-download');
let resultUrl=null;
function report(message,error=false){status.textContent=message;status.style.color=error?'#b83434':''}
function bytesAsData(file){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read image'));
  reader.readAsDataURL(file);
 });
}
function show(url,caption){
 resultUrl=url;
 const img=document.createElement('img');img.alt=caption||'Generated educational diagram';img.src=url;
 preview.replaceChildren(img);$('figure-caption').textContent=caption||'Figure preview';
 dl.disabled=false;
}
async function submit(event){
 event.preventDefault();
 const prompt=$('figure-prompt').value.trim();
 if(prompt.length<8)return report('Please enter a descriptive prompt.',true);
 const file=ref.files?.[0];
 if(file && (!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024))
  return report('Use PNG, JPEG or WebP images under 5 MB.',true);
 const btn=$('figure-submit');btn.disabled=true;report('Requesting image from the configured Gemini backend…');
 try{
  const response=await fetch((window.API_BASE_URL||'')+'/api/ai/image',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({prompt,referenceDataUrl:file?await bytesAsData(file):null}),
   signal:AbortSignal.timeout(95000)
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(body.error||'Image generation is not available.');
  if(!/^data:image\/(?:png|jpeg|webp);base64,/.test(body.imageDataUrl||''))throw Error('Image API did not return a valid image.');
  show(body.imageDataUrl,'AI-generated or AI-edited illustration. Review scientific accuracy.');
  report('Image generated. Download PNG when ready.');
 }catch(e){report((e.message||'Image generation unavailable')+' You can use the local diagram template.',true)}
 finally{btn.disabled=false}
}
form.addEventListener('submit',submit);
document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{$('figure-prompt').value=b.dataset.preset}));
function template(){
 const raw=$('figure-prompt').value.trim();
 const words=raw.match(/[A-Za-z][A-Za-z0-9_-]{2,}/g)||['Input','Controller','Output'];
 const labels=[...new Set(words.filter(w=>!['with','the','and','for','from','draw','labelled','clear','white','background','educational','diagram'].includes(w.toLowerCase())))].slice(0,4);
 while(labels.length<3)labels.push(['Input','Processing','Output'][labels.length]);
 const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1280,720);
 ctx.fillStyle='#172c35';ctx.font='bold 44px sans-serif';ctx.textAlign='center';
 ctx.fillText('Illustrative block diagram · verify connections',640,94);
 ctx.strokeStyle='#305b70';ctx.lineWidth=4;ctx.fillStyle='#f3f8fb';
 const positions=[140,490,840];
 labels.slice(0,3).forEach((word,i)=>{
  const x=positions[i];
  ctx.fillStyle='#f3f8fb';ctx.beginPath();ctx.roundRect(x,275,300,145,14);ctx.fill();ctx.stroke();
  ctx.fillStyle='#192e38';ctx.font='bold 31px sans-serif';
  ctx.fillText(word.slice(0,17),x+150,360);
  if(i<2){ctx.fillStyle='#305b70';ctx.beginPath();ctx.moveTo(x+320,346);ctx.lineTo(x+365,346);ctx.lineTo(x+347,333);ctx.moveTo(x+365,346);ctx.lineTo(x+347,359);ctx.stroke()}
 });
 ctx.font='25px sans-serif';ctx.fillStyle='#6e7475';ctx.fillText('Template only: not a verified electrical schematic',640,594);
 show(canvas.toDataURL('image/png'),'Offline placeholder template, NOT an AI-created or verified circuit diagram.');
 report('Offline template created locally — no AI request or upload.');
}
$('figure-template').addEventListener('click',template);
dl.addEventListener('click',()=>{
 if(!resultUrl)return;
 // Normalize output to PNG even if the model returns WebP or JPEG.
 const img=new Image();
 img.onload=()=>{
  const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
  canvas.getContext('2d').drawImage(img,0,0);
  const a=document.createElement('a');a.download='aakash-figure-'+Date.now()+'.png';
  a.href=canvas.toDataURL('image/png');a.click();
 };
 img.src=resultUrl;
});
})();
