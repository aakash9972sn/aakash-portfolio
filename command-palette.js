/* Lightweight, accessible global command palette. Vanilla JS; no external services. */
(() => {
  'use strict';
  const currentScript = document.currentScript;
  const base = new URL('./', currentScript?.src || location.href);
  const href = path => new URL(path, base).href;
  const asset = file => new URL(file, base).href;
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = asset('command-palette.css?v=20261121-1');
  document.head.appendChild(stylesheet);
  if(!document.body || !document.createElement) return;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'aakash-command-trigger';
  trigger.setAttribute('aria-label', 'Search the portfolio and projects');
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.innerHTML = '<span aria-hidden="true">⌕</span><span>Quick search</span><kbd>Ctrl/⌘ K</kbd>';

  const dialog = document.createElement('dialog');
  dialog.className = 'aakash-command-dialog';
  dialog.setAttribute('aria-labelledby', 'aakash-command-title');
  const shell = document.createElement('div');
  shell.className = 'aakash-command-shell';
  const head = document.createElement('div');
  head.className = 'aakash-command-head';
  const title = document.createElement('h2');
  title.id = 'aakash-command-title';
  title.textContent = 'Find something';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'aakash-command-close';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close search');
  head.append(title,close);
  const label = document.createElement('label');
  label.className = 'aakash-command-label';
  label.setAttribute('for','aakash-command-query');
  label.textContent = 'Search projects, workshops, and pages';
  const query = document.createElement('input');
  query.id='aakash-command-query';
  query.type='search';
  query.placeholder='Try RFID, PCB, GATE, circuits…';
  query.autocomplete='off';
  query.setAttribute('aria-controls','aakash-command-results');
  const results = document.createElement('div');
  results.id='aakash-command-results';
  results.className='aakash-command-results';
  results.setAttribute('role','group');
  results.setAttribute('aria-label','Portfolio search results');
  const status = document.createElement('p');
  status.className='aakash-command-status';
  status.setAttribute('role','status');
  const footer = document.createElement('p');
  footer.className='aakash-command-footer';
  footer.textContent='↑↓ Navigate · Enter Open · Esc Close';
  shell.append(head,label,query,results,status,footer);
  dialog.append(shell);
  (document.getElementById('study-tools') || document.body).append(trigger);
  document.body.append(dialog);

  const staticItems=[
    {title:'Portfolio home',detail:'Overview and featured work',href:href('index.html')},
    {title:'All projects',detail:'Embedded hardware, software and experiments',href:href('index.html#work')},
    {title:'Workshops and learning',detail:'Circuit design and PCB notes',href:href('index.html#workshops')},
    {title:'About Aakash',detail:'Background and interests',href:href('index.html#about')},
    {title:'Education',detail:'DTU ECE journey',href:href('index.html#education')},
    {title:'Contact',detail:'Get in touch',href:href('index.html#contact')},
    {title:'NEET and GATE Test Centre',detail:'Practice exams and solutions',href:href('test-centre/')}
  ];
  const projectItems=Array.isArray(window.portfolioEntries)
    ? window.portfolioEntries
       .filter(item=>item && typeof item.title==='string' && typeof item.href==='string')
       .map(item=>({
         title:item.title,
         detail:[item.category,...(item.tags||[])].join(' · '),
         href:/^https?:\/\//.test(item.href)?item.href:href(item.href)
       }))
    : [];
  const items=[...staticItems,...projectItems];

  let previousFocus=null;
  let activeIndex=0;
  let visible=[];
  function closeDialog() { if(dialog.open) dialog.close(); }
  function openDialog() {
    if(dialog.open)return;
    previousFocus=document.activeElement;
    query.value='';
    render();
    dialog.showModal();
    query.focus();
  }
  function matches(item,search) {
    return (item.title+' '+item.detail).toLocaleLowerCase().includes(search);
  }
  function render() {
    const term=query.value.trim().toLocaleLowerCase();
    visible=items.filter(item=>!term||matches(item,term)).slice(0,16);
    const exact=term.length>=3;
    if(exact)visible.push({
      title:'Ask Gemini: '+query.value.trim().slice(0,80),
      detail:'Open the portfolio AI guide · requires a connected backend',
      aiPrompt:query.value.trim()
    });
    results.replaceChildren();
    if(!visible.length) {
      const empty=document.createElement('p');
      empty.className='aakash-command-empty';
      empty.textContent='No matching projects. Try another term.';
      results.append(empty);
    }
    visible.forEach((item,index)=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='aakash-command-result';
      button.dataset.index=String(index);
      const name=document.createElement('strong');
      name.textContent=item.title;
      const detail=document.createElement('span');
      detail.textContent=item.detail;
      const arrow=document.createElement('span');
      arrow.className='aakash-command-arrow';
      arrow.textContent='↗';
      button.append(name,detail,arrow);
      button.addEventListener('click',()=>activate(item));
      results.append(button);
    });
    activeIndex=0;
    setActive();
    status.textContent=visible.length+' matching actions';
  }
  function setActive() {
    const controls=[...results.querySelectorAll('.aakash-command-result')];
    controls.forEach((control,index)=>{
      control.dataset.active=index===activeIndex?'true':'false';
    });
    controls[activeIndex]?.scrollIntoView({block:'nearest'});
  }
  function activate(item) {
    closeDialog();
    if(item.aiPrompt) {
      if(window.AakashAssistant?.open) {
        window.AakashAssistant.open(item.aiPrompt);
      } else {
        const target=href('index.html');
        location.href=target;
      }
      return;
    }
    if(item.href)location.href=item.href;
  }
  trigger.addEventListener('click',openDialog);
  close.addEventListener('click',closeDialog);
  query.addEventListener('input',render);
  query.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();
      if(!visible.length)return;
      activeIndex=(activeIndex+(event.key==='ArrowDown'?1:-1)+visible.length)%visible.length;
      setActive();
    }else if(event.key==='Enter'){
      event.preventDefault();
      if(visible[activeIndex])activate(visible[activeIndex]);
    }
  });
  document.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
      event.preventDefault();
      if(dialog.open)closeDialog();
      else openDialog();
    } else if(event.key==='Escape'&&dialog.open) {
      closeDialog();
    }
  });
  dialog.addEventListener('click',event=>{
    if(event.target===dialog)closeDialog();
  });
  dialog.addEventListener('close',()=>{
    (previousFocus?.isConnected?previousFocus:trigger).focus({preventScroll:true});
    previousFocus=null;
  });
  window.AakashCommandPalette=Object.freeze({open:openDialog,close:closeDialog});
})();
