import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.json':'application/json'};
const server=createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://127.0.0.1');
  const relative=decodeURIComponent(u.pathname).replace(/^\/+/,'')||'index.html';
  const full=resolve(join(root,relative));
  if(!full.startsWith(root+'/')) throw new Error('Bad path');
  const data=await readFile(full);
  res.writeHead(200,{'Content-Type':types[extname(full)]||'application/octet-stream'}).end(data);
 }catch(_){res.writeHead(404).end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1200,height:850}});
const origin='http://127.0.0.1:'+server.address().port;
try {
 await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded',timeout:30000});
 const trigger=page.locator('.aakash-command-trigger');
 await trigger.waitFor({timeout:15000});
 assert.equal(await trigger.isVisible(),true);
 await page.keyboard.press('Control+k');
 const dialog=page.locator('.aakash-command-dialog[open]');
 await dialog.waitFor({timeout:10000});
 await page.locator('#aakash-command-query').fill('RFID');
 const item=dialog.locator('.aakash-command-result').filter({hasText:'RFID Card Detection System'});
 assert.equal(await item.first().isVisible(),true);
 await page.keyboard.press('Escape');
 await dialog.waitFor({state:'hidden',timeout:5000});
 assert.equal(await page.locator('.aakash-command-dialog[open]').count(),0);
 await trigger.click();
 await page.locator('#aakash-command-query').fill('Fourier transform');
 await dialog.locator('.aakash-command-result').filter({hasText:'Ask Gemini'}).first().click();
 const assistant=page.locator('aakash-assistant dialog[open]');
 await assistant.waitFor({timeout:10000});
 assert.equal(await page.locator('aakash-assistant textarea').inputValue(),'Fourier transform');
 await page.locator('aakash-assistant .close').click();
 await page.goto(origin+'/test-centre/index.html',{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('.aakash-command-trigger').waitFor({timeout:15000});
 await page.keyboard.press('Control+k');
 assert.equal(await page.locator('.aakash-command-dialog[open]').count(),1);
 console.log('PASS: Ctrl+K, search, Escape, Ask Gemini prompt, and Test Centre navigation.');
} finally {
 try{await page.screenshot({path:'command-palette-browser.png',fullPage:true})}catch(_){}
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
