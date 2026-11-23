'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('legacy backend URL resolver accepts HTTPS and local HTTP only',()=>{
 const source=read('backend-config.js');
 const check=(hostname,origin,value)=>{
  const win={AAKASH_BACKEND_ORIGIN:value||''};
  vm.runInNewContext(source,{window:win,location:{hostname,origin},URL});
  return win.AakashBackend;
 };
 assert.equal(check('localhost','http://localhost:3000').url('/api/health'),'http://localhost:3000/api/health');
 assert.equal(check('aakash9972sn.github.io','https://aakash9972sn.github.io').url('/api/health'),
   'https://aakash-portfolio-g3fb.onrender.com/api/health');
 assert.equal(check('example.com','https://example.com','https://api.example.com').url('/api/health'),'https://api.example.com/api/health');
 for(const unsafe of ['http://insecure.example','https://api.example.com/path','https://person:pass@api.example.com']){
  assert.equal(check('example.com','https://example.com',unsafe).configured(),false);
 }
});

test('portfolio, workshops, test centre load shared API config before the assistant',()=>{
 for(const page of [
  'index.html','analog-circuit-analysis-design.html','pcb-designing-bootcamp.html',
  'rfid-card-detection.html','smart-id-attendance.html','test-centre/index.html',
  'workshops/analog-circuit-analysis-design/index.html','workshops/pcb-designing-bootcamp/index.html'
 ]){
  const html=read(page);
  const config=html.indexOf('ai-config.js');
  const assistant=html.indexOf('ai-assistant.js');
  assert.ok(config>=0,page+' must load public API config');
  assert.ok(assistant>config,page+' must initialize API config before assistant');
  assert.match(html,/firebase-account\.js/);
  if(page==='test-centre/index.html')assert.match(html,/hosted-ai\.js/);
 }
});

test('AI request client uses central API_BASE_URL, never a hardcoded browser secret',()=>{
 const assistant=read('ai-assistant.js'),transport=read('test-centre/hosted-ai.js');
 assert.match(assistant,/const config = window\.AAKASH_AI/);
 assert.match(transport,/window\.API_BASE_URL/);
 assert.match(transport,/\/api\/ai\/study-mcq/);
 assert.match(transport,/\/api\/ai\/study-doubt/);
 assert.doesNotMatch(assistant,/AIza[A-Za-z0-9_-]{20,}/);
 assert.doesNotMatch(transport,/AIza[A-Za-z0-9_-]{20,}/);
});

test('Test Centre sends a generated MCQ to the same-origin backend and normalizes response',async()=>{
 const calls=[];
 const window={API_BASE_URL:''};
 const ctx={window,URL,Response,TextDecoder,AbortSignal,location:{hostname:'localhost',origin:'http://localhost:3000'},
   fetch:async(url,opts)=>{
    calls.push({url,opts});
    return new Response(JSON.stringify({questions:[{
     q:'What does a resistor do in an electrical circuit?',
     options:['Opposes current','Amplifies voltage','Stores charge','Generates AC'],
     answerIndex:0,explanation:'It resists current flow.',topic:'Resistance'
    }]}),{status:200,headers:{'Content-Type':'application/json'}});
   }
 };
 vm.runInNewContext(read('test-centre/hosted-ai.js'),ctx);
 const out=await window.HostedAI.request({
  action:'generate',exam:'gate',subject:'gate-nt',topic:'Resistance',count:1,difficulty:'Easy',avoid:[]
 });
 assert.equal(out.questions[0].a,0);
 assert.equal(out.questions[0].o.length,4);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'/api/ai/study-mcq');
 const sent=JSON.parse(calls[0].opts.body);
 assert.equal(sent.exam,'GATE ECE');
 assert.equal(sent.subject,'Network Theory');
});

test('HTML sent by a proxy is rejected rather than scored as an AI result',async()=>{
 const window={API_BASE_URL:''};
 let calls=0;
 const ctx={window,URL,Response,TextDecoder,AbortSignal,Date,
  location:{hostname:'localhost',origin:'http://localhost:3000'},
  fetch:async()=>{calls++;return new Response('<!doctype html><html>Login</html>',{status:200,headers:{'Content-Type':'text/html'}})}
 };
 vm.runInNewContext(read('test-centre/hosted-ai.js'),ctx);
 await assert.rejects(
  window.HostedAI.request({action:'generate',exam:'neet',subject:'neet-bio',count:1}),
  /web page instead of AI data|HTML|unreadable/i
 );
 assert.ok(calls>=1);
});
