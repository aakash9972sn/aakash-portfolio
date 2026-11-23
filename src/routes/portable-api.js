'use strict';
/* Portable optional API routes: no cloud SDK and no secrets in frontend code. */
const {isConfigured,database,leaderboard,upsertBest,upsertAttempt}=require('../db');
const {verifyFirebaseIdToken}=require('../security/firebase-token');

const throttle=new Map();
function limit(req,res,next){
 const now=Date.now(),key=String(req.ip||'unknown');
 const row=throttle.get(key)||{from:now,n:0};
 if(now-row.from>60000){row.from=now;row.n=0;}
 if(++row.n>35)return res.status(429).json({error:'Please wait before sending more requests.'});
 throttle.set(key,row);
 if(throttle.size>4000)for(const [k,v] of throttle)if(now-v.from>120000)throttle.delete(k);
 next();
}
function failure(error,res){
 const status=[400,401,403,413,429,503].includes(Number(error.status))?Number(error.status):503;
 return res.status(status).json({error:status===503?'This optional service is unavailable on this deployment.':String(error.message||'Request failed.').slice(0,220)});
}
function sources(response){
 const chunks=response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
 const urls=new Map();
 for(const part of chunks){
  const url=part.web?.uri||part.maps?.uri;
  if(typeof url!=='string'||!/^https:\/\//i.test(url))continue;
  try{
   const u=new URL(url);
   if(!['https:'].includes(u.protocol))continue;
   urls.set(u.href,{title:String(part.web?.title||part.maps?.title||u.hostname).slice(0,150),url:u.href});
  }catch{}
 }
 return [...urls.values()].slice(0,8);
}
async function requireOwner(req,res,next){
 try{
  req.firebaseUser=await verifyFirebaseIdToken(req);
  if(!req.firebaseUser.verified)return res.status(403).json({error:'Verified Google account required.'});
  next();
 }catch(error){return failure(error,res)}
}
function requireAI(req,res,next){
 if(!process.env.GEMINI_API_KEY)return res.status(503).json({error:'Gemini API is not configured; use the free browser fallback where available.'});
 next();
}
function parseImage(value){
 if(!value)return null;
 const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
 if(!match||match[2].length>7e6)throw Object.assign(Error('Reference must be a PNG/JPEG/WebP image under 5 MB.'),{status:400});
 return {mimeType:match[1],data:match[2]};
}
function registerPortableRoutes(app,express,createGeminiClient){
 app.use('/api/ai/image',express.json({limit:'8mb'}));
 app.use('/api/ai/transcribe',express.json({limit:'9mb'}));
 app.get('/api/public-config',(req,res)=>res.json({
  apiVersion:1,
  firebaseProjectId:process.env.FIREBASE_PROJECT_ID||'gen-lang-client-0580718541',
  googleMapsBrowserKey:process.env.GOOGLE_MAPS_BROWSER_KEY||'',
  features:{
   gemini:!!process.env.GEMINI_API_KEY,
   image:!!process.env.GEMINI_API_KEY,
   live:!!(process.env.GEMINI_API_KEY&&process.env.ENABLE_LIVE_AUDIO==='true'),
   postgres:isConfigured(),
   maps:!!process.env.GOOGLE_MAPS_BROWSER_KEY
  }
 }));
 app.post('/api/ai/image',limit,requireAI,async(req,res)=>{
  try{
   const prompt=String(req.body?.prompt||'').trim();
   if(prompt.length<8||prompt.length>1000)throw Object.assign(Error('Enter an image prompt between 8 and 1000 characters.'),{status:400});
   const ref=parseImage(req.body?.referenceDataUrl||'');
   const parts=[{text:prompt+'\nCreate a clear, high-resolution educational illustration. Use accurate component labels, clean white background unless the user requests a different background.'}];
   if(ref)parts.push({inlineData:ref});
   const response=await createGeminiClient().models.generateContent({
    model:process.env.GEMINI_IMAGE_MODEL||'gemini-2.5-flash-image',
    contents:[{role:'user',parts}],
    config:{responseModalities:['IMAGE','TEXT']}
   });
   const result=response?.candidates?.[0]?.content?.parts?.find(p=>p.inlineData&&/^image\/(png|jpeg|webp)$/.test(p.inlineData.mimeType||''));
   if(!result)throw Object.assign(Error('Image generation is not available for this model/key tier. Use the SVG figure tools instead.'),{status:503});
   res.json({imageDataUrl:'data:'+result.inlineData.mimeType+';base64,'+result.inlineData.data,description:String(response.text||'').slice(0,1000)});
  }catch(e){failure(e,res)}
 });
 app.post('/api/ai/transcribe',limit,requireAI,async(req,res)=>{
  try{
   const mime=String(req.body?.mimeType||'');
   const b64=String(req.body?.audioBase64||'');
   if(!/^(audio\/(webm|wav|x-wav|mpeg|mp3|ogg|mp4)|video\/webm)(;codecs=[\w,.-]+)?$/.test(mime)||b64.length<60||b64.length>10e6||!/^[A-Za-z0-9+/=]+$/.test(b64))
    throw Object.assign(Error('Upload supported WebM, WAV, MP3, OGG or MP4 audio under 7 MB.'),{status:400});
   const response=await createGeminiClient().models.generateContent({
    model:process.env.GEMINI_TRANSCRIBE_MODEL||process.env.GEMINI_MODEL_FAST||'gemini-2.5-flash',
    contents:[{role:'user',parts:[
      {text:'Transcribe this audio accurately. Preserve the original English or Hindi/Hinglish wording. Provide [mm:ss] timestamps at natural sentence boundaries when feasible. Do not invent speech. Output only the transcription.'},
      {inlineData:{data:b64,mimeType:mime}}
    ]}],
    config:{temperature:0}
   });
   const transcript=String(response.text||'').trim();
   if(!transcript)throw Object.assign(Error('Transcription was empty.'),{status:503});
   res.json({transcript:transcript.slice(0,15000),source:'gemini'});
  }catch(e){failure(e,res)}
 });
 app.post('/api/ai/maps-assist',limit,async(req,res)=>{
  const question=String(req.body?.question||req.body?.query||'').trim();
  if(question.length<3||question.length>280)return res.status(400).json({error:'Enter a place or location query (3–280 characters).'});
  const mapsEnabled=process.env.GEMINI_API_KEY&&process.env.ENABLE_MAPS_GROUNDING==='true';
  if(mapsEnabled){
   try{
    const response=await createGeminiClient().models.generateContent({
      model:process.env.GEMINI_MODEL_MAPS||process.env.GEMINI_MODEL_FAST||'gemini-2.5-flash',
      contents:question,
      config:{tools:[{googleMaps:{}}],systemInstruction:'Help with public places and directions only. Do not invent distances, hours, or business availability.'}
    });
    return res.json({answer:String(response.text||'').slice(0,5000),provider:'google-maps-grounding',sources:sources(response)});
   }catch(e){console.warn('Google Maps grounding unavailable:',String(e.message).slice(0,150))}
  }
  // Shared public Nominatim requires a descriptive User-Agent, caching and low rate.
  try{
   const url='https://nominatim.openstreetmap.org/search?format=json&limit=5&q='+encodeURIComponent(question.slice(0,120));
   const response=await fetch(url,{headers:{'User-Agent':'AakashPortfolio/1.0 (portfolio project; public maps fallback)','Accept':'application/json'},signal:AbortSignal.timeout(6000)});
   if(!response.ok)throw Error('OpenStreetMap search temporarily unavailable.');
   const places=(await response.json()).slice(0,5).map(p=>({
     name:String(p.display_name||'').slice(0,220),lat:Number(p.lat),lng:Number(p.lon)
   })).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
   return res.json({provider:'openstreetmap',places,attribution:'© OpenStreetMap contributors · Nominatim',answer:places.length?'Public OpenStreetMap place matches. Delivery availability has not been verified.':'No matching places found.'});
  }catch(e){return res.status(503).json({error:'Map search temporarily unavailable. Enter address manually.'})}
 });
 app.get('/api/leaderboard/:game',limit,async(req,res)=>{
  if(req.params.game!=='perfect-guess')return res.status(404).json({error:'Unknown game.'});
  if(!isConfigured())return res.json({available:false,leaders:[],message:'Public leaderboard is offline; personal bests still save locally or in Firebase.'});
  try{return res.json({available:true,verified:false,leaders:await leaderboard('perfect-guess',Math.min(50,Number(req.query.limit)||20))})}
  catch(e){return failure(e,res)}
 });
 app.post('/api/leaderboard/perfect-guess',limit,requireOwner,async(req,res)=>{
  if(!isConfigured())return res.status(503).json({error:'Public leaderboard requires DATABASE_URL; your personal Firebase score remains available.'});
  const score=Number(req.body?.score);
  if(!Number.isInteger(score)||score<1||score>100000)return res.status(400).json({error:'Invalid attempt count.'});
  try{return res.json({bestScore:await upsertBest({uid:req.firebaseUser.uid,name:req.firebaseUser.name,score}),source:'client-reported',note:'Scores are client-reported and not anti-cheat verified.'})}
  catch(e){return failure(e,res)}
 });
 app.post('/api/analytics/attempt',limit,requireOwner,async(req,res)=>{
  if(!isConfigured())return res.status(503).json({error:'Shared analytics require DATABASE_URL; existing Firebase/local results are unaffected.'});
  const b=req.body||{},count=v=>Number.isInteger(v)&&v>=0&&v<=10000;
  if(!/^[\w-]{1,128}$/.test(String(b.attemptId||''))||!count(b.correct)||!count(b.wrong)||!count(b.skipped)||
    !Number.isFinite(Number(b.score))||!Number.isFinite(Number(b.total)))
    return res.status(400).json({error:'Invalid attempt summary.'});
  try{
   await upsertAttempt({
    uid:req.firebaseUser.uid,attemptId:b.attemptId,testId:String(b.testId||'').slice(0,128),
    exam:String(b.exam||'').slice(0,60),subject:String(b.subject||'').slice(0,100),
    score:Number(b.score),total:Number(b.total),correct:b.correct,wrong:b.wrong,skipped:b.skipped,
    topics:b.topics&&typeof b.topics==='object'?b.topics:{}
   });
   return res.json({saved:true,source:'client-reported'});
  }catch(e){return failure(e,res)}
 });
 app.post('/api/transcripts',limit,requireOwner,async(req,res)=>{
  if(!isConfigured())return res.status(503).json({error:'Transcript storage disabled without DATABASE_URL.'});
  if(req.body?.consent!==true)return res.status(400).json({error:'Explicit transcript storage consent is required.'});
  const type=req.body?.kind,content=String(req.body?.content||'').trim();
  if(!['audio','chat'].includes(type)||!content||content.length>32000)return res.status(400).json({error:'Invalid transcript.'});
  try{
   const sql=database();
   await sql.unsafe('INSERT INTO conversation_transcripts(user_id,kind,content,language,consent) VALUES($1,$2,$3,$4,TRUE)',
       [req.firebaseUser.uid,type,content,String(req.body.language||'').slice(0,20)]);
   return res.status(201).json({saved:true});
  }catch(e){return failure(e,res)}
 });
 app.post('/api/store/orders',requireOwner,(_req,res)=>res.status(503).json({
   error:'Real Blunder checkout is disabled until inventory, merchant payments, verified delivery service and order fulfilment are configured. Demo orders stay on-device.'
 }));
}
module.exports={registerPortableRoutes,sources,limit,requireOwner};
