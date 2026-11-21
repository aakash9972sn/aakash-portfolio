const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const app=require('../server');
let server,base;const origin='https://aakash9972sn.github.io';
before(async()=>{server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;});
after(()=>new Promise(r=>server.close(r)));
const post=(path,body)=>fetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('health reports configuration honestly and never returns a key',async()=>{const res=await fetch(base+'/api/health');const data=await res.json();assert.equal(data.ok,true);assert.equal(data.provider,'google-gemini');assert.equal(data.configured,Boolean(process.env.GEMINI_API_KEY));assert.equal(data.apiKey,undefined);});
test('GitHub Pages preflight and POST are permitted, other origins are rejected',async()=>{const allowed=await fetch(base+'/api/ai/chat',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});assert.equal(allowed.status,204);assert.equal(allowed.headers.get('access-control-allow-origin'),origin);const denied=await fetch(base+'/api/health',{headers:{Origin:'https://untrusted.example'}});assert.equal(denied.status,403);});
test('portfolio and integrated Test Centre assets are served; private server files are not',async()=>{for(const path of ['/','/test-centre/','/test-centre/pyp-data.js','/firebase-applet-config.json'])assert.equal((await fetch(base+path)).status,200,path);for(const path of ['/.env','/server.js','/node_modules/express/package.json','/package-lock.json'])assert.equal((await fetch(base+path)).status,404,path);const missing=await fetch(base+'/api/missing');assert.equal(missing.status,404);assert.match(missing.headers.get('content-type'),/json/);});
test('chat and SSE use server-side Gemini responses and preserve page context',async()=>{const calls=[];app.locals.aiFactory=()=>({models:{generateContent:async p=>{calls.push(p);return {text:'Fixture tutor response'};}}});try{let r=await post('/api/ai/chat',{question:'Explain RFID',context:{project:'RFID'}});assert.equal(r.status,200);assert.equal((await r.json()).answer,'Fixture tutor response');r=await post('/api/ai/chat/stream',{question:'Explain RFID'});assert.match(await r.text(),/data: .*Fixture tutor response[\s\S]*"done":true/);assert.ok(JSON.stringify(calls[0]).includes('RFID'));}finally{delete app.locals.aiFactory;}});
test('MCQ JSON is validated before publication',async()=>{const questions=Array.from({length:2},(_,i)=>({q:`A ${i+4} ohm resistor carries 2 A. What voltage is across it?`,options:['1 V',`${(i+4)*2} V`,'20 V','40 V'],answerIndex:1,explanation:'Voltage equals the current multiplied by resistance.',topic:'Ohms law'}));app.locals.aiFactory=()=>({models:{generateContent:async()=>({text:JSON.stringify({questions})})}});try{const r=await post('/api/ai/study-mcq',{exam:'GATE ECE',subject:'Network Theory',count:2});assert.equal(r.status,200);assert.deepEqual((await r.json()).questions,questions);}finally{delete app.locals.aiFactory;}});
test('invalid chat is rejected before inference; missing credentials fail explicitly',async()=>{assert.equal((await post('/api/ai/chat',{question:''})).status,400);if(!process.env.GEMINI_API_KEY){const r=await post('/api/ai/chat',{question:'Explain RFID'});assert.equal(r.status,500);assert.match((await r.json()).error,/not configured/);}});


test('Render HTML navigation redirects to authorized GitHub Pages without redirecting Gemini APIs',async()=>{
  const http=require('node:http');
  const request=path=>new Promise((resolve,reject)=>{
    const req=http.get(base+path,{headers:{Host:'aakash-portfolio-g3fb.onrender.com'}},res=>{
      res.resume();
      res.on('end',()=>resolve({
        status:res.statusCode,
        location:res.headers.location,
        type:res.headers['content-type'],
      }));
    });
    req.on('error',reject);
  });
  for(const [path,expected] of [
    ['/','https://aakash9972sn.github.io/aakash-portfolio/'],
    ['/index.html?from=render','https://aakash9972sn.github.io/aakash-portfolio/index.html?from=render'],
    ['/test-centre/','https://aakash9972sn.github.io/aakash-portfolio/test-centre/'],
    ['/rfid-card-detection.html','https://aakash9972sn.github.io/aakash-portfolio/rfid-card-detection.html'],
    ['/workshops/pcb-designing-bootcamp/','https://aakash9972sn.github.io/aakash-portfolio/workshops/pcb-designing-bootcamp/'],
  ]) {
    const response=await request(path);
    assert.equal(response.status,302,path);
    assert.equal(response.location,expected,path);
  }
  const health=await request('/api/health');
  assert.equal(health.status,200);
  assert.match(health.type,/application\/json/);
  const config=await request('/firebase-applet-config.json');
  assert.equal(config.status,200);
  assert.match(config.type,/json/);
  const js=await request('/firebase-account.js');
  assert.equal(js.status,200);
});
