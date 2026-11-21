/* Read-only Firebase project configuration diagnostic.
   Only prints domain status. Never prints Firebase API key or user data. */
import {readFile} from 'node:fs/promises';
const config=JSON.parse(await readFile(new URL('../firebase-applet-config.json',import.meta.url)));
const url='https://identitytoolkit.googleapis.com/v1/projects?key='+encodeURIComponent(config.apiKey);
try {
 const response=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});
 if(!response.ok){
  console.log('FIREBASE_DOMAIN_CHECK_UNAVAILABLE: Public config API returned HTTP '+response.status+
    '. Check authorized domains manually in Firebase Console.');
 }else{
  const data=await response.json();
  const domains=Array.isArray(data.authorizedDomains)?data.authorizedDomains:[];
  const allowed=domains.includes('aakash9972sn.github.io');
  console.log(allowed
    ? 'FIREBASE_DOMAIN_OK: aakash9972sn.github.io is in authorized domains.'
    : 'FIREBASE_DOMAIN_ACTION_REQUIRED: add aakash9972sn.github.io under Firebase Authentication > Settings > Authorized domains.');
  console.log('FIREBASE_DOMAIN_COUNT: '+domains.length);
 }
}catch(error){
 console.log('FIREBASE_DOMAIN_CHECK_UNAVAILABLE: '+String(error?.name||'network-error')+
   '. Check Firebase Console Authentication settings.');
}
