/* Public production smoke test: no keys, no account data, no Gemini quota used. */
const render='https://aakash-portfolio-g3fb.onrender.com';
const canonical='https://aakash9972sn.github.io/aakash-portfolio';
function assert(condition,reason){if(!condition)throw new Error(reason)}
const cases=[
 ['/',canonical+'/'],
 ['/test-centre/',canonical+'/test-centre/'],
 ['/rfid-card-detection.html',canonical+'/rfid-card-detection.html'],
];
for(const [path,target] of cases){
 const response=await fetch(render+path,{
  redirect:'manual',
  cache:'no-store',
  signal:AbortSignal.timeout(35000)
 });
 const got=response.headers.get('location');
 assert(response.status===302, 'Expected HTTP 302 for '+path+', received '+response.status);
 assert(got===target,'Unexpected canonical redirect for '+path+': '+String(got));
 console.log('PASS: Live Render HTML '+path+' redirects to authorized GitHub Pages site');
}
const origin='https://aakash9972sn.github.io';
const health=await fetch(render+'/api/health',{
 headers:{Origin:origin,Accept:'application/json'},
 signal:AbortSignal.timeout(35000)
});
assert(health.status===200,'Live Gemini health endpoint is not HTTP 200');
assert((health.headers.get('content-type')||'').includes('json'),'Gemini health is not JSON');
assert(health.headers.get('access-control-allow-origin')===origin,'Missing Pages CORS');
const data=await health.json();
assert(data.ok===true&&data.configured===true,'Live Gemini server missing configuration');
console.log('PASS: Live Gemini API remains operational with GitHub Pages CORS');
const config=await fetch(render+'/firebase-applet-config.json',{
 headers:{Accept:'application/json'},signal:AbortSignal.timeout(30000)
});
assert(config.status===200,'Firebase config should remain accessible without HTML redirect');
const firebase=await config.json();
assert(firebase.projectId==='gen-lang-client-0580718541','Wrong public Firebase project');
console.log('PASS: Firebase public config unchanged; no private keys displayed');
