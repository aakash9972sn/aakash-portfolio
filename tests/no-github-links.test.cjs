'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function collect(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    if(entry.isDirectory()){
      if(['.git','.github','node_modules','tests','scripts','src','workers','api'].includes(entry.name))return [];
      return collect(path.join(dir,entry.name));
    }
    return entry.isFile()&&/\.(?:html|js)$/i.test(entry.name)?[path.join(dir,entry.name)]:[];
  });
}
test('All visitor-facing site pages and browser scripts have no GitHub.com hyperlinks',()=>{
  const paths=collect(root);
  const html=paths.filter(p=>p.endsWith('.html'));
  assert.ok(html.length>=10,'Expected at least 10 HTML entrypoints to audit');
  for(const p of paths){
    const content=fs.readFileSync(p,'utf8');
    assert.doesNotMatch(content,/https?:\/\/(?:www\.)?github\.com\//i,
      'Public GitHub URL in '+path.relative(root,p));
  }
  const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(home,/<a class="btn-primary" href="#work">\s*Explore projects/);
  assert.doesNotMatch(home,/Find me on GitHub|class="github-nav"/i);
});
