'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const pages=[
 'index.html','rfid-card-detection.html','smart-id-attendance.html',
 'analog-circuit-analysis-design.html','pcb-designing-bootcamp.html',
 'test-centre/index.html',
 'workshops/analog-circuit-analysis-design/index.html',
 'workshops/pcb-designing-bootcamp/index.html'
];

test('current homepage retains portfolio, live API, Firebase and engineering projects',()=>{
 const html=read('index.html');
 for(const required of [
   'home-studio.css','theme-sync.js','firebase-account.js',
   'ai-config.js','ai-assistant.js','assets/aakash.jpg',
   'test-centre/','rfid-card-detection.html','From RF coupling'
 ]) assert.ok(html.includes(required),required);
 assert.ok(html.indexOf('ai-config.js')<html.indexOf('ai-assistant.js'));
 const firebase=JSON.parse(read('firebase-applet-config.json'));
 assert.equal(firebase.firestoreDatabaseId,'ai-studio-aakashportfolio-297b730c-ac6e-46a6-ab26-9a99d1551840');
 assert.equal(firebase.projectId,'gen-lang-client-0580718541');
});

test('optional studio tools still parse and never embed backend secrets',()=>{
 const code=read('studio-extras.js');
 assert.doesNotThrow(()=>new vm.Script(code));
 assert.match(code,/window\.portfolioEntries/);
 assert.match(code,/dataset\.portfolioTheme/);
 assert.doesNotMatch(code,/AIza[A-Za-z0-9_-]{20,}/);
 const css=read('home-studio.css');
 assert.match(css,/:focus-visible|focus-visible/);
 assert.match(css,/prefers-reduced-motion/);
});

test('Firebase account uses Google popup, named Firestore database and safe local fallback',()=>{
 const source=read('firebase-account.js');
 assert.doesNotThrow(()=>new vm.Script(source));
 assert.match(source,/getFirestore\(instance, config\.firestoreDatabaseId\)/);
 assert.match(source,/signInWithPopup\(auth, provider\)/);
 assert.match(source,/onAuthStateChanged\(auth/);
 assert.match(source,/auth\/unauthorized-domain/);
 assert.match(source,/buildValidatedPayload/);
 assert.match(source,/testAttempts/);
 assert.match(source,/generatedSets/);
 assert.match(source,/savedAddresses/);
 for(const page of pages)assert.match(read(page),/firebase-account\.js(?:\?v=[\w-]+)?/,page);
});

test('project resources and owner-only Firestore schemas remain accessible',()=>{
 const data=read('portfolio-data.js');
 for(const id of [
   'rfid-card-detection','smart-id-attendance','biology-test',
   'blunder-pro-max','analog-workshop','pcb-bootcamp'
 ]) assert.ok(data.includes(id),id);
 const server=read('server.js');
 assert.match(server,/\/api\/ai\/study-mcq/);
 assert.match(server,/\/api\/ai\/chat\/stream/);
 const rules=read('firestore.rules');
 assert.match(rules,/match \/users\/\{userId\}/);
 assert.match(rules,/request\.auth\.uid == userId/);
 for(const name of ['testAttempts','generatedSets','preferences','savedAddresses','orders'])
  assert.match(rules,new RegExp('match /'+name+'/'));
});
