'use strict';
// Source PDFs are never presented as automatically graded EC-style tests.
// SHA-256 and sizes are from the supplied original files, not external mirrors.
const papers = [
  {
    "year": 2025,
    "set": "",
    "file": "EE2025.pdf",
    "bytes": 1013019,
    "pages": 50,
    "sha256": "65d25e29697cd43628fa16f8da0f165bb708e49a2dfa48f8ba58804045fd7989",
    "source": "https://gate2026.iitg.ac.in/doc/download/2025/EE2025.pdf",
    "note": "Master paper + extra buffer questions; separate official key"
  },
  {
    "year": 2024,
    "set": "",
    "file": "EE2024.pdf",
    "bytes": 1013050,
    "pages": 46,
    "sha256": "e95a2bbe014d028b38a05431b8dd831590a3818dc2249b308dc0e962fa68c13b",
    "source": "https://gate2026.iitg.ac.in/doc/download/2024/EE24S8.pdf",
    "note": "Master paper; separate official key"
  },
  {
    "year": 2023,
    "set": "",
    "file": "EE2023.pdf",
    "bytes": 784485,
    "pages": 42,
    "sha256": "5cf6eb1b94575518a6bfb3645d4ef0dd244bb5040889b5072a696ce7b68ecd31",
    "source": "https://gate2026.iitg.ac.in/doc/download/2023/ee_2023.pdf",
    "note": "Master paper; separate official key"
  },
  {
    "year": 2022,
    "set": "",
    "file": "EE2022.pdf",
    "bytes": 578942,
    "pages": 36,
    "sha256": "1f2384e58e1aa0fd911cb829b3131355c6caacadc40000b51ec55ccb9bb18605",
    "source": "https://gateeestudy.com/papers/EE2022.pdf",
    "note": "Master paper; separate key needed"
  },
  {
    "year": 2021,
    "set": "",
    "file": "EE2021.pdf",
    "bytes": 6782706,
    "pages": 33,
    "sha256": "3c04a9eceeaa869e574d08e6b846713b9d37bd06910df1d68931d9a4c23748dc",
    "source": "https://gateeestudy.com/papers/EE2021.pdf",
    "note": "Original scanned paper; key on pages 31–33"
  },
  {
    "year": 2020,
    "set": "",
    "file": "EE2020.pdf",
    "bytes": 2304783,
    "pages": 20,
    "sha256": "d6ef92a3e15adafc62aed82b0000b745dd0b603884f734cdfa94f02d399bfc25",
    "source": "https://gateeestudy.com/papers/EE2020.pdf",
    "note": "Original image-based paper; key on pages 19–20"
  },
  {
    "year": 2019,
    "set": "",
    "file": "EE2019.pdf",
    "bytes": 1987903,
    "pages": 16,
    "sha256": "183c6acdab5b664b6c082acf5f9e302a2d557b61ec33b8144bd760d297bf4dbe",
    "source": "https://iaeacademy.in/files/papers/gate-2019-ee-question-paper.pdf",
    "note": "Original scanned paper; key on pages 14–16"
  },
  {
    "year": 2018,
    "set": "",
    "file": "EE2018.pdf",
    "bytes": 427728,
    "pages": 20,
    "sha256": "6da8dfd63af1c4780e9430a41565d60460b598968060642cb2629285001fda14",
    "source": "https://gateeestudy.com/papers/EE2018.pdf",
    "note": "Key on pages 18–20"
  },
  {
    "year": 2017,
    "set": "Session 2",
    "file": "EE2-2017.pdf",
    "bytes": 3710305,
    "pages": 26,
    "sha256": "d215ec143fa878f0de8bda5a204210adc6bd14cb1aaf6b192ed9d8032e796cd5",
    "source": "https://iaeacademy.in/files/papers/gate-2017-ee-2-question-paper.pdf",
    "note": "Key on pages 25–26"
  },
  {
    "year": 2017,
    "set": "Session 1",
    "file": "EE1-2017.pdf",
    "bytes": 4106855,
    "pages": 27,
    "sha256": "f8d098796aee50ddc834b17d559ca22cf89b19a7abceb6e231141a641991a4bf",
    "source": "https://iaeacademy.in/files/papers/gate-2017-ee-1-question-paper.pdf",
    "note": "Key on pages 26–27"
  },
  {
    "year": 2016,
    "set": "2 sessions",
    "file": "EE2016.pdf",
    "bytes": 767697,
    "pages": 37,
    "sha256": "6b743b18ecaaea3928ebe8b4dd61309c412f64078cca71bd6e9fd43bde960eaf",
    "source": "https://iaeacademy.in/files/papers/gate-2016-ee-question-papers.pdf",
    "note": "Two sessions and embedded keys"
  },
  {
    "year": 2015,
    "set": "2 sessions",
    "file": "EE2015.pdf",
    "bytes": 5940131,
    "pages": 57,
    "sha256": "acb150a207da864a52b6a2e6fde81777a7f3707da776343ca4b4f76f8963abd5",
    "source": "https://iaeacademy.in/files/papers/gate-2015-ee-question-papers.pdf",
    "note": "Correct answers are printed in the source; use for revision"
  },
  {
    "year": 2014,
    "set": "3 sessions",
    "file": "EE2014.pdf",
    "bytes": 2306260,
    "pages": 65,
    "sha256": "185d823e6d70c110a45d57a9727820201b930edd2290f844d999de96a03a37f4",
    "source": "https://iaeacademy.in/files/papers/gate-2014-ee-question-papers.pdf",
    "note": "Three sessions and embedded keys"
  },
  {
    "year": 2013,
    "set": "Booklets A–D",
    "file": "EE2013.pdf",
    "bytes": 726267,
    "pages": 68,
    "sha256": "bce6ae16ae0348ea5e006f42c3c58c0693da6ae3a3f1be9786382abaa0e31238",
    "source": "https://iaeacademy.in/files/papers/gate-2013-ee-question-paper.pdf",
    "note": "Four booklet orders of the same paper; separate keys needed"
  },
  {
    "year": 2012,
    "set": "Booklet A",
    "file": "EE2012.pdf",
    "bytes": 276966,
    "pages": 16,
    "sha256": "3c6df2a6016600ebf9ca1ef486d9fe0f5b8ae1992cdeb420af52bf4c134fb175",
    "source": "https://iaeacademy.in/files/papers/gate-2012-ee-question-paper.pdf",
    "note": "Booklet A; key on pages 15–16"
  },
  {
    "year": 2011,
    "set": "Booklet A",
    "file": "EE2011.pdf",
    "bytes": 1103689,
    "pages": 18,
    "sha256": "ce7c72a40c17fe97318c59d7857dbfe8e2ba50942751f53c34a97d9e8247e0b0",
    "source": "https://iaeacademy.in/files/papers/gate-2011-ee-question-paper.pdf",
    "note": "Original scanned paper; separate key needed"
  }
];
const $ = id => document.getElementById(id);
const year = $('year'), search = $('search'), availability = $('availability');
const localFiles = new Set(), selectedFiles = new Map();
for (const y of [...new Set(papers.map(p => p.year))]) year.add(new Option(y,y));
function element(tag, text, cls) {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (cls) el.className = cls;
  return el;
}
function link(label, url) {
  const a = element('a', label, 'action');
  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  return a;
}
const localPath = p => '../assets/gate-ee/' + encodeURIComponent(p.file);
async function isLocal(p) {
  try {
    const response = await fetch(localPath(p), {method:'HEAD', cache:'no-cache'});
    return response.ok && /application\/(pdf|octet-stream)/i.test(response.headers.get('content-type') || '') &&
      Number(response.headers.get('content-length')) === p.bytes;
  } catch { return false; }
}
async function verifyFile(p, file) {
  if (!file || file.size !== p.bytes || !globalThis.crypto?.subtle) return false;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
  return Array.from(digest, n => n.toString(16).padStart(2, '0')).join('') === p.sha256;
}
function render() {
  const query = search.value.trim().toLowerCase();
  const visible = papers.filter(p => {
    const original = localFiles.has(p.file) || selectedFiles.has(p.file);
    return (!year.value || String(p.year) === year.value) &&
      (!query || ('GATE EE ' + p.year + ' ' + p.set + ' ' + p.file + ' ' + p.note).toLowerCase().includes(query)) &&
      (!availability.value || (availability.value === 'ready' ? original : !original));
  });
  $('cards').replaceChildren(...visible.map(p => {
    const card = element('article','','card');
    const original = localFiles.has(p.file), selected = selectedFiles.get(p.file);
    card.append(element('h2','GATE EE '+p.year+(p.set?' · '+p.set:'')),
      element('p',p.pages+' pages · '+p.note,'muted'),
      element('p',selected?'Exact supplied original verified in this session':original?'Site-hosted PDF · matching file size':'External reference available · supplied original not hosted','muted'));
    const actions = element('div','','actions');
    if (selected) actions.append(link('Open verified original',selected));
    else if (original) actions.append(link('Open site PDF',localPath(p)));
    actions.append(link(original||selected?'External reference':'Open reference PDF',p.source));
    card.append(actions);
    const label = element('label','Select supplied original (SHA-256 check)','note');
    const input = element('input'); input.type='file';input.accept='.pdf,application/pdf';input.style.maxWidth='100%';
    const message = element('p','','note');message.setAttribute('role','status');
    input.addEventListener('change',async()=>{
      const file=input.files[0]; if(!file)return;
      input.disabled=true;
      message.textContent='Checking exact file…';
      try {
        if(!await verifyFile(p,file)){message.textContent='This file does not match the supplied original, or secure hashing is unavailable.';return;}
        if(selectedFiles.has(p.file))URL.revokeObjectURL(selectedFiles.get(p.file));
        selectedFiles.set(p.file,URL.createObjectURL(file));render();
      } catch { message.textContent='Could not verify the file. Try again.'; }
      finally {input.disabled=false;input.value='';}
    });
    label.append(input);card.append(label,message);
    if(selected){const clear=element('button','Forget selected file');clear.type='button';clear.onclick=()=>{URL.revokeObjectURL(selectedFiles.get(p.file));selectedFiles.delete(p.file);render();};card.append(clear);}
    return card;
  }));
  $('summary').textContent=visible.length+' of '+papers.length+' source files · '+papers.filter(p=>localFiles.has(p.file)||selectedFiles.has(p.file)).length+' originals available locally';
  if(!visible.length)$('cards').append(element('p','No papers match the filters.'));
}
for(const el of [year,search,availability])el.addEventListener(el===search?'input':'change',render);
render();
Promise.all(papers.map(async p=>{if(await isLocal(p))localFiles.add(p.file);})).then(render);
const duration=180*60*1000, timerKey='gate.ee.practice.deadline';
let deadline=0;
try {const value=Number(localStorage.getItem(timerKey));if(Number.isFinite(value)&&value>0)deadline=value;}catch{}
function setDeadline(n){deadline=n;try{if(n)localStorage.setItem(timerKey,String(n));else localStorage.removeItem(timerKey);}catch{}tick();}
function tick(){
 const remaining=deadline?Math.max(0,Math.ceil((deadline-Date.now())/1000)):duration/1000;
 $('clock').textContent=[Math.floor(remaining/3600),Math.floor(remaining%3600/60),remaining%60].map(n=>String(n).padStart(2,'0')).join(':');
 $('start').disabled=deadline>Date.now();
 $('timer-state').textContent=deadline&&remaining===0?'Time elapsed':deadline?'Practice timer running':'Timer ready';
}
$('start').onclick=()=>setDeadline(Date.now()+duration);
$('reset').onclick=()=>setDeadline(0);
window.addEventListener('storage',event=>{if(event.key===timerKey){const value=Number(event.newValue);deadline=Number.isFinite(value)&&value>0?value:0;tick();}});
tick();setInterval(tick,1000);
