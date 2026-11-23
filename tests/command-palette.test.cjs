const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const pages=[
 'index.html','analog-circuit-analysis-design.html','pcb-designing-bootcamp.html',
 'rfid-card-detection.html','smart-id-attendance.html','test-centre/index.html',
 'workshops/analog-circuit-analysis-design/index.html',
 'workshops/pcb-designing-bootcamp/index.html'
];
test('optional command palette remains a valid progressive enhancement',()=>{
 const source=read('command-palette.js');
 assert.doesNotThrow(()=>new vm.Script(source));
 assert.ok(source.includes('command-palette.css'));
 for(const page of pages){
   const html=read(page);
   const count=(html.match(/command-palette\\.js(?:\\?v=[\\w-]+)?/g)||[]).length;
   // Pages can omit the optional launcher; if present, load it only once.
   assert.ok(count<=1,page+' duplicates the optional command palette');
   if(count)assert.ok(html.includes('ai-config.js'),page+' must still load AI configuration');
 }
});
test('keyboard controls, links, AI prompt and safe DOM text APIs',()=>{
 const s=read('command-palette.js');
 assert.doesNotThrow(()=>new vm.Script(s));
 assert.match(s,/event\.ctrlKey\|\|event\.metaKey/);
 assert.match(s,/event\.key\.toLowerCase\(\)==='k'/);
 assert.match(s,/dialog\.showModal\(\)/);
 assert.match(s,/event\.key==='ArrowDown'/);
 assert.match(s,/event\.key==='ArrowUp'/);
 assert.match(s,/event\.key==='Enter'/);
 assert.match(s,/window\.AakashAssistant\?\.open/);
 assert.match(s,/window\.portfolioEntries/);
 assert.match(s,/NEET and GATE Test Centre/);
 assert.match(s,/name\.textContent=item\.title/);
 assert.doesNotMatch(s,/innerHTML\s*=\s*item\.title/);
});
test('mobile layout, focus visibility and reduced-motion support',()=>{
 const css=read('command-palette.css');
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/max-width:580px/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/::backdrop/);
});
