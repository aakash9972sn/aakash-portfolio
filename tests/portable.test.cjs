'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.join(__dirname,'..');

test('JavaScript entrypoints are syntactically valid for local and static use',()=>{
 const list=[
 'server.js','src/db/index.js','src/security/firebase-token.js',
 'src/routes/portable-api.js','src/routes/osm.js','src/live-relay.js',
 'api/index.js','ai-config.js','ai-assistant.js','ai-tools.js',
 'test-centre/ai-generator.js','test-centre/app.js','test-centre/ai-coach.js',
 'blunder/location.js','blunder/script.js','perfect-guess/app.js',
 'perfect-guess/leaderboard.js','figure-studio.js','src/3d/workbench.js',
 'workers/api-worker.mjs'
 ];
 for(const file of list){
  assert.ok(fs.existsSync(path.join(root,file)),file+' exists');
  assert.doesNotThrow(()=>execFileSync(process.execPath,['--check',path.join(root,file)],{stdio:'pipe'}),file+' parses');
 }
});
test('Static API_BASE_URL respects local, Pages and custom deployments',()=>{
 const source=fs.readFileSync(path.join(root,'ai-config.js'),'utf8');
 function run(hostname,override,meta){
  const win={};if(override!==undefined)win.API_BASE_URL=override;
  const ctx={window:win,location:{hostname},document:{querySelector:()=>meta?{content:meta}:null,querySelectorAll:()=>[]}};
  vm.runInNewContext(source,ctx);
  return win;
 }
 assert.equal(run('localhost').API_BASE_URL,'');
 assert.equal(run('localhost','https://api.example.com/').API_BASE_URL,'https://api.example.com');
 assert.match(run('aakash9972sn.github.io').API_BASE_URL,/^https:\/\/.*\.onrender\.com$/);
 assert.equal(run('my-custom-domain.com',undefined,'https://api.example.org').API_BASE_URL,'https://api.example.org');
 assert.equal(run('aakash9972sn.github.io','javascript:alert(1)').API_BASE_URL,'');
});
test('Portable PostgreSQL schema includes independent data structures',()=>{
 const sql=fs.readFileSync(path.join(root,'src/db/schema.sql'),'utf8');
 for(const table of ['public_leaderboard','test_analytics','blunder_orders','conversation_transcripts'])
  assert.match(sql,new RegExp('CREATE TABLE IF NOT EXISTS '+table));
 assert.match(sql,/CHECK\s*\(consent = true\)/);
 assert.match(sql,/PRIMARY KEY\s*\(game,\s*user_id\)/);
});
test('Postgres connector is optional and queries are parameterized',()=>{
 const prev=process.env.DATABASE_URL;
 delete process.env.DATABASE_URL;
 const db=require('../src/db');
 assert.equal(db.database(),null);
 assert.equal(db.isConfigured(),false);
 const text=fs.readFileSync(path.join(root,'src/db/index.js'),'utf8');
 assert.match(text,/\$1/);
 assert.match(text,/\$2/);
 if(prev!==undefined)process.env.DATABASE_URL=prev;
});
test('Firebase token verifier rejects missing or fake authorization without network',async()=>{
 const {verifyFirebaseIdToken}=require('../src/security/firebase-token');
 await assert.rejects(verifyFirebaseIdToken({get:()=>''}),error=>error.status===401);
 await assert.rejects(verifyFirebaseIdToken({get:()=> 'Bearer xxx.yyy.zzz'}),error=>error.status===401);
});
test('Gemini grounding returns only genuine HTTPS citations',()=>{
 const {sources}=require('../src/routes/portable-api');
 const data={candidates:[{groundingMetadata:{groundingChunks:[
  {web:{uri:'https://example.org/paper',title:'Original paper'}},
  {web:{uri:'javascript:alert(1)',title:'Untrusted'}},
  {web:{uri:'https://example.org/paper',title:'Repeat'}},
  {maps:{uri:'https://www.google.com/maps?q=test',title:'Map location'}}
 ]}}]};
 const entries=sources(data);
 assert.equal(entries.length,2);
 assert.deepEqual(entries[0],{url:'https://example.org/paper',title:'Repeat'});
 assert.ok(entries.every(x=>x.url.startsWith('https://')));
});
test('Demo e-commerce does not invent a real acceptance flow',()=>{
 const code=fs.readFileSync(path.join(root,'blunder/script.js'),'utf8');
 assert.match(code,/DEMO ONLY · NO REAL ORDER/);
 assert.match(code,/function placeDemoOrder/);
 const config=JSON.parse(fs.readFileSync(path.join(root,'blunder/data/store.json'),'utf8'));
 assert.equal(config.catalogApproved,false);
});
test('Committed example environment cannot contain credential literals',()=>{
 const text=fs.readFileSync(path.join(root,'.env.example'),'utf8');
 assert.match(text,/^GEMINI_API_KEY=\s*$/m);
 assert.match(text,/^DATABASE_URL=\s*$/m);
 assert.match(text,/^GOOGLE_MAPS_API_KEY=\s*$/m);
 assert.match(text,/^CORS_ORIGIN=/m);
});
test('Firebase subcollections require account UID and never allow public reads',()=>{
 const rules=fs.readFileSync(path.join(root,'firestore.rules'),'utf8');
 for(const name of ['testAttempts','generatedSets','preferences','savedAddresses','orders'])
  assert.match(rules,new RegExp('match /'+name+'/'));
 assert.match(rules,/request\.auth\.uid == userId/);
 assert.match(rules,/allow read, write: if false/);
});
test('Optional voice/3D endpoints are disabled unless explicitly configured',()=>{
 const s=fs.readFileSync(path.join(root,'src/live-relay.js'),'utf8');
 assert.match(s,/ENABLE_LIVE_AUDIO==='true'/);
 const three=fs.readFileSync(path.join(root,'src/3d/workbench.js'),'utf8');
 assert.match(three,/ACESFilmicToneMapping/);
 assert.match(three,/OrbitControls/);
 assert.match(three,/roughnessMap/);
 assert.match(three,/ResizeObserver/);
});
