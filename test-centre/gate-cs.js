'use strict';
const papers = [
  {
    "year": 2025,
    "set": "Set 2",
    "file": "CS22025.pdf",
    "hosted": true,
    "sha": "46e3f5ddb47036f0096f155ddd994bc86ebb0467",
    "mirror": "https://raw.githubusercontent.com/Vikram2005-byte/gate-cs-previous-year-papers/19abb22e3ab4152f09c824f29f9b6e3015e2d1e3/2025_CS2.pdf"
  },
  {
    "year": 2024,
    "set": "Set 1",
    "file": "CS12024.pdf",
    "hosted": true,
    "sha": "33e688e070e56adb9e8583027db5f67a238457d5",
    "mirror": "https://raw.githubusercontent.com/Vikram2005-byte/gate-cs-previous-year-papers/19abb22e3ab4152f09c824f29f9b6e3015e2d1e3/2024_CS1.pdf"
  },
  {
    "year": 2023,
    "set": "",
    "file": "CS2023.pdf",
    "hosted": true,
    "sha": "e8f135790b9c07fa380506078ad31074736e1cd8",
    "mirror": "https://raw.githubusercontent.com/Vikram2005-byte/gate-cs-previous-year-papers/19abb22e3ab4152f09c824f29f9b6e3015e2d1e3/2023_CS.pdf"
  },
  {
    "year": 2022,
    "set": "",
    "file": "CS2022.pdf",
    "hosted": true,
    "sha": "9e1fb15abcd477145ca63f7c235b836604704e28",
    "mirror": "https://raw.githubusercontent.com/Vikram2005-byte/gate-cs-previous-year-papers/19abb22e3ab4152f09c824f29f9b6e3015e2d1e3/2022_CS.pdf"
  },
  {
    "year": 2021,
    "set": "Set 2",
    "file": "CS2-2021.pdf",
    "hosted": false,
    "sha": "86e51ccc7bdf2ba4ca9536a617025a6c475f1eb7",
    "mirror": null
  },
  {
    "year": 2021,
    "set": "Set 1",
    "file": "CS1-2021.pdf",
    "hosted": false,
    "sha": "9bef29cd4fa74ee685109f21724177e3df245726",
    "mirror": null
  },
  {
    "year": 2020,
    "set": "",
    "file": "CS2020.pdf",
    "hosted": false,
    "sha": "06a01b0a041408c2d668cbed989585243a18d6d6",
    "mirror": "https://raw.githubusercontent.com/Vikram2005-byte/gate-cs-previous-year-papers/19abb22e3ab4152f09c824f29f9b6e3015e2d1e3/2020_CS.pdf"
  },
  {
    "year": 2019,
    "set": "",
    "file": "CS2019.pdf",
    "hosted": false,
    "sha": "6dffae478907d3d16d04b801282aeccbfafcc3a1",
    "mirror": "https://raw.githubusercontent.com/Vikram2005-byte/gate-cs-previous-year-papers/19abb22e3ab4152f09c824f29f9b6e3015e2d1e3/2019_CS.pdf"
  },
  {
    "year": 2018,
    "set": "",
    "file": "CS2018.pdf",
    "hosted": true,
    "sha": "00e6533f6900c8d14b83e647a5950abdd7b30165",
    "mirror": "https://raw.githubusercontent.com/Vikram2005-byte/gate-cs-previous-year-papers/19abb22e3ab4152f09c824f29f9b6e3015e2d1e3/2018_CS.pdf"
  },
  {
    "year": 2017,
    "set": "Set 2",
    "file": "CS2-2017.pdf",
    "hosted": false,
    "sha": "d788ce1c20140a5d926c4f2bf57bea89e7a02e17",
    "mirror": "https://raw.githubusercontent.com/Vikram2005-byte/gate-cs-previous-year-papers/19abb22e3ab4152f09c824f29f9b6e3015e2d1e3/2017_CS2.pdf"
  },
  {
    "year": 2017,
    "set": "Set 1",
    "file": "CS1-2017.pdf",
    "hosted": false,
    "sha": "d22e49cccf5e9b5bc1565ba1df4c561ac99ce93e",
    "mirror": null
  },
  {
    "year": 2016,
    "set": "",
    "file": "CS2016.pdf",
    "hosted": true,
    "sha": "6512c00209256837a12ebb1b37fc5c945ea4561d",
    "mirror": "https://raw.githubusercontent.com/Vikram2005-byte/gate-cs-previous-year-papers/19abb22e3ab4152f09c824f29f9b6e3015e2d1e3/2016_CS.pdf"
  },
  {
    "year": 2015,
    "set": "",
    "file": "CS2015.pdf",
    "hosted": false,
    "sha": "b7bd003c802ec783ff539fd2459b3b41a897ce77",
    "mirror": "https://raw.githubusercontent.com/Vikram2005-byte/gate-cs-previous-year-papers/19abb22e3ab4152f09c824f29f9b6e3015e2d1e3/2015_CS.pdf"
  },
  {
    "year": 2014,
    "set": "",
    "file": "CS2014.pdf",
    "hosted": false,
    "sha": "388057fe1607855bf909c9ace7a781a74d418128",
    "mirror": "https://raw.githubusercontent.com/Vikram2005-byte/gate-cs-previous-year-papers/19abb22e3ab4152f09c824f29f9b6e3015e2d1e3/2014_CS.pdf"
  },
  {
    "year": 2013,
    "set": "",
    "file": "CS2013.pdf",
    "hosted": true,
    "sha": "20414646231718286099be4d283f7f52c9215d04",
    "mirror": "https://raw.githubusercontent.com/Vikram2005-byte/gate-cs-previous-year-papers/19abb22e3ab4152f09c824f29f9b6e3015e2d1e3/2013_CS.pdf"
  },
  {
    "year": 2012,
    "set": "",
    "file": "CS2012.pdf",
    "hosted": true,
    "sha": "141501c1ca10faef0038b1ab842fde140901749d",
    "mirror": "https://raw.githubusercontent.com/Vikram2005-byte/gate-cs-previous-year-papers/19abb22e3ab4152f09c824f29f9b6e3015e2d1e3/2012_CS.pdf"
  },
  {
    "year": 2011,
    "set": "",
    "file": "CS2011.pdf",
    "hosted": false,
    "sha": "9e222bc94c137800c635e66226cc2708ce36e633",
    "mirror": null
  }
];
const $=id=>document.getElementById(id);
const archive='https://gate2026.iitg.ac.in/download.html';
const year=$('year'), search=$('search'), availability=$('availability');
for(const y of [...new Set(papers.map(p=>p.year))])year.add(new Option(y,y));
function element(tag,text,cls){const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;}
function link(label,url){const a=element('a',label,'action');a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
const localPath=p=>'../assets/gate-cs/'+encodeURIComponent(p.file);
async function isLocal(p){try{const r=await fetch(localPath(p),{method:'HEAD'});return r.ok && /application\/pdf|application\/octet-stream/i.test(r.headers.get('content-type')||'');}catch{return false;}}
const localFiles=new Set(papers.filter(p=>p.hosted).map(p=>p.file));
function render(){
 const query=search.value.trim().toLowerCase();
 const visible=papers.filter(p=>(!year.value||String(p.year)===year.value)&&(!query||('GATE CS '+p.year+' '+p.set+' '+p.file).toLowerCase().includes(query))&&(!availability.value||(availability.value==='ready' ? localFiles.has(p.file)||p.mirror : !localFiles.has(p.file)&&!p.mirror)));
 const cards=visible.map(p=>{
 const card=element('article','','card');card.append(element('h2','GATE CS '+p.year+(p.set?' · '+p.set:'')));
 const local=localFiles.has(p.file);
 card.append(element('p',local?'Original PDF · hosted on site':p.mirror?'Original PDF · verified matching archive copy':'Original upload pending · official archive available','muted'));
 const actions=element('div','','actions');
 if(local||p.mirror)actions.append(link('Open PDF',local?localPath(p):p.mirror));
 else actions.append(link('Find in official archive',archive));
 card.append(actions);
 if(!local){const label=element('label','Open your original PDF locally','note');const input=element('input');input.type='file';input.accept='application/pdf,.pdf';input.style.maxWidth='100%';input.addEventListener('change',()=>{const file=input.files[0];if(!file)return;const url=URL.createObjectURL(file);const a=link('Open selected PDF',url);actions.append(a);input.value='';});label.append(input);card.append(label);}
 return card;
 });$('cards').replaceChildren(...cards);$('summary').textContent=visible.length+' of '+papers.length+' source files';
}
for(const el of [year,search,availability])el.addEventListener(el===search?'input':'change',render);
render();
Promise.all(papers.filter(p=>!p.hosted).map(async p=>{if(await isLocal(p))localFiles.add(p.file);})).then(render);
let deadline=0;try{deadline=Number(localStorage.getItem('gate.cs.practice.deadline'))||0;}catch{}
function setDeadline(n){deadline=n;try{if(n)localStorage.setItem('gate.cs.practice.deadline',String(n));else localStorage.removeItem('gate.cs.practice.deadline');}catch{}tick();}
function tick(){const remaining=deadline?Math.max(0,Math.ceil((deadline-Date.now())/1000)):10800;$('clock').textContent=[Math.floor(remaining/3600),Math.floor(remaining%3600/60),remaining%60].map(n=>String(n).padStart(2,'0')).join(':');$('start').disabled=deadline>Date.now();}
$('start').onclick=()=>setDeadline(Date.now()+10800000);$('reset').onclick=()=>setDeadline(0);tick();setInterval(tick,1000);
