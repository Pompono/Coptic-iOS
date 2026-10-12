// Stretch luminance between robust dark/light percentiles, preserving antialias
// shades rather than thresholding small marks into solid bars. Work on a copy.
export function improveContrast(rgba) {
  const histogram = new Uint32Array(256), gray = new Uint8Array(rgba.length / 4);
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4;
    gray[i] = Math.round(.2126 * rgba[p] + .7152 * rgba[p + 1] + .0722 * rgba[p + 2]);
    histogram[gray[i]]++;
  }
  const percentile = fraction => {
    let total = 0;
    for (let i = 0; i < 256; i++) { total += histogram[i]; if (total >= gray.length * fraction) return i; }
    return 255;
  };
  const low = percentile(.01), high = percentile(.99), median = percentile(.5);
  const invert = median < 120 && high - median > 45;
  const result = new Uint8ClampedArray(rgba);
  for (let i = 0; i < gray.length; i++) {
    const value = high - low < 20 ? gray[i] : Math.max(0, Math.min(255, Math.round((gray[i] - low) * 255 / (high - low))));
    const output = invert ? 255 - value : value;
    result[i * 4] = result[i * 4 + 1] = result[i * 4 + 2] = output;
  }
  return result;
}
