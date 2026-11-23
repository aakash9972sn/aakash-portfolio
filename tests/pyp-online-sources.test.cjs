'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('all ten original image-based papers have directly accessible public source URLs',()=>{
 const window={};
 vm.runInNewContext(read('test-centre/pyp-source-manifest.js'),{window,encodeURIComponent});
 const papers=window.PYPOriginalSourceManifest;
 assert.equal(papers.length,10);
 for(const paper of papers){
  assert.ok(paper.id&&paper.sourceUrl,paper.id+' has a source URL');
  const url=new URL(paper.sourceUrl);
  assert.equal(url.protocol,'https:');
  assert.equal(url.hostname,'pathfinderacademy.in');
  assert.ok(url.pathname.endsWith('.pdf'));
  assert.ok(paper.totalPages>0&&paper.count>0);
  assert.ok(paper.pages.length===paper.count||paper.pages.length===0,
   paper.id+' source page lookup has '+paper.pages.length+' for '+paper.count+' questions');
 }
});

test('PDF reader automatically loads the selected paper and keeps local upload optional',()=>{
 const src=read('test-centre/pyp-source-viewer.js');
 assert.doesNotThrow(()=>new vm.Script(src));
 assert.match(src,/else if\(meta\.sourceUrl\)/);
 assert.match(src,/link\.href=meta\.sourceUrl/);
 assert.match(src,/\/api\/pyp-source\//);
 assert.match(src,/pyp-source-remote-frame/);
 assert.match(src,/Original PDF opened from its public source/);
 assert.match(src,/Use local PDF \(optional\)/);
 assert.doesNotMatch(src,/The ChatGPT attachment is not automatically available to the website/);
});

test('Node and Cloudflare PDF proxy endpoints permit only fixed registered paper ids',()=>{
 const {SOURCES}=require('../src/routes/pyp-pdf');
 assert.equal(Object.keys(SOURCES).length,10);
 assert.equal(SOURCES['cuet-pg-life-sciences-2024'],
  'pyqs/cuet-pg-life-sciences-2024.pdf');
 assert.equal(SOURCES['cuet-pg-zoology-2024'],
  'pyqs/cuet-pg-zoology-2024.pdf');
 assert.equal(SOURCES['cuet-pg-zoology-2023-shift3'],
  'pyqs/cuet-pg-zoology-2023-english-shift-3.pdf');
 assert.equal(SOURCES['../../etc/passwd'],undefined);
 const node=read('server.js');
 assert.match(node,/registerPypPDFRoute\(app\)/);
 const worker=read('workers/api-worker.mjs');
 assert.match(worker,/PYP_SOURCE_PATHS/);
 assert.match(worker,/hasOwnProperty\.call\(PYP_SOURCE_PATHS,id\)/);
});

test('frontend integrates portable original-paper scripts with static cache-busted assets',()=>{
 const html=read('test-centre/index.html');
 assert.match(html,/pyp-source-manifest\.js\?v=/);
 assert.match(html,/pyp-source-viewer\.js\?v=/);
 assert.match(html,/pyp-pdf-cards\.js\?v=/);
 assert.ok(html.indexOf('pyp-source-manifest.js')<html.indexOf('pyp-source-viewer.js'));
});
