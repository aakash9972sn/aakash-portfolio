/* Production check of the public, separately hosted Render server.
   Sends no credentials, personal details or sensitive content.
   Shows truncated error responses; never emits keys. */
const base='https://aakash-portfolio-g3fb.onrender.com';
function check(ok,message){if(!ok)throw new Error(message)}
const common={headers:{Origin:'https://aakash9972sn.github.io'},signal:AbortSignal.timeout(60000)};
const health=await fetch(base+'/api/health',{...common,headers:{...common.headers,Accept:'application/json'}});
const ct=(health.headers.get('content-type')||'').toLowerCase();
check(health.status===200,'Health route returned HTTP '+health.status);
check(ct.includes('application/json'),'Health returned non-JSON: '+ct);
const data=await health.json();
check(data.ok===true,'Health is not ready');
check(data.configured===true,'Render GEMINI_API_KEY is not configured');
console.log('PASS: public Render backend JSON health ok; configured=true; model='+String(data.model||'not-reported'));
const cors=health.headers.get('access-control-allow-origin');
check(cors==='https://aakash9972sn.github.io',
  'GitHub Pages CORS origin not allowed: '+String(cors));
console.log('PASS: GitHub Pages cross-origin response allowed');
const message={question:'Reply exactly with the word READY.',history:[],pageContext:{page:'portfolio'}};
const ai=await fetch(base+'/api/ai/chat/stream',{
 method:'POST',headers:{...common.headers,'Content-Type':'application/json',Accept:'text/event-stream'},
 signal:AbortSignal.timeout(65000),body:JSON.stringify(message)
});
const type=ai.headers.get('content-type')||'';
const text=await ai.text();
if(ai.status!==200||!type.includes('text/event-stream')) {
 console.log('AI_RESPONSE_STATUS',ai.status,'CONTENT_TYPE',type);
 const sanitized=text.slice(0,350).replace(/AIza[A-Za-z0-9_-]+|AQ\.[A-Za-z0-9_-]+/g,'[redacted]');
 throw new Error('Real Gemini request failed: '+sanitized);
}
check(text.includes('data:'),'SSE stream contained no data events');
const events=text.split(/\r?\n/).filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()).filter(Boolean);
const parsed=events.map(raw=>{try{return JSON.parse(raw)}catch{return {invalid:true}}});
const pieces=parsed.filter(x=>typeof x.text==='string').map(x=>x.text);
const combined=pieces.join('').trim();
if(!combined) {
 console.log('STREAM_EVENTS',JSON.stringify(parsed.map(e=>({
   keys:Object.keys(e),error:typeof e.error==='string'?e.error.slice(0,180):undefined
 })).slice(0,10)).replace(/AIza[A-Za-z0-9_-]+|AQ\\.[A-Za-z0-9_-]+/g,'[redacted]'));
 throw new Error('Gemini SSE stream did not contain answer text');
}
console.log('PASS: real Gemini model streamed answer text, length '+combined.length);



// Test Centre live generation: one minimal GATE ECE question, no user data.
const mcq=await fetch(base+'/api/ai/study-mcq',{
  method:'POST',headers:{...common.headers,'Content-Type':'application/json',Accept:'application/json'},
  body:JSON.stringify({exam:'GATE ECE',subject:'Network Theory',topic:"Ohm's law",count:1,difficulty:'Foundation'}),
  signal:AbortSignal.timeout(75000)
});
const mcqType=mcq.headers.get('content-type')||'';
const rawMcq=await mcq.text();
if(mcq.status!==200||!mcqType.includes('application/json')) {
  const safe=rawMcq.slice(0,230).replace(/AIza[A-Za-z0-9_-]+|AQ\.[A-Za-z0-9_-]+/g,'[redacted]');
  throw new Error('Test Centre MCQ request HTTP '+mcq.status+': '+safe);
}
let generated;
try{generated=JSON.parse(rawMcq)}catch{throw new Error('Test Centre MCQ response was not JSON')}
check(Array.isArray(generated.questions)&&generated.questions.length===1,'No MCQ returned');
const q=generated.questions[0];
check(typeof q.q==='string'&&q.q.length>14,'MCQ missing question');
check(Array.isArray(q.options)&&q.options.length===4,'MCQ missing four options');
check(Number.isInteger(q.answerIndex)&&q.answerIndex>=0&&q.answerIndex<4,'MCQ answer index invalid');
check(typeof q.explanation==='string'&&q.explanation.length>10,'MCQ explanation missing');
console.log('PASS: real GATE ECE Test Centre AI MCQ generation with valid four-option answer');

