export function svgImageSource(value) {
  if (typeof value !== 'string' || value.length > 200000 ||
      !/^\s*<svg[\s>]/i.test(value) || !/<\/svg>\s*$/i.test(value)) return '';
  // SVG is decoded only as an image, never injected into the document.
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(value);
}

export function applyDigitizedRecord(entry, record) {
  const q = entry.question;
  if (!record || q.native || !Array.isArray(record.native) ||
      record.native.length !== (q.type === 'NAT' ? 1 : 5) ||
      !record.native.every(s => typeof s === 'string' && s.length <= 20000) ||
      !record.native[0].trim()) return false;
  const figure = svgImageSource(record.figureSvg);
  if (record.hasDiagram && !figure && !q.figure && record.usePrintedFigures !== true) return false;
  const options = Array.isArray(record.optionSvgs) && record.optionSvgs.length === 4
    ? record.optionSvgs.map(svgImageSource) : [];
  if (q.type !== 'NAT' && record.native.slice(1).some((s,i) => !s.trim() && !options[i])) return false;
  q.native = record.native.slice();
  q.digitized = true;
  if (record.usePrintedFigures === true) q.usePrintedFigures = true;
  if (figure && !q.figure) q.digitizedFigure = figure;
  if (options.some(Boolean)) q.digitizedOptions = options;
  return true;
}
