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

export function applyDigitizedRecord(entry, raw) {
  const q = entry.question;
  const record = printedOnlyRecord(raw);
  if (!record || q.native || record.native.length !== (q.type === 'NAT' ? 1 : 5) ||
      !record.native.every(s => typeof s === 'string' && s.length <= 20000) ||
      !record.native[0].trim()) return false;
  if (record.hasDiagram && !q.figure && !record.usePrintedFigures) return false;
  if (q.type !== 'NAT' && record.native.slice(1).some(s=>!s.trim())) return false;
  q.native = record.native.slice();
  q.digitized = true;
  // Show the original open for every graphical or uncertain transcription.
  if (record.hasDiagram || record.usePrintedFigures) q.usePrintedFigures = true;
  return true;
}
