'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname, '..');

test('browser-uploaded Blunder records are expressly demo-only', () => {
  const rules=fs.readFileSync(path.join(root,'firestore.rules'),'utf8');
  assert.match(rules,/data\.orderId\.matches\('\^DEMO-BL-/);
  assert.match(rules,/data\.status in \['demo_received', 'demo_confirmed'/);
  assert.doesNotMatch(rules,/data\.status in \['received', 'confirmed', 'packed', 'dispatched', 'delivered'\]/);
  const app=fs.readFileSync(path.join(root,'blunder/script.js'),'utf8');
  assert.match(app,/status:\['demo_received','demo_confirmed','demo_packed','demo_dispatched','demo_delivered'\]/);
});

test('Node Gemini requests have a configurable bounded budget', () => {
  const source=fs.readFileSync(path.join(root,'server.js'),'utf8');
  assert.match(source,/function aiRateLimit\(req,res,next\)/);
  assert.match(source,/AI_REQUESTS_PER_MINUTE/);
  assert.match(source,/app\.use\('\/api\/ai',aiRateLimit\)/);
  assert.match(source,/function systemForPage\(appId\)/);
  assert.match(source,/appId === 'blunder'/);
});

test('public environment and portable deployment files never include secret values', () => {
  const env=fs.readFileSync(path.join(root,'.env.example'),'utf8');
  for(const key of ['GEMINI_API_KEY','DATABASE_URL','GOOGLE_MAPS_API_KEY']) {
    assert.match(env,new RegExp('^'+key+'=\\s*$','m'));
  }
  assert.match(env,/^AI_REQUESTS_PER_MINUTE=12$/m);
  assert.ok(fs.existsSync(path.join(root,'api/index.js')));
  assert.ok(fs.existsSync(path.join(root,'wrangler.toml')));
  assert.ok(fs.existsSync(path.join(root,'render.yaml')));
});

test('Cloudflare OSM adapter handles location lookup without Gemini', async () => {
  const saved=global.fetch;
  let asked=0;
  global.fetch=async url=>{
    asked++;
    assert.match(String(url),/nominatim\.openstreetmap\.org\/search/);
    return new Response(JSON.stringify([{
      display_name:'Delhi Technological University, Delhi, India',
      lat:'28.7498',lon:'77.1183',
      address:{city:'Delhi',state:'Delhi',postcode:'110042',road:'Shahbad Daulatpur'}
    }]),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const module=await import(pathToFileURL(path.join(root,'workers/api-worker.mjs')).href);
    const res=await module.default.fetch(new Request('https://demo.workers.dev/api/osm/search',{
      method:'POST',
      headers:{Origin:'https://aakash9972sn.github.io','Content-Type':'application/json'},
      body:JSON.stringify({query:'Delhi Technological University'})
    }),{CORS_ORIGIN:'https://aakash9972sn.github.io'});
    assert.equal(res.status,200);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'),'https://aakash9972sn.github.io');
    const data=await res.json();
    assert.equal(data.provider,'OpenStreetMap · Nominatim');
    assert.equal(data.results[0].pincode,'110042');
    assert.equal(asked,1);
  }finally{global.fetch=saved}
});

test('Cloudflare adapter rejects unapproved origins and malformed OSM coordinates', async () => {
  const module=await import(pathToFileURL(path.join(root,'workers/api-worker.mjs')).href);
  const env={CORS_ORIGIN:'https://aakash9972sn.github.io'};
  let response=await module.default.fetch(new Request('https://demo.workers.dev/api/osm/reverse',{
    method:'POST',headers:{Origin:'https://attacker.example','Content-Type':'application/json'},
    body:JSON.stringify({lat:28,lng:77})
  }),env);
  assert.equal(response.status,403);
  response=await module.default.fetch(new Request('https://demo.workers.dev/api/osm/reverse',{
    method:'POST',headers:{Origin:'https://aakash9972sn.github.io','Content-Type':'application/json'},
    body:JSON.stringify({lat:999,lng:77})
  }),env);
  assert.equal(response.status,400);
});
