const {readFile} = require('node:fs/promises');
const path = require('node:path');
const outputSchema = {
  type:'OBJECT',
  properties:{
    native:{type:'ARRAY',items:{type:'STRING'}},
    hasDiagram:{type:'BOOLEAN'},
    usePrintedFigures:{type:'BOOLEAN'},
    figureSvg:{type:'STRING',nullable:true},
    optionSvgs:{type:'ARRAY',items:{type:'STRING',nullable:true},nullable:true}
  },
  required:['native','hasDiagram','usePrintedFigures']
};
const papers = [...require('../../test-centre/gate-pyp-index.json'), ...require('../../test-centre/gate-ee-index.json')];

// Only indexed, public exam images can be sent to the model.
function registerGateDigitizer(app, createClient, model) {
  const pending = new Map();
  const cache = new Map();
  async function transcribe(paper, index) {
    const batch = Math.floor(index / 8);
    const file = path.join(__dirname, '../../test-centre/gate-papers', paper.id + '-' + batch + '.json');
    const image = JSON.parse(await readFile(file, 'utf8'))[index % 8];
    const type = paper.questions[index].type;
    const response = await createClient().models.generateContent({
      model,
      contents: [{role:'user', parts:[
        {text:'Transcribe this ' + type + ' question verbatim. Return JSON with native (array of stem followed by four choices in printed order, stem only for NAT), hasDiagram (boolean), figureSvg (standalone SVG of a stem figure when present), optionSvgs (four SVG strings or null entries for option figures). Use delimited LaTeX in the stem and choice text. Inside SVG, use plain Unicode labels, fit all labels inside the viewBox, and reproduce the exact geometry, connections and dimensions. Preserve all printed labels and units. Never solve or include an answer key. Set usePrintedFigures to true if a diagram or graphical choice cannot be faithfully redrawn. In that case omit the uncertain SVG, transcribe the visible text, and refer to the corresponding printed option for a graphical choice. If the question text cannot be read, return an empty native array.'},
        {inlineData:{mimeType:'image/webp', data:image}}
      ]}],
      config:{
        responseMimeType:'application/json', responseSchema:outputSchema, maxOutputTokens:8192,
        httpOptions:{timeout:40000}, abortSignal:AbortSignal.timeout(40000)
      }
    });
    const {applyDigitizedRecord} = await import('../../test-centre/gate-transcription.mjs');
    const {native, hasDiagram, usePrintedFigures, figureSvg, optionSvgs} = JSON.parse(response.text);
    const record = {native, hasDiagram, figureSvg, optionSvgs};
    if (usePrintedFigures === true) record.usePrintedFigures = true;
    if (typeof hasDiagram !== 'boolean' || !applyDigitizedRecord({question:{type}}, record)) {
      throw new Error('Incomplete transcription');
    }
    return record;
  }

  app.post('/api/ai/gate-digitize', async (req, res) => {
    const {paperId, index, refresh} = req.body || {};
    const paper = papers.find(item => item.id === paperId);
    if (!paper || !Number.isInteger(index) || index < 0 || index >= paper.questions.length) {
      return res.status(400).json({error:'Select a question from the GATE archive.'});
    }
    const key = paper.id + '.' + index;
    try {
      if (!pending.has(key) && (refresh === true || !cache.has(key))) {
        if (pending.size >= 3) return res.status(429).json({error:'Transcription is busy. Try again shortly.'});
        const request = transcribe(paper, index).then(record => {
          if (cache.size >= 100) cache.delete(cache.keys().next().value);
          cache.set(key, record);
          return record;
        }).finally(() => pending.delete(key));
        pending.set(key, request);
      }
      return res.json(await (pending.get(key) || cache.get(key)));
    } catch (error) {
      const upstream = Number(error.status || error.code);
      const timeout = ['AbortError','TimeoutError'].includes(error.name) || [408,504].includes(upstream);
      const status = upstream === 429 ? 429 : timeout ? 504 : upstream === 503 ? 503 : 502;
      const incomplete = error instanceof SyntaxError || error.message === 'Incomplete transcription';
      const message = incomplete ? 'The AI returned an incomplete transcription.' :
        timeout ? 'Transcription timed out.' : status === 429 ? 'The AI request limit was reached.' :
        [400,403,404].includes(upstream) ? 'The model rejected the transcription request (HTTP ' + upstream + ').' :
        error.code === 'ENOENT' ? 'The server could not load this question image.' : 'The transcription service is unavailable.';
      console.warn('GATE transcription failed', {paperId, index, status, incomplete, upstream:upstream || null, errorType:error.name});
      return res.status(status).json({error:message + ' Use the printed question or retry.'});
    }
  });
}
module.exports = {registerGateDigitizer};
