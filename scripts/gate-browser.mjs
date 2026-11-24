import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';

const require = createRequire(import.meta.url);
const server = createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
process.env.CORS_ORIGIN = origin;
const app = require('../server');
server.on('request', app);
const papers = require('../test-centre/gate-pyp-index.json');
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 20"><circle cx="10" cy="10" r="6"/></svg>';
let calls = 0;
app.locals.aiFactory = () => ({models:{generateContent:async request => {
  calls++;
  if (typeof request.contents === 'string') return {text:'Example explanation'};
  assert.equal(request.contents[0].parts[1].inlineData.mimeType, 'image/webp');
  return {text:JSON.stringify({native:['Evaluate \\(x^2\\)', '', 'Two', 'Three', 'Four'],
    hasDiagram:true, figureSvg:svg, optionSvgs:[svg,null,null,null]})};
}}});
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1280,height:900}});
page.setDefaultTimeout(9000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const base = origin + '/test-centre/';
async function open(url) {
  await page.goto(url, {waitUntil:'domcontentloaded'});
}
async function jump(index, mobile) {
  if (mobile) await page.locator('#palette-open').click();
  await page.locator('#palette button').nth(index).click();
}
try {
  // Same pinned MathJax distribution as the production CDN.
  await page.route('https://cdn.jsdelivr.net/npm/mathjax@3.2.2/**', route => {
    const path = new URL(route.request().url()).pathname.split('mathjax@3.2.2/')[1];
    return route.fulfill({path:require.resolve('mathjax/' + path),contentType:'text/javascript'});
  });
  await page.route('https://fonts.**/**', route => route.abort());
  for (const year of [2025,2026]) {
    const mobile = year === 2026;
    await page.setViewportSize({width:mobile ? 390 : 1280,height:850});
    await open(base + '?mode=paper&year=' + year + '#/gate-papers');
    await page.locator('#gate-results a').first().click();
    const paper = papers.find(item => item.year === year);
    await page.locator('#workbench').waitFor();
    const imageCount = await page.evaluate(async id => {
      let total = 0;
      for (let batch = 0; batch < 9; batch++) {
        const response = await fetch('gate-papers/' + id + '-' + batch + '.json');
        for (const raw of await response.json()) {
          const image = new Image();
          image.src = 'data:image/webp;base64,' + raw;
          await image.decode();
          if (image.naturalWidth && image.naturalHeight) total++;
        }
      }
      return total;
    },paper.id);
    assert.equal(imageCount,65);
    assert.equal(await page.locator('#palette button').count(), 65);
    const theme = await page.locator('html').getAttribute('data-theme');
    await page.locator('[data-theme-toggle]').click();
    assert.notEqual(await page.locator('html').getAttribute('data-theme'),theme);
    const q = paper.questions;
    const mcq = q.findIndex(item => item.type === 'MCQ' && item.answers.length);
    const msq = q.findIndex(item => item.type === 'MSQ' && item.answers.length);
    const nat = q.findIndex(item => item.type === 'NAT' && item.answers.length);
    await jump(mcq,mobile);
    await page.locator('#controls input[value="' + q[mcq].answers[0] + '"]').check();
    await page.locator('#flag').click();
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#controls input:checked').waitFor({state:'attached'});
    assert.equal(await page.locator('#flag').getAttribute('aria-pressed'),'true');
    await jump(msq,mobile);
    for (const letter of q[msq].answers[0]) await page.locator('#controls input[value="' + letter + '"]').check();
    await jump(nat,mobile);
    await page.getByLabel('Numerical answer').fill(String(q[nat].answers[0][0]));
    if (mobile) await page.locator('#palette-open').click();
    await page.locator('#submit').click();
    await page.locator('#confirm-yes').click();
    await page.locator('#result').waitFor();
    assert.match(await page.locator('#score').textContent(), /^3 correct/);
    assert.match(await page.locator('#marks').textContent(), /Deductions 0/);
    const filter = page.getByLabel('Filter questions by outcome');
    await filter.selectOption('correct');
    assert.equal(await page.locator('#palette button:not([hidden])').count(),3);
    await filter.selectOption('skipped');
    assert.match(await page.locator('#feedback').textContent(), /Skipped/);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#result').waitFor();
    const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('tclab.analysis.history.v1')));
    const history = rows.filter(row => row.gate?.set === paper.id);
    assert.equal(history.length,1);
    const marks = q[mcq].marks + q[msq].marks + q[nat].marks;
    assert.equal(history[0].score,marks);
    await page.locator('#retake').click();
    await page.locator('#confirm-yes').click();
    await page.locator('#result').waitFor({state:'hidden'});
    assert.match(await page.locator('#progress').textContent(), /^0 of 65/);
    await open(base + 'gate-test.html?' + new URLSearchParams(history[0].gate));
    await page.locator('#result').waitFor();
    assert.match(await page.locator('#score').textContent(), /^3 correct/);
    assert.equal(await page.locator('#retake').isVisible(),false);
    console.log('PASS',year,'paper, MCQ/MSQ/NAT, resume, submit, review, history and retake');
  }
  // Use an older paper so the test exercises on-demand AI even with both bundled datasets installed.
  await page.setViewportSize({width:1280,height:900});
  const old = papers.find(p => p.id === 'EC2024');
  const index = old.questions.findIndex(q => q.type === 'MCQ' && !q.native);
  await open(base + 'gate-test.html?mode=paper&set=EC2024');
  await jump(index,false);
  assert.equal(calls,0);
  await page.locator('#digitize').click();
  await page.locator('#prompt mjx-container').waitFor();
  await page.waitForFunction(() => document.querySelector('#controls img')?.naturalWidth > 0);
  await page.locator('#prompt summary').last().click();
  await page.getByRole('button',{name:'Enlarge image',exact:true}).click();
  await page.locator('#image-fit').click();
  await page.keyboard.press('Escape');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#prompt mjx-container').waitFor();
  assert.equal(calls,1);
  await page.locator('#digitize').click();
  await page.waitForFunction(() => !document.getElementById('digitize').disabled);
  assert.equal(calls,2);
  await page.locator('#submit').click();
  await page.locator('#confirm-yes').click();
  await page.locator('#explain').click();
  await page.waitForFunction(() => document.getElementById('ai-note').textContent.includes('Example explanation'));
  for (const mode of ['topic','unit']) {
    await open(base + '?mode=' + mode + '&year=2026#/gate-papers');
    await page.locator('#gate-results a').first().click();
    await page.locator('#workbench').waitFor();
    assert.equal(await page.locator('#timer').textContent(),'Untimed practice');
  }
  // A timed historical paper uses a quarter-mark penalty and linked-question rules.
  const legacy = papers.find(item => item.year === 2008);
  await open(base + 'gate-test.html?mode=paper&set=' + legacy.id);
  const wrong = legacy.questions.findIndex(q => q.answers.length && !q.linkedPrevious && q.type === 'MCQ');
  await jump(wrong,false);
  await page.locator('#controls input[value="' + [...'ABCD'].find(x => !legacy.questions[wrong].answers.includes(x)) + '"]').check();
  await page.evaluate(() => {
    const key = 'tclab.gate.attempt.v1.' + JSON.stringify(['paper','EC2008','']);
    const attempt = JSON.parse(localStorage.getItem(key));
    attempt.deadline = Date.now() + 4000;
    localStorage.setItem(key,JSON.stringify(attempt));
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#timer.low-time').waitFor();
  await page.locator('#result').waitFor();
  assert.match(await page.locator('#marks').textContent(),new RegExp('Deductions ' + legacy.questions[wrong].marks / 4));
  assert.match(await page.locator('#breakdown').textContent(),/dependent on a preceding answer/);
  console.log('PASS all 130 original question images, theme switch, timer warning, expiry and historical deductions');
  assert.deepEqual(errors,[]);
  console.log('PASS transcript cache, manual refresh, MathJax, SVG stem/options, original zoom, AI explanation and practice modes');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
