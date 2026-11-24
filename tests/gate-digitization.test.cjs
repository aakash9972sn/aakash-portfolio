'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'test-centre');
const load = filename => import('data:text/javascript;base64,' + fs.readFileSync(path.join(root, filename)).toString('base64'));
const svg = '<svg xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="0" x2="10" y2="10"/></svg>';
const make = (type = 'MCQ') => ({question:{type, answers:type === 'NAT' ? [[1,2]] : ['A'], marks:2}});
const sample = {native:['Stem','A','B','C','D'],hasDiagram:true,figureSvg:svg};

test('digitized MCQ preserves official scoring metadata', async () => {
  const {applyDigitizedRecord} = await load('gate-digitization.js');
  const entry = make();
  assert.equal(applyDigitizedRecord(entry, sample), true);
  assert.deepEqual(entry.question.answers,['A']);
  assert.equal(entry.question.marks,2);
  assert.match(entry.question.digitizedFigure,/^data:image\/svg\+xml/);
});
test('valid NAT and diagram-only options are supported', async () => {
  const {applyDigitizedRecord} = await load('gate-digitization.js');
  assert.equal(applyDigitizedRecord(make('NAT'),{native:['Calculate'],hasDiagram:false}),true);
  assert.equal(applyDigitizedRecord(make(),{native:['Stem','','B','C','D'],optionSvgs:[svg,null,null,null]}),true);
});
test('incomplete transcription cannot replace original content', async () => {
  const {applyDigitizedRecord,svgImageSource} = await load('gate-digitization.js');
  const entry = make();
  entry.question.native = ['Original'];
  assert.equal(applyDigitizedRecord(entry,sample),false);
  assert.deepEqual(entry.question.native,['Original']);
  for (const record of [{native:['Missing choices']},{native:sample.native,hasDiagram:true},{native:['Stem','','B','C','D']}]) {
    const fresh = make();
    assert.equal(applyDigitizedRecord(fresh,record),false);
    assert.equal(fresh.question.native,undefined);
  }
  const printed = make();
  assert.equal(applyDigitizedRecord(printed,{native:sample.native,hasDiagram:true,usePrintedFigures:true}),true);
  assert.equal(printed.question.usePrintedFigures,true);
  assert.equal(svgImageSource('<html>bad</html>'),'');
});
for (const id of ['EC2025','EC2026']) {
  const filename = path.join(root,'gate-digitized',id+'.json');
  test(id+' dataset covers all questions with original or imported native text', {skip:!fs.existsSync(filename) ? 'Upload the original AI Studio JSON dataset first' : false}, async () => {
    const {applyDigitizedRecord} = await load('gate-digitization.js');
    const papers = JSON.parse(fs.readFileSync(path.join(root,'gate-pyp-index.json'),'utf8'));
    const paper = papers.find(p => p.id === id);
    const records = JSON.parse(fs.readFileSync(filename,'utf8'));
    assert.ok(paper);
    assert.equal(paper.questions.length,65);
    let imported=0;
    for (const [index,q] of paper.questions.entries()) {
      const question=structuredClone(q);
      if (!question.native) {
        assert.equal(applyDigitizedRecord({question},records[String(index)]),true,'Invalid record: '+id+' index '+index);
        imported++;
      }
      assert.ok(question.native);
      assert.deepEqual(question.answers,q.answers);
      assert.equal(question.marks,q.marks);
    }
    assert.equal(imported,id==='EC2025'?63:62);
  });
}

test('concurrent transcription requests share an inference and refresh preserves the last valid result', async () => {
  const {registerGateDigitizer} = require('../src/services/gate-digitizer');
  const express = require('express');
  const app = express();
  app.use(express.json());
  let calls = 0;
  let release;
  let started;
  const first = new Promise(resolve => { started = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const generateContent = async () => {
    calls++;
    started();
    await gate;
    return {text:JSON.stringify(calls === 1 ? sample : {})};
  };
  registerGateDigitizer(app, () => ({models:{generateContent}}), 'test');
  const server = app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const send = body => fetch('http://127.0.0.1:' + server.address().port + '/api/ai/gate-digitize', {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
  });
  const question = {paperId:'EC2026',index:1};
  try {
    assert.equal((await send({...question,index:65})).status,400);
    const pending = send(question);
    await first;
    const duplicate = send(question);
    release();
    for (const response of await Promise.all([pending,duplicate])) {
      assert.deepEqual(await response.json(),sample);
    }
    assert.equal(calls,1);
    assert.equal((await send({...question,refresh:true})).status,502);
    assert.deepEqual(await (await send(question)).json(),sample);
    assert.equal(calls,2);
  } finally {
    release();
    await new Promise(resolve => server.close(resolve));
  }
});
