const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root,name), 'utf8');

const pages=[
  'index.html','rfid-card-detection.html','smart-id-attendance.html',
  'analog-circuit-analysis-design.html','pcb-designing-bootcamp.html',
  'test-centre/index.html',
  'workshops/analog-circuit-analysis-design/index.html',
  'workshops/pcb-designing-bootcamp/index.html',
];
test('studio light homepage loads while preserving live backend, Firebase and projects',()=>{
 const html=read('index.html');
 assert.match(html,/studio-light-theme\.css\?v=20261121-light1/);
 assert.match(html,/studio-extras\.js\?v=20261121-zip1/);
 assert.match(html,/document\.documentElement\.dataset\.portfolioTheme/);
 assert.match(html,/From RF coupling/);
 assert.match(html,/backend-config\.js/);
 assert.match(html,/firebase-account\.js/);
 assert.match(html,/command-palette\.js/);
 assert.match(html,/assets\/aakash\.jpg/);
 assert.match(html,/test-centre\//);
 assert.match(html,/rfid-card-detection\.html/);
 const backend=read('backend-config.js');
 assert.match(backend,/aakash-portfolio-g3fb\.onrender\.com/);
 const config=JSON.parse(read('firebase-applet-config.json'));
 assert.equal(config.firestoreDatabaseId,
   'ai-studio-aakashportfolio-297b730c-ac6e-46a6-ab26-9a99d1551840');
 assert.equal(config.projectId,'gen-lang-client-0580718541');
});
test('new featured project tabs and topic filters use existing project data only',()=>{
 const code=read('studio-extras.js');
 assert.doesNotThrow(()=>new vm.Script(code));
 assert.match(code,/window\.portfolioEntries/);
 assert.match(code,/role', 'tablist'/);
 assert.match(code,/aria-selected/);
 assert.match(code,/data.studioView|dataset\.studioView/);
 assert.match(code,/studio-list-view/);
 assert.match(code,/dispatchEvent\(new Event\('input'/);
 assert.match(code,/dataset\.portfolioTheme/);
 assert.match(code,/localStorage\.setItem\('aakash\.portfolio\.theme'/);
 assert.doesNotMatch(code,/innerHTML\s*=/);
 assert.doesNotMatch(code,/AIza[A-Za-z0-9_-]+/);
 const css=read('studio-light-theme.css');
 assert.match(css,/data-portfolio-theme="dark"/);
 assert.match(css,/color-scheme:light/);
 assert.match(css,/\.site-home \.studio-featured/);
 assert.match(css,/max-width:760px/);
 assert.match(css,/focus-visible/);
});
test('Google popup initializes before click and keeps original named Firestore database',()=>{
 const source=read('firebase-account.js');
 assert.doesNotThrow(()=>new vm.Script(source));
 assert.match(source,/db = f\.getFirestore\(instance, config\.firestoreDatabaseId\)/);
 assert.match(source,/init\(\)\.then\(\(\) =>/);
 assert.match(source,/const cred = await au\.signInWithPopup\(auth, provider\)/);
 assert.match(source,/a\.onAuthStateChanged\(auth/);
 assert.match(source,/renderIdentityUI\(user\)/);
 assert.match(source,/if \(unsubscribeAuth\)/);
 assert.match(source,/auth\/unauthorized-domain/);
 assert.doesNotMatch(source,/testConnection\(\)/);
 assert.doesNotMatch(source,/console\.error\('Firestore Error:', JSON\.stringify\(errInfo\)/);
 for(const page of pages) {
   assert.match(read(page),/firebase-account\.js\?v=20261121-authfix1/,page);
 }
});
test('project reports, Test Centre, maps and strict Firestore schemas remain unchanged',()=>{
 const firebase=read('firebase-account.js');
 assert.match(firebase,/buildValidatedPayload/);
 assert.match(firebase,/getFirestore\(instance, config\.firestoreDatabaseId\)/);
 const server=read('server.js');
 assert.match(server,/\/api\/ai\/study-mcq/);
 assert.match(server,/\/api\/ai\/chat\/stream/);
 const data=read('portfolio-data.js');
 for(const id of ['rfid-card-detection','smart-id-attendance','biology-test',
                  'blunder-pro-max','analog-workshop','pcb-bootcamp']) assert.ok(data.includes(id));
 const rules=read('firestore.rules');
 assert.match(rules,/match \/users\/\{userId\}/);
});
