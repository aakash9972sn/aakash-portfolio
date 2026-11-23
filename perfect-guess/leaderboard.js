/* Public Perfect Guess leaderboard: consent-based and client-reported. */
(()=>{
'use strict';
const status=document.getElementById('pg-leaderboard-status');
const list=document.getElementById('pg-leaderboard-list');
const share=document.getElementById('pg-share-best');
if(!status||!list||!share)return;
let available=false;
async function refresh(){
 const url=(window.API_BASE_URL||'')+'/api/leaderboard/perfect-guess?limit=12';
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(10000),cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Leaderboard unavailable');
  available=data.available===true;
  list.replaceChildren();
  if(!available){status.textContent='Public leaderboard is not configured (DATABASE_URL missing). Your private score is safe.';return}
  status.textContent='Client-reported scores · not independently verified';
  for(const entry of data.leaders||[]){
   const li=document.createElement('li');
   const name=document.createElement('b'),score=document.createElement('strong');
   name.textContent=String(entry.display_name||'Player').slice(0,80);
   score.textContent=String(entry.best_score)+' guesses';
   li.append(name,score);list.appendChild(li);
  }
  if(!list.children.length)status.textContent='Leaderboard is empty. You can share a personal best if you want.';
 }catch(e){available=false;status.textContent='Public scores unavailable. Your local and Firebase best continue working.'}
 updateButton();
}
function updateButton(){
 const signedIn=Boolean(window.AakashAccount?.getState?.()?.signedIn);
 const best=Number(localStorage.getItem('bestScore'));
 share.disabled=!available||!signedIn||!Number.isInteger(best)||best<1;
 share.title=!signedIn?'Sign in with Google to share':!available?'PostgreSQL not configured':'Publish your current best';
}
share.addEventListener('click',async()=>{
 const token=await window.AakashAccount?.getIdToken?.();
 const best=Number(localStorage.getItem('bestScore'));
 if(!token||!Number.isInteger(best)||best<1){status.textContent='Sign in and finish a round before sharing.';return}
 share.disabled=true;
 status.textContent='Publishing your client-reported best…';
 try{
  const response=await fetch((window.API_BASE_URL||'')+'/api/leaderboard/perfect-guess',{
   method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
   body:JSON.stringify({score:best}),
   signal:AbortSignal.timeout(12000)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'Could not publish.');
  await refresh();
  status.textContent='Best shared publicly (client-reported). Your private score remains synced.';
 }catch(e){status.textContent='Could not share: '+(e.message||e)}
 finally{updateButton()}
});
window.addEventListener('aakash:account-state',updateButton);
window.addEventListener('storage',updateButton);
document.getElementById('new-round-btn')?.addEventListener('click',updateButton);
document.getElementById('guess-form')?.addEventListener('submit',()=>setTimeout(updateButton,30));
refresh();
})();
