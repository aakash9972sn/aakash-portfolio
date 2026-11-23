/* Cloudflare Workers fetch adapter: portable Gemini REST gateway for static sites.
 * No Node builtins, no privileged frontend keys, no vendor-specific database.
 * PostgreSQL and Gemini Live WS require the full Node adapter (Render/Vercel).
 */
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{
 status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}
});
const error=(message,status=503)=>json({error:String(message).slice(0,250)},status);
function model(env,preset){return String(preset==='deep'?env.GEMINI_MODEL_DEEP||'gemini-2.5-pro':env.GEMINI_MODEL_FAST||'gemini-2.5-flash-lite')}
function origins(env){return new Set(String(env.CORS_ORIGIN||'https://aakash9972sn.github.io,http://localhost:3000').split(',').map(s=>s.trim()))}
function safety(query){return String(query||'').trim().slice(0,1100)}
async function invoke(env,m,contents,config={}){
 if(!env.GEMINI_API_KEY)throw Error('GEMINI_API_KEY not configured in this Worker.');
 const allowedModel=/^[a-zA-Z0-9._-]{3,120}$/.test(m)?m:'gemini-2.5-flash-lite';
 const url='https://generativelanguage.googleapis.com/v1beta/models/'+allowedModel+':generateContent';
 const r=await fetch(url,{
  method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},
  body:JSON.stringify({contents,generationConfig:config.generationConfig||{},
    ...(config.tools?{tools:config.tools}:{}),
    ...(config.instruction?{systemInstruction:{parts:[{text:config.instruction}]}}:{})}),
  signal:AbortSignal.timeout(55000)
 });
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Error('Gemini model unavailable ('+r.status+'). '+String(data.error?.message||'Try another model or check key tier.').slice(0,150));
 return data;
}
function answer(obj){return (obj.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim()}
function refs(obj){
 const chunks=obj.candidates?.[0]?.groundingMetadata?.groundingChunks||[];
 const found=new Map();
 for(const c of chunks){
  const url=c.web?.uri||c.maps?.uri;
  if(typeof url!=='string')continue;
  try{const u=new URL(url);if(u.protocol!=='https:')continue;
   found.set(u.href,{url:u.href,title:String(c.web?.title||c.maps?.title||u.hostname).slice(0,140)})}
  catch{}
 }
 return [...found.values()].slice(0,8);
}
function historyContents(body){
 const arr=Array.isArray(body.history)?body.history.slice(-6):[];
 const contents=arr.filter(x=>typeof x.content==='string').map(x=>({
  role:x.role==='assistant'?'model':'user',parts:[{text:safety(x.content)}]
 }));
 const context=body.context||body.pageContext||{};
 const appendix=typeof context==='string'?context:JSON.stringify(context);
 contents.push({role:'user',parts:[{text:safety(body.question)+'\n\nPublic page context: '+String(appendix).slice(0,1600)}]});
 return contents;
}
function instruction(app){
 if(app==='study')return 'You are a patient GATE ECE, NEET UG and CUET PG tutor. Explain accurately and clearly. Format equations as LaTeX in \\( ... \\). Distinguish unverified previous-year answer keys from verified facts.';
 if(app==='blunder')return 'You are the Blunder grocery demo assistant. Discuss catalogue, cooking and delivery information. Never claim a real order/payment/delivery, or invent prices.';
 return 'You are a concise helpful portfolio guide for a Delhi Technological University ECE student. Only use provided page context for personal facts. Format equations as LaTeX in \\( ... \\).';
}
// Free OSM fallback for GitHub Pages + Workers: cached, conservative traffic.
// The public Nominatim instance prohibits bulk autocomplete; invoke on explicit
// searches or pin selection only. Hosting should enforce a shared rate limit.
let osmLastRequest = 0;
let osmQueue = Promise.resolve();
function osmAddress(v){
 const a=v.address||{},name=String(v.display_name||'').slice(0,350);
 return {
  lat:Number(v.lat),lng:Number(v.lon),formattedAddress:name,
  addressLine:String([a.house_number,a.road||a.suburb||a.neighbourhood].filter(Boolean).join(' ')||name.split(',').slice(0,2).join(',')).slice(0,220),
  city:String(a.city||a.town||a.village||a.county||'').slice(0,80),
  state:String(a.state||'').slice(0,80),
  pincode:/^[1-9]\\d{5}$/.test(a.postcode||'')?a.postcode:''
 };
}
async function osmLookup(endpoint,env){
 const cached=typeof caches!=='undefined'&&caches.default?
  await caches.default.match(endpoint):null;
 if(cached) return cached.json();
 const job=osmQueue.then(async()=>{
  const delay=Math.max(0,1100-(Date.now()-osmLastRequest));
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  osmLastRequest=Date.now();
  const response=await fetch(endpoint,{headers:{
   'Accept':'application/json',
   'User-Agent':String(env.OSM_USER_AGENT||'AakashPortfolio/1.0 (public educational site; contact: portfolio maintainer)')
  },signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('OpenStreetMap search is temporarily unavailable');
  const data=await response.json();
  if(typeof caches!=='undefined'&&caches.default)
    await caches.default.put(endpoint,new Response(JSON.stringify(data),{headers:{'Cache-Control':'public,max-age=43200','Content-Type':'application/json'}})).catch(()=>{});
  return data;
 });
 osmQueue=job.catch(()=>{});
 return job;
}
async function handler(req,env){
 const url=new URL(req.url),path=url.pathname;
 if(req.method==='GET'&&path==='/api/health')
  return json({ok:true,configured:!!env.GEMINI_API_KEY,model:model(env),provider:'cloudflare-workers',postgresConfigured:false,liveEnabled:false});
 if(req.method==='GET'&&path==='/api/public-config')
  return json({apiVersion:1,features:{gemini:!!env.GEMINI_API_KEY,image:!!env.GEMINI_API_KEY,live:false,postgres:false,maps:!!env.GOOGLE_MAPS_BROWSER_KEY},googleMapsBrowserKey:env.GOOGLE_MAPS_BROWSER_KEY||''});
 if(req.method==='GET'&&path==='/api/maps/config')
  return json({configured:!!env.GOOGLE_MAPS_BROWSER_KEY,apiKey:env.GOOGLE_MAPS_BROWSER_KEY||'',provider:env.GOOGLE_MAPS_BROWSER_KEY?'google':'openstreetmap'});
 if(req.method==='GET'&&path==='/api/leaderboard/perfect-guess')
  return json({available:false,leaders:[],message:'Public PostgreSQL leaderboard requires the full Node API. Local/Firebase best still works.'});
 if(req.method!=='POST')return error('Route not found on this Worker adapter.',404);
 if(path==='/api/osm/search'||path==='/api/osm/reverse'){
  if(Number(req.headers.get('content-length')||0)>1600)return error('Map request too large.',413);
  let b;try{b=await req.json()}catch{return error('Invalid map request.',400)}
  try{
   let endpoint;
   if(path.endsWith('/search')){
    const q=String(b.query||'').trim();
    if(q.length<3||q.length>180)return error('Enter a location (3–180 characters).',400);
    endpoint='https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=in&q='+encodeURIComponent(q);
   }else{
    const lat=Number(b.latitude??b.lat),lon=Number(b.longitude??b.lng);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)
      return error('Invalid coordinates.',400);
    endpoint='https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=18&lat='+lat.toFixed(6)+'&lon='+lon.toFixed(6);
   }
   const result=await osmLookup(endpoint,env);
   if(path.endsWith('/search'))return json({results:Array.isArray(result)?result.map(osmAddress).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)):[],provider:'OpenStreetMap · Nominatim'});
   return json({result:osmAddress(result),provider:'OpenStreetMap · Nominatim'});
  }catch{return error('OpenStreetMap is temporarily unavailable. Enter address manually.',503)}
 }
 if(['/api/store/orders','/api/orders'].includes(path))
  return error('Real Blunder checkout is disabled. Local demo-only checkout remains available.',503);
 if(path==='/api/analytics/attempt'||path==='/api/transcripts'||path==='/api/leaderboard/perfect-guess')
  return error('Authenticated PostgreSQL routes require the full Node API adapter.',503);
 const max=path==='/api/ai/transcribe'||path==='/api/ai/image'?10_000_000:200_000;
 if(Number(req.headers.get('content-length')||0)>max)return error('Request is too large.',413);
 const raw=await req.text();
 if(raw.length>max)return error('Request is too large.',413);
 let b;try{b=JSON.parse(raw||'{}')}catch{return error('Expected valid JSON.',400)}
 if(path==='/api/ai/chat'||path==='/api/ai/chat/stream'||path==='/api/ai/shop-assistant'){
  if(safety(b.question).length<2)return error('Enter a question.',400);
  const grounded=b.verifyWithWebSearch===true;
  const data=await invoke(env,model(env,b.modelPreset),historyContents(b),{
   instruction:instruction(path.includes('shop')?'blunder':b.app),
   ...(grounded?{tools:[{googleSearch:{}}]}:{})
  });
  const text=answer(data);if(!text)return error('Gemini returned no answer.',503);
  const src=grounded?refs(data):[];
  if(path==='/api/ai/chat/stream'){
   const events='data: '+JSON.stringify({text})+'\n\n'+'data: '+JSON.stringify({done:true,sources:src})+'\n\n';
   return new Response(events,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store'}});
  }
  return json({answer:text,sources:src});
 }
 if(path==='/api/ai/study-doubt'){
  const q=safety(b.question);
  if(q.length<2)return error('Missing question.',400);
  const parts=['Exam '+safety(b.exam),'Subject '+safety(b.subject),'Question: '+q,
   ...((Array.isArray(b.options)?b.options.slice(0,4):[]).map((o,i)=>(i+1)+'. '+safety(o))),
   'Saved key (unverified): '+String(b.correctIndex),'Selected: '+String(b.selectedIndex),
   safety(b.userDoubt||'Explain each option, verify the key and show textbook mathematics.')];
  const data=await invoke(env,model(env),[{role:'user',parts:[{text:parts.join('\n')}]}],{instruction:instruction('study')});
  return json({answer:answer(data)});
 }
 if(path==='/api/ai/study-mcq'){
  const n=Math.min(12,Math.max(1,Number(b.count)||2));
  const prompt='Generate '+n+' distinct single-answer exam MCQs strictly from the supplied syllabus. Return ONLY valid JSON: {"questions":[{"q":"string","o":["option 1","option 2","option 3","option 4"],"a":0,"e":"concise verified explanation","t":"subtopic"}]}. Answer index a is 0-3. Use correct JSON escaped LaTeX for equations. Subject: '+safety(b.subject)+' Exam: '+safety(b.exam)+' Unit: '+safety(b.unit)+' Topic: '+safety(b.topic)+' Difficulty: '+safety(b.difficulty)+' Syllabus: '+safety(b.syllabusSpec)+' Avoid repeats: '+JSON.stringify(b.avoid||[]).slice(0,1200);
  const data=await invoke(env,model(env),[{role:'user',parts:[{text:prompt}]}],{
   instruction:'Return accurate MCQs strictly in JSON. Do not invent a source attribution or official provenance.',
   generationConfig:{responseMimeType:'application/json'}
  });
  let obj;try{obj=JSON.parse(answer(data))}catch{return error('Invalid MCQ JSON from model; retry.',502)}
  const qs=Array.isArray(obj.questions)?obj.questions.slice(0,n):[];
  if(qs.length!==n||qs.some(q=>typeof q.q!=='string'||!Array.isArray(q.o)||q.o.length!==4||
     !Number.isInteger(q.a)||q.a<0||q.a>3||typeof q.e!=='string'||typeof q.t!=='string'))
    return error('Incomplete MCQ set; retry.',502);
  return json({questions:qs});
 }
 if(path==='/api/ai/transcribe'){
  const mime=String(b.mimeType||'');
  const payload=String(b.audioBase64||'');
  if(!/^(audio\/(webm|wav|x-wav|mpeg|mp3|ogg|mp4)|video\/webm)(;codecs=[\w,.-]+)?$/.test(mime)||
     payload.length<60||payload.length>10e6||!/^[A-Za-z0-9+/=]+$/.test(payload))return error('Invalid audio upload.',400);
  const data=await invoke(env,String(env.GEMINI_TRANSCRIBE_MODEL||env.GEMINI_MODEL_FAST||'gemini-2.5-flash'),[
   {role:'user',parts:[{text:'Accurately transcribe in English or Hinglish with timestamps when possible. Never invent words.'},
    {inlineData:{mimeType:mime,data:payload}}]}
  ]);
  return json({transcript:answer(data),source:'gemini'});
 }
 if(path==='/api/ai/image'){
  const prompt=safety(b.prompt);
  if(prompt.length<8)return error('Enter an image prompt.',400);
  const parts=[{text:prompt+'\nProduce a clean, accurate educational diagram with a white background.'}];
  if(b.referenceDataUrl){
   const matched=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(b.referenceDataUrl);
   if(!matched||matched[2].length>7e6)return error('Invalid image reference or too large.',400);
   parts.push({inlineData:{mimeType:matched[1],data:matched[2]}});
  }
  const data=await invoke(env,String(env.GEMINI_IMAGE_MODEL||'gemini-2.5-flash-image'),[{role:'user',parts}],{
   generationConfig:{responseModalities:['TEXT','IMAGE']}
  });
  const part=data.candidates?.[0]?.content?.parts?.find(x=>x.inlineData&&/^image\//.test(x.inlineData.mimeType||''));
  if(!part)return error('Image generation unavailable on this API tier.',503);
  return json({imageDataUrl:'data:'+part.inlineData.mimeType+';base64,'+part.inlineData.data,description:answer(data).slice(0,900)});
 }
 if(path==='/api/ai/maps-assist'){
  if(!env.ENABLE_MAPS_GROUNDING||env.ENABLE_MAPS_GROUNDING!=='true')
   return error('Maps grounding is disabled. Use the free Leaflet map or manual address search.',503);
  const query=safety(b.question||b.query);
  if(query.length<3)return error('Enter a public location question.',400);
  const data=await invoke(env,String(env.GEMINI_MODEL_MAPS||'gemini-2.5-flash'),[{role:'user',parts:[{text:query}]}],{tools:[{googleMaps:{}}]});
  return json({answer:answer(data),sources:refs(data),provider:'google-maps-grounding'});
 }
 return error('Unsupported Worker route. Use the full Node backend for this feature.',503);
}
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin');
  const allowed=origins(env);
  if(origin&&!allowed.has(origin))return error('Origin not allowed by CORS_ORIGIN.',403);
  const cors={
   ...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{}),
   'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
   'Access-Control-Allow-Headers':'Content-Type,Accept,Authorization'
  };
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  try{
   const response=await handler(request,env);
   for(const [key,value]of Object.entries(cors))response.headers.set(key,value);
   return response;
  }catch(e){
   const response=error(String(e.message||'This AI endpoint is unavailable; try again.'),503);
   for(const [key,value]of Object.entries(cors))response.headers.set(key,value);
   return response;
  }
 }
};
