import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(fileURLToPath(new URL('../', import.meta.url)));
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const http=createServer(async(req,res)=>{
 try {
  const relative=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/,'')||'index.html';
  const filename=resolve(join(root,relative));
  if(!filename.startsWith(root+'/')) throw Error('Unsafe file path');
  const body=await readFile(filename);
  res.writeHead(200,{'Content-Type':types[extname(filename)]||'application/octet-stream'}).end(body);
 }catch(_){res.writeHead(404).end('Not found');}
});
await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1350,height:900}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const authModule=[
 'const auth={currentUser:null,listeners:[]};',
 'export const browserLocalPersistence={type:"LOCAL"};',
 'export const inMemoryPersistence={type:"NONE"};',
 'export const getAuth=()=>auth;',
 'export async function setPersistence(){return true;}',
 'export function onAuthStateChanged(auth,success){auth.listeners.push(success); Promise.resolve().then(()=>success(auth.currentUser));return ()=>{auth.listeners=auth.listeners.filter(x=>x!==success)}}',
 'export class GoogleAuthProvider{setCustomParameters(){} addScope(){}}',
 'export async function signInWithPopup(auth){',
 'window.__mockPopupCalls=(window.__mockPopupCalls||0)+1;',
 'const user={uid:"mock-google-account",email:"student@example.com",emailVerified:true,displayName:"Student Account",photoURL:"",providerData:[{providerId:"google.com",displayName:"Student Account",email:"student@example.com",photoURL:""}]};',
 'auth.currentUser=user;for(const cb of [...auth.listeners])cb(user);return {user};',
 '}',
 'export async function signOut(auth){auth.currentUser=null;for(const cb of [...auth.listeners])cb(null)}'
].join('\n');
const firestoreModule=[
 'const docs=new Map();',
 'export function getFirestore(_app,id){window.__mockDbId=id;return {id}}',
 'export function doc(_db,...path){return {path:path.join("/")}}',
 'export function serverTimestamp(){return "mock-server-timestamp"}',
 'export async function getDoc(ref){const data=docs.get(ref.path);return {exists:()=>!!data,data:()=>data||{}}}',
 'export async function getDocFromServer(ref){return getDoc(ref)}',
 'export async function setDoc(ref,data){docs.set(ref.path,data);if(ref.path.includes("/testAttempts/"))window.__mockAttemptPath=ref.path}',
 'export async function updateDoc(ref,data){docs.set(ref.path,{...docs.get(ref.path),...data})}',
 'export function collection(_db,...path){return {path:path.join("/")}}',
 'export function query(ref){return ref}export function where(){return null}',
 'export async function getDocs(){return {docs:[]}}',
 'export async function runTransaction(_db,callback){return callback({get:getDoc,set(ref,data){docs.set(ref.path,data)},update(ref,data){docs.set(ref.path,{...docs.get(ref.path),...data})}})}',
].join('\n');
await page.route('https://www.gstatic.com/firebasejs/11.10.0/**',async route=>{
 const url=route.request().url();
 const app='export function getApps(){return []}export function initializeApp(config){window.__mockFirebaseConfig=config;return config}export function getApp(){return {}}';
 const body=url.endsWith('/firebase-app.js')?app:url.endsWith('/firebase-auth.js')?authModule:url.endsWith('/firebase-firestore.js')?firestoreModule:'';
 await route.fulfill({status:body?200:404,contentType:'text/javascript',
  headers:{'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'},body});
});
try {
 const origin='http://127.0.0.1:'+http.address().port;
 await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
 const switcher=page.locator('#home-theme-toggle');
 await switcher.waitFor({timeout:15000});
 const featured=page.locator('.silicon-spotlight');
 await featured.waitFor({timeout:10000});
 assert.match(await featured.locator('#spot-title').textContent(),/RFID/);
 await featured.getByRole('tab',{name:/02.*Test App/}).click();
 assert.match(await featured.locator('#spot-title').textContent(),/Test Centre/);
 await page.getByRole('button',{name:'Index',exact:true}).click();
 assert.equal(await page.locator('.projects-grid').evaluate(el=>el.classList.contains('is-compact')),true);
 await page.getByRole('button',{name:'Bento'}).click();
 assert.equal(await page.locator('.projects-grid').evaluate(el=>el.classList.contains('is-compact')),false);
 await page.getByRole('button',{name:'Embedded / RFID'}).click();
 assert.match(await page.locator('.projects-grid').textContent(),/RFID/);
 await page.locator('#work-search').fill('MFRC522');
 assert.match(await page.locator('#results-status').textContent(),/result/i);
 await switcher.click();
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
 await switcher.click();
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
 console.log('PASS: Light-theme default, reversible dark mode, featured tabs, RFID search and compact/Bento layouts.');

 const launcher=page.locator('.account-launcher');
 await launcher.waitFor({timeout:12000});
 await launcher.click();
 const dialog=page.locator('.account-panel[open]');
 await dialog.waitFor({timeout:8000});
 const signIn=dialog.locator('.account-google-btn');
 await signIn.waitFor({state:'visible',timeout:10000});
 await page.waitForFunction(()=>!document.querySelector('.account-google-btn')?.disabled,null,{timeout:12000});
 await signIn.click();
 await page.waitForFunction(()=>document.querySelector('.account-launcher')?.dataset.signedIn==='true',null,{timeout:12000});
 const result=await page.evaluate(()=>({
  dbId:window.__mockDbId,
  popupCalls:window.__mockPopupCalls,
  name:document.querySelector('.account-launcher-label')?.textContent,
  photoOrInitial:document.querySelector('.account-launcher-avatar')?.textContent?.trim()||document.querySelector('.account-launcher-avatar img')?.src
 }));
 assert.equal(result.popupCalls,1);
 assert.equal(result.dbId,'ai-studio-aakashportfolio-297b730c-ac6e-46a6-ab26-9a99d1551840');
 assert.equal(result.name,'Student');
 assert.ok(result.photoOrInitial);
 console.log('PASS: Mocked Google sign-in button, profile name/avatar and exact named Firestore database.');
 await page.goto(origin+'/test-centre/gate-test.html?mode=paper&set=EC2026',{waitUntil:'domcontentloaded'});
 await page.locator('#workbench').waitFor();
 await launcher.click();
 await dialog.locator('.account-google-btn').click();
 await page.waitForFunction(()=>window.AakashAccount.getState().signedIn);
 await dialog.getByRole('button',{name:'Close account dialog'}).click();
 await page.locator('#controls input[value="B"]').check();
 await page.locator('#submit').click();
 await page.locator('#confirm-yes').click();
 await page.waitForFunction(()=>window.__mockAttemptPath?.startsWith('users/mock-google-account/testAttempts/gate-'));
 assert.match(await page.locator('#score').textContent(),/^1 correct/);
 await launcher.click();
 await dialog.locator('.account-signout-btn').click();
 await page.waitForFunction(()=>!window.AakashAccount.getState().signedIn);
 assert.equal(await page.locator('#result').isVisible(),false);
 assert.match(await page.locator('#progress').textContent(),/^0 of 65/);
 console.log('PASS: signed-in GATE history sync and isolated guest attempt after sign-out.');
 if(errors.length)console.warn('Nonfatal page errors:',errors.slice(0,4));
} finally {
 try{await page.screenshot({path:'studio-light-auth-browser.png',fullPage:true})}catch(_){}
 await browser.close();await new Promise(resolve=>http.close(resolve));
}
