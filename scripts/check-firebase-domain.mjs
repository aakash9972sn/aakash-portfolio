/* Read-only Firebase OAuth domain diagnostic.
   Does NOT expose Firebase web API key, credentials, account info or other project domains.
   Check both actual public portfolio origins, not only the GitHub hostname. */
import { readFile } from 'node:fs/promises';
const cfg = JSON.parse(await readFile(new URL('../firebase-applet-config.json',import.meta.url)));
const expected = [
  { label: 'GitHub Pages', host: 'aakash9972sn.github.io',
    configUrl:'https://aakash9972sn.github.io/aakash-portfolio/firebase-applet-config.json' },
  { label: 'Render direct URL', host: 'aakash-portfolio-g3fb.onrender.com',
    configUrl:'https://aakash-portfolio-g3fb.onrender.com/firebase-applet-config.json' }
];
const url = 'https://identitytoolkit.googleapis.com/v1/projects?key='+
  encodeURIComponent(cfg.apiKey);
let authorized=[];
try{
  const result=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});
  if(!result.ok) throw new Error('Identity Toolkit HTTP '+result.status);
  const project=await result.json();
  authorized=Array.isArray(project.authorizedDomains)?project.authorizedDomains:[];
  console.log('FIREBASE_PROJECT:',cfg.projectId,' AUTH_DOMAIN:',cfg.authDomain);
  for(const site of expected){
    const isAllowed=authorized.includes(site.host);
    console.log('AUTHORIZED_DOMAIN',site.label,site.host,isAllowed?'YES':'NO');
  }
  console.log('FIREBASE_AUTH_DOMAIN_AUTHORIZED:',authorized.includes(cfg.authDomain)?'YES':'NO');
}catch(error){
  console.log('FIREBASE_AUTH_DIAGNOSTIC_UNAVAILABLE:',error.message);
}
for(const site of expected) {
  try{
    const res=await fetch(site.configUrl,{
      cache:'no-store',
      headers:{Accept:'application/json'},
      signal:AbortSignal.timeout(20000)
    });
    const contentType=res.headers.get('content-type')||'';
    if(!res.ok || !contentType.includes('json')){
      console.log('LIVE_CONFIG',site.label,'HTTP',res.status,'type',contentType.slice(0,40));
      continue;
    }
    const live=await res.json();
    // Compare secret-free boolean and project identifiers ONLY. NEVER print API key.
    console.log('LIVE_CONFIG',site.label, 'MATCHES_REPO',
      live.apiKey===cfg.apiKey&&live.projectId===cfg.projectId&&live.authDomain===cfg.authDomain?'YES':'NO',
      'projectId',String(live.projectId||'missing').slice(0,65),
      'authDomain',String(live.authDomain||'missing').slice(0,95));
  }catch(error){console.log('LIVE_CONFIG',site.label,'UNAVAILABLE:',error.name);}
}
