export function svgImageSource(value) {
  if (typeof value !== 'string' || value.length > 200000 ||
      !/^\s*<svg[\s>]/i.test(value) || !/<\/svg>\s*$/i.test(value)) return '';
  // SVG is decoded only as an image, never injected into the document.
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(value);
}

// Legacy Studio SVG fields are evidence that printed graphics are required,
// never image sources. The original question remains authoritative.
export function printedOnlyRecord(record) {
  if (!record || !Array.isArray(record.native)) return null;
  const options = Array.isArray(record.optionSvgs) ? record.optionSvgs : [];
  const hasGraphics = Boolean(record.hasDiagram || record.figureSvg || options.some(Boolean));
  const usePrintedFigures = record.usePrintedFigures === true || Boolean(record.figureSvg || options.some(Boolean));
  const native = record.native.map((s,i) =>
    i>0 && typeof s==='string' && !s.trim() && (usePrintedFigures || options[i-1])
      ? 'See printed option ' + 'ABCD'[i-1] : s);
  return {native, hasDiagram:hasGraphics, usePrintedFigures};
}

// Catch broken delimiters and unbalanced groups before an on-demand transcript
// can replace readable text in an attempt or enter the persistent cache.
function balancedMath(text) {
  let close = '', depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') {
      const next = text[++i];
      if (next === '(' || next === '[') {
        if (close) return false;
        close = next === '(' ? ')' : ']';
      } else if (next === ')' || next === ']') {
        if (close !== next || depth) return false;
        close = '';
      }
    } else if (close && c === '{') depth++;
    else if (close && c === '}' && --depth < 0) return false;
  }
  return !close && !depth;
}

export function applyDigitizedRecord(entry, raw, published = false) {
  const q = entry.question;
  // Only the published bank can refer to checked-in crops of this question.
  const ink = published && Array.isArray(raw?.ink) ? raw.ink : [];
  const files = ink.map((filename, i) => {
    const expected = entry.paper.id + '-Q' + (entry.index + 1) + '-' + (i ? 'ABCD'[i-1] : 'stem') + '.webp';
    return i <= 4 && filename === expected ? 'gate-digitized/ink/' + expected : null;
  });
  const hasCrops = (files.length === 1 && !!files[0]) ||
    (files.length === 5 && files.slice(1).every(Boolean));
  const record = printedOnlyRecord(raw);
  if (published && Number.isInteger(raw?.printHeight) && raw.printHeight > 0) q.printHeight = raw.printHeight;
  if (!record || q.native || record.native.length !== (q.type === 'NAT' ? 1 : 5) ||
      !record.native.every(s => typeof s === 'string' && s.length <= 20000 && balancedMath(s)) ||
      !record.native[0].trim()) return false;
  if (record.hasDiagram && !q.figure && !record.usePrintedFigures && !hasCrops) return false;
  if (q.type !== 'NAT' && record.native.slice(1).some((s,i) => !s.trim() && !(hasCrops && files[i+1]))) return false;
  q.native = record.native.slice();
  q.digitized = true;
  if (hasCrops) {
    if (files[0]) q.figure = {file:files[0], alt:'Diagram from the original printed question'};
    if (files.length === 5) q.printedOptions = files.slice(1);
  } else if (record.hasDiagram || record.usePrintedFigures) {
    q.usePrintedFigures = true;
  }
  if (published) q.publishedTranscript = {native:q.native, usePrintedFigures:!!q.usePrintedFigures};
  return true;
}
