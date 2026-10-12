export const MAX_REGIONS = 24;
const hasCoptic = text => /[\u2c80-\u2cff\u03e2-\u03ef]/u.test(text);

// Keep recognition order: a global y-sort would interleave separate columns.
// Group nearby lines within a paragraph, while keeping each request short.
export function textRegions(blocks, width, height) {
  if (!(width > 0 && height > 0)) throw new Error('Invalid image dimensions.');
  const regions = [];
  for (const block of blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      let group = [];
      const flush = () => {
        if (!group.length) return;
        const text = group.map(line => line.text.trim()).join('\n');
        const markedWords = [];
        let lineStart = 0;
        for (const line of group) {
          const lineText = line.text.trim();
          let search = lineStart;
          for (const word of line.words ?? []) {
            const written = word.text?.trim();
            if (!written) continue;
            const start = text.indexOf(written, search);
            if (start < lineStart || start + written.length > lineStart + lineText.length) continue;
            search = start + written.length;
            if (!/[\u0300\u0304\u0305]/u.test(written) || !word.bbox) continue;
            const box = word.bbox;
            const baseline = line.baseline;
            markedWords.push({ text: written, start,
              box: { x: box.x0 / width, y: box.y0 / height, width: (box.x1 - box.x0) / width, height: (box.y1 - box.y0) / height },
              baselineSlope: baseline?.has_baseline && baseline.x1 !== baseline.x0 ? (baseline.y1 - baseline.y0) / (baseline.x1 - baseline.x0) : 0 });
          }
          lineStart += lineText.length + 1;
        }
        const x0 = Math.max(0, Math.min(...group.map(line => line.bbox.x0)));
        const y0 = Math.max(0, Math.min(...group.map(line => line.bbox.y0)));
        const x1 = Math.min(width, Math.max(...group.map(line => line.bbox.x1)));
        const y1 = Math.min(height, Math.max(...group.map(line => line.bbox.y1)));
        if (hasCoptic(text) && x1 > x0 && y1 > y0) regions.push({
          id: `region-${regions.length + 1}`, text, originalText: text, markedWords,
          confidence: group.reduce((sum, line) => sum + line.confidence, 0) / group.length,
          box: { x: x0 / width, y: y0 / height, width: (x1 - x0) / width, height: (y1 - y0) / height },
        });
        group = [];
      };
      for (const line of paragraph.lines ?? []) {
        if (!line.text?.trim() || !hasCoptic(line.text)) { flush(); continue; }
        if (group.length >= 4 || [...group, line].map(item => item.text).join('\n').length > 600) flush();
        group.push(line);
      }
      flush();
    }
  }
  return { regions: regions.slice(0, MAX_REGIONS), omitted: Math.max(0, regions.length - MAX_REGIONS) };
}

export function cropBox(start, end) {
  const clamp = value => Math.max(0, Math.min(1, value));
  const x = clamp(Math.min(start.x, end.x));
  const y = clamp(Math.min(start.y, end.y));
  return { x, y, width: clamp(Math.max(start.x, end.x)) - x, height: clamp(Math.max(start.y, end.y)) - y };
}
