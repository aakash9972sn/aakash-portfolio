const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
function backend(hostname,origin,configured=''){
  const window={AAKASH_BACKEND_ORIGIN:configured};
  const ctx={window,location:{hostname,origin},URL};
  vm.runInNewContext(read('backend-config.js'),ctx);
  return window.AakashBackend;
}

test('GitHub Pages portfolio routes to the verified public Render Node backend, never the AI Studio preview URL',()=>{
  const api=backend('aakash9972sn.github.io','https://aakash9972sn.github.io');
  assert.equal(api.configured(),true);
  assert.equal(api.url('/api/health'),'https://aakash-portfolio-g3fb.onrender.com/api/health');
  assert.doesNotMatch(read('backend-config.js'),/ais-pre-wdyrf6yb4psuwizvqpn4hw/);
  assert.doesNotMatch(read('backend-config.js'),/GEMINI_API_KEY\s*=/);
});
test('Node-hosted portfolio uses same-origin Gemini routes and accepts only HTTPS backend origins',()=>{
  const node=backend('localhost','http://localhost:3000');
  assert.equal(node.configured(),true);
  assert.equal(node.url('/api/health'),'http://localhost:3000/api/health');
  const cloud=backend('aakash9972sn.github.io','https://aakash9972sn.github.io','https://portfolio-node.example');
  assert.equal(cloud.url('/api/ai/study-mcq'),'https://portfolio-node.example/api/ai/study-mcq');
  for(const url of ['http://insecure.example','https://portfolio-node.example/api','https://user:password@portfolio-node.example']){
    assert.equal(backend('aakash9972sn.github.io','https://aakash9972sn.github.io',url).configured(),false);
  }
  assert.equal(backend('localhost','http://localhost:3000').url('/api/health'),'http://localhost:3000/api/health');
});
test('all eight portfolio entry pages load fresh shared backend config before AI scripts',()=>{
  const pages=[
    'index.html','analog-circuit-analysis-design.html',
    'pcb-designing-bootcamp.html','rfid-card-detection.html',
    'smart-id-attendance.html','test-centre/index.html',
    'workshops/analog-circuit-analysis-design/index.html',
    'workshops/pcb-designing-bootcamp/index.html'
  ];
  for(const file of pages) {
    const html=read(file);
    assert.match(html,/backend-config\.js\?v=20261121-sitefix1/,file);
    assert.ok(html.indexOf('backend-config.js') < html.indexOf('ai-config.js'), file+' config ordering');
    assert.match(html,/ai-assistant\.js\?v=20261121-sitefix1/,file);
    if(file==='test-centre/index.html')
      assert.match(html,/hosted-ai\.js\?v=20261121-sitefix1/,file);
  }
});
test('portfolio chatbot and Test Centre call resolver rather than hardcoded external AI app',()=>{
  const rootAssistant=read('ai-assistant.js');
  const testClient=read('test-centre/hosted-ai.js');
  assert.match(rootAssistant,/AakashBackend\?\.url\(config.endpoint\)/);
  assert.match(rootAssistant,/HTML webpage, not a Gemini response/);
  assert.match(rootAssistant,/Ask Gemini/);
  assert.match(testClient,/AakashBackend\?\.url\(path\)/);
  assert.match(testClient,/HTML instead of Gemini data/);
  assert.doesNotMatch(testClient,/Retry once with cache-busting/);
  assert.equal(read('ai-config.js').includes("endpoint: '/api/ai/chat/stream'"),true);
  assert.equal(read('test-centre/ai-config.js').includes("TEST_CENTRE_AI_ENDPOINT = '/api'"),true);
});
test('Test Centre correctly converts and sends a Gemini MCQ response via the shared backend',async()=>{
  const calls=[];
  const window={};
  const ctx={
    window,
    URL,Response,TextDecoder,AbortSignal,
    fetch:async(url,opts)=>{
      calls.push({url,opts});
      return new Response(JSON.stringify({questions:[{
        q:'What does a resistor do in an electrical circuit?',
        options:['Opposes current','Amplifies voltage','Stores charge','Generates AC'],
        answerIndex:0,explanation:'It resists current flow.',topic:'Resistance'
      }]}),{status:200,headers:{'Content-Type':'application/json'}});
    },
  };
  ctx.location={hostname:'localhost',origin:'http://localhost:3000'};
  vm.runInNewContext(read('backend-config.js'),ctx);
  vm.runInNewContext(read('test-centre/hosted-ai.js'),ctx);
  const out=await window.HostedAI.request({
    action:'generate',exam:'gate',subject:'gate-nt',topic:'Resistance',count:1,difficulty:'Easy',avoid:[]
  });
  assert.equal(out.questions[0].a,0);
  assert.equal(out.questions[0].o.length,4);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'http://localhost:3000/api/ai/study-mcq');
  const sent=JSON.parse(calls[0].opts.body);
  assert.equal(sent.exam,'GATE ECE');
  assert.equal(sent.subject,'Network Theory');
});
test('HTML-200 AI response is rejected instead of silently counting as a successful inference',async()=>{
  const window={};
  const ctx={
    window,URL,Response,TextDecoder,AbortSignal,
    location:{hostname:'localhost',origin:'http://localhost:3000'},
    fetch:async()=>new Response('<!doctype html><html>preview app</html>',{
      status:200,headers:{'Content-Type':'text/html'}
    }),
  };
  vm.runInNewContext(read('backend-config.js'),ctx);
  vm.runInNewContext(read('test-centre/hosted-ai.js'),ctx);
  await assert.rejects(
    window.HostedAI.request({action:'generate',exam:'neet',subject:'neet-bio',count:1}),
    /HTML instead of Gemini data/
  );
});