// Verify one real doubt explanation using the generated question.
const doubt=await fetch(base+'/api/ai/study-doubt',{
  method:'POST',headers:{...common.headers,'Content-Type':'application/json',Accept:'application/json'},
  body:JSON.stringify({
    exam:'GATE ECE',subject:'Network Theory',question:q.q,options:q.options,
    correctIndex:q.answerIndex,selectedIndex:0,
    userDoubt:'Explain the correct option in one sentence.'
  }),
  signal:AbortSignal.timeout(75000)
});
const doubtType=doubt.headers.get('content-type')||'';
const rawDoubt=await doubt.text();
if(doubt.status!==200||!doubtType.includes('application/json')) {
  const safe=rawDoubt.slice(0,230).replace(/AIza[A-Za-z0-9_-]+|AQ\.[A-Za-z0-9_-]+/g,'[redacted]');
  throw new Error('Test Centre doubt HTTP '+doubt.status+': '+safe);
}
let explanation;
try{explanation=JSON.parse(rawDoubt)}catch{throw new Error('Doubt response was not JSON')}
check(typeof explanation.answer==='string'&&explanation.answer.length>12,'Gemini doubt explanation missing');
console.log('PASS: real Test Centre AI doubt explanation');


// CUET PG regression: study assistant must know this live catalogue.
const cuetChat=await fetch(base+'/api/ai/chat',{
  method:'POST',headers:{...common.headers,'Content-Type':'application/json',Accept:'application/json'},
  body:JSON.stringify({app:'study',question:'Does this Test Centre have CUET PG Life Sciences and Zoology PYPs? Answer with the subject names and total imported questions.',history:[],context:{cuetPg:{available:true,totalImportedPreviousYearQuestions:275}}}),
  signal:AbortSignal.timeout(65000)
});
check(cuetChat.status===200,'CUET study chat HTTP '+cuetChat.status);
const cuetData=await cuetChat.json();
check(/CUET/i.test(cuetData.answer||'')&&/275/.test(cuetData.answer||''),'CUET chat omitted available 275-question bank');
check(!/not (yet )?(listed|available|populated)/i.test(cuetData.answer||''),'CUET chat incorrectly claims unavailable');
console.log('PASS: study Gemini knows CUET PG PYPs are available');

// Check real CUET Life Sciences test generation, not just GATE questions.
const cuetMcq=await fetch(base+'/api/ai/study-mcq',{
  method:'POST',headers:{...common.headers,'Content-Type':'application/json',Accept:'application/json'},
  body:JSON.stringify({exam:'CUET PG',subject:'Life Sciences (SCQP17)',unit:'Biochemistry',syllabusSpec:'Enzymes, proteins, carbohydrates, lipids',count:2,difficulty:'Exam Standard'}),
  signal:AbortSignal.timeout(75000)
});
const cuetMcqBody=await cuetMcq.text();
check(cuetMcq.status===200,'CUET Life Sciences generator HTTP '+cuetMcq.status+': '+cuetMcqBody.slice(0,200));
const cuetMcqs=JSON.parse(cuetMcqBody).questions;
check(Array.isArray(cuetMcqs)&&cuetMcqs.length>=1,'CUET Life Sciences generated no valid MCQs');
check(cuetMcqs.every(q=>Array.isArray(q.options)&&q.options.length===4),'CUET MCQ options invalid');
console.log('PASS: real CUET PG Life Sciences AI MCQ generation');
