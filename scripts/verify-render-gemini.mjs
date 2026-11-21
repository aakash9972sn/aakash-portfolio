/* Production check of the public, separately hosted Render server.
   Sends no credentials, personal details or sensitive content.
   Shows truncated error responses; never emits keys. */
const base='https://aakash-portfolio-g3fb.onrender.com';
function check(ok,message){if(!ok)throw new Error(message)}
const common={headers:{Origin:'https://aakash9972sn.github.io'},signal:AbortSignal.timeout(60000)};
const health=await fetch(base+'/api/health',{...common,headers:{...common.headers,Accept:'application/json'}});
const ct=(health.headers.get('content-type')||'').toLowerCase();
check(health.status===200,'Health route returned HTTP '+health.status);
check(ct.includes('application/json'),'Health returned non-JSON: '+ct);
const data=await health.json();
check(data.ok===true,'Health is not ready');
check(data.configured===true,'Render GEMINI_API_KEY is not configured');
console.log('PASS: public Render backend JSON health ok; configured=true; model='+String(data.model||'not-reported'));
const cors=health.headers.get('access-control-allow-origin');
check(cors==='https://aakash9972sn.github.io',
  'GitHub Pages CORS origin not allowed: '+String(cors));
console.log('PASS: GitHub Pages cross-origin response allowed');
const message={question:'Reply exactly with the word READY.',history:[],pageContext:{page:'portfolio'}};
const ai=await fetch(base+'/api/ai/chat/stream',{
 method:'POST',headers:{...common.headers,'Content-Type':'application/json',Accept:'text/event-stream'},
 signal:AbortSignal.timeout(65000),body:JSON.stringify(message)
});
const type=ai.headers.get('content-type')||'';
const text=await ai.text();
if(ai.status!==200||!type.includes('text/event-stream')) {
 console.log('AI_RESPONSE_STATUS',ai.status,'CONTENT_TYPE',type);
 const sanitized=text.slice(0,350).replace(/AIza[A-Za-z0-9_-]+|AQ\.[A-Za-z0-9_-]+/g,'[redacted]');
 throw new Error('Real Gemini request failed: '+sanitized);
}
check(text.includes('data:'),'SSE stream contained no data events');
const events=text.split(/\r?\n/).filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()).filter(Boolean);
const parsed=events.map(raw=>{try{return JSON.parse(raw)}catch{return {invalid:true}}});
const pieces=parsed.filter(x=>typeof x.text==='string').map(x=>x.text);
const combined=pieces.join('').trim();
if(!combined) {
 console.log('STREAM_EVENTS',JSON.stringify(parsed.map(e=>({
   keys:Object.keys(e),error:typeof e.error==='string'?e.error.slice(0,180):undefined
 })).slice(0,10)).replace(/AIza[A-Za-z0-9_-]+|AQ\\.[A-Za-z0-9_-]+/g,'[redacted]'));
 throw new Error('Gemini SSE stream did not contain answer text');
}
console.log('PASS: real Gemini model streamed answer text, length '+combined.length);

