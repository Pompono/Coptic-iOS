export function passageSegments(text) {
  const value = String(text ?? '').trim();
  if (!value) throw new Error('Enter Coptic text to translate.');
  if (value.length > 1200) throw new Error('On-device translation supports passages up to 1,200 characters.');
  const pieces = [];
  // Keep wrapped lines and colons inside a clause. Avoid lookbehind so this
  // also parses in older supported WebViews.
  for (const paragraph of value.split(/\n\s*\n/u)) {
    let start = 0;
    for (const match of paragraph.matchAll(/[.!?⳹⳺]\s+/gu)) {
      pieces.push(paragraph.slice(start, match.index + 1).trim());
      start = match.index + match[0].length;
    }
    pieces.push(paragraph.slice(start).trim());
  }
  return pieces.filter(Boolean);
}
