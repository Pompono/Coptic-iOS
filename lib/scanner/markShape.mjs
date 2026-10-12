export function reviewableMarks(current, original) {
  if (current.length !== original.length) return false;
  const marks = new Set(['\u0300', '\u0304', '\u0305']);
  for (let index = 0; index < current.length; index++) {
    if (current[index] !== original[index] && !(marks.has(current[index]) && marks.has(original[index]))) return false;
  }
  return true;
}

// Image geometry offers evidence, not a linguistic verdict. Short horizontal
// marks can be either jinkem or abbreviation bars, so leave those undecided.
export function classifyMarkComponents(components, word, baselineSlope = 0) {
  if (!components.length) return { kind: 'uncertain', reason: 'No separate mark could be isolated from the photograph.' };
  const tallest = Math.max(...components.map(component => component.height));
  const letters = components.filter(component => component.height >= tallest * .55 && component.area >= 8);
  if (!letters.length) return { kind: 'uncertain', reason: 'The letters and marks could not be separated reliably.' };
  const bodyTop = letters.map(component => component.y).sort((a, b) => a - b)[Math.floor(letters.length / 2)];
  const widths = letters.map(component => component.width).sort((a, b) => a - b);
  const letterWidth = widths[Math.floor(widths.length / 2)];
  const marks = components.filter(component => component.area >= 3 && component.height < tallest * .4 && component.y + component.height <= bodyTop + tallest * .08);
  const plain = word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}]/gu, '');
  if (['ⲓⲥ', 'ⲓⲏⲥ', 'ⲭⲥ', 'ⲡⲭⲥ', 'ⲡⲛⲁ'].includes(plain)) return {
    kind: 'uncertain', reason: 'This resembles a common sacred-name abbreviation. Short bars can be genuine here; check the photograph and context.' };
  if (marks.length === 1) {
    const mark = marks[0];
    const slope = Math.abs(mark.slope - baselineSlope);
    if (mark.width >= letterWidth * 1.8 && mark.width / mark.height >= 5 && slope < .15)
      return { kind: 'overline-like', reason: 'The photographed mark is long and nearly horizontal, spanning more than one letter width.' };
    if (mark.width >= 5 && mark.width <= letterWidth * 1.3 && slope >= .25 && mark.height >= 3)
      return { kind: 'jinkem-like', reason: 'The photographed mark is short and slanted relative to the text baseline.' };
  }
  return { kind: 'uncertain', reason: 'The mark is short, connected, blurred, or ambiguous. Its shape alone cannot establish whether it is jinkem or an abbreviation bar.' };
}

export function inkComponents(gray, width, height) {
  const histogram = new Uint32Array(256);
  for (const value of gray) histogram[value]++;
  let totalSum = 0;
  for (let value = 0; value < 256; value++) totalSum += value * histogram[value];
  let background = 0, sum = 0, variance = -1, threshold = 127;
  for (let value = 0; value < 255; value++) {
    background += histogram[value]; sum += value * histogram[value];
    const foreground = gray.length - background;
    if (!background || !foreground) continue;
    const score = background * foreground * (sum / background - (totalSum - sum) / foreground) ** 2;
    if (score > variance) { variance = score; threshold = value; }
  }
  if (variance <= 0) return [];
  const visited = new Uint8Array(gray.length);
  const queue = new Int32Array(gray.length);
  const components = [];
  for (let start = 0; start < gray.length; start++) {
    if (visited[start] || gray[start] > threshold) continue;
    let read = 0, write = 1; queue[0] = start; visited[start] = 1;
    let x0 = width, y0 = height, x1 = 0, y1 = 0;
    while (read < write) {
      const pixel = queue[read++], x = pixel % width, y = Math.floor(pixel / width);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const next = ny * width + nx;
        if (!visited[next] && gray[next] <= threshold) { visited[next] = 1; queue[write++] = next; }
      }
    }
    let leftY = 0, leftN = 0, rightY = 0, rightN = 0;
    for (let index = 0; index < write; index++) {
      const x = queue[index] % width, y = Math.floor(queue[index] / width);
      if (x <= x0 + (x1 - x0) / 3) { leftY += y; leftN++; }
      if (x >= x1 - (x1 - x0) / 3) { rightY += y; rightN++; }
    }
    components.push({ x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, area: write,
      slope: leftN && rightN ? (rightY / rightN - leftY / leftN) / Math.max(1, (x1 - x0) * 2 / 3) : 0 });
  }
  return components;
}
