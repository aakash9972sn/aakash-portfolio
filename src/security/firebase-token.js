'use strict';
// Verify Firebase RS256 ID tokens without a platform-specific Admin SDK.
// Never trust UID, name, or email submitted in a request body.
const {createPublicKey,verify}=require('node:crypto');
const project=process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0580718541';
const jwksURL='https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let keys=null, expires=0;
function b64(str){return Buffer.from(str.replace(/-/g,'+').replace(/_/g,'/'),'base64');}
async function getKeys() {
 if(keys&&Date.now()<expires)return keys;
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),6000);
 try {
  const r=await fetch(jwksURL,{signal:controller.signal});
  if(!r.ok)throw Error('Firebase public key service unavailable');
  const obj=await r.json();
  if(!Array.isArray(obj.keys))throw Error('Invalid Firebase public keys');
  keys=obj.keys;
  const ttl=/max-age=(\d+)/.exec(r.headers.get('cache-control')||'');
  expires=Date.now()+Math.min(3600,Number(ttl?.[1]||900))*1000;
  return keys;
 } finally {clearTimeout(timeout);}
}
async function verifyFirebaseIdToken(req){
 const token=(req.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(token.length<50||token.length>6000||token.split('.').length!==3)throw Object.assign(Error('Firebase sign-in required'),{status:401});
 const [header,payload,signature]=token.split('.');
 let h,p;
 try{h=JSON.parse(b64(header));p=JSON.parse(b64(payload));}
 catch{throw Object.assign(Error('Invalid Firebase token'),{status:401});}
 const now=Math.floor(Date.now()/1000);
 if(h.alg!=='RS256'||typeof h.kid!=='string'||p.aud!==project||
   p.iss!=='https://securetoken.google.com/'+project||
   typeof p.sub!=='string'||!p.sub||p.sub.length>128||
   !Number.isFinite(p.exp)||p.exp<=now||
   !Number.isFinite(p.iat)||p.iat>now+60||p.auth_time>now+60)
   throw Object.assign(Error('Invalid or expired Firebase token'),{status:401});
 const key=(await getKeys()).find(x=>x.kid===h.kid&&x.kty==='RSA');
 if(!key||!verify('RSA-SHA256',Buffer.from(header+'.'+payload),createPublicKey({key,format:'jwk'}),b64(signature)))
   throw Object.assign(Error('Firebase signature verification failed'),{status:401});
 return{uid:p.sub,name:String(p.name||'Learner').slice(0,80),email:p.email||null,verified:p.email_verified===true};
}
module.exports={verifyFirebaseIdToken};
