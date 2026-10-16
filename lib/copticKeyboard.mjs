// Shared Coptic keyboard data and text editing helpers. Kept framework-free so
// keyboard behavior can be exercised directly by Node tests.
export const COPTIC_CASE_MAP = Object.freeze({
  "Ϧ": "ϧ", "ϧ": "Ϧ", "Ⲁ": "ⲁ", "ⲁ": "Ⲁ", "Ⲃ": "ⲃ", "ⲃ": "Ⲃ", "Ⲅ": "ⲅ", "ⲅ": "Ⲅ",
  "Ⲇ": "ⲇ", "ⲇ": "Ⲇ", "Ⲉ": "ⲉ", "ⲉ": "Ⲉ", "Ⲍ": "ⲍ", "ⲍ": "Ⲍ", "Ⲏ": "ⲏ", "ⲏ": "Ⲏ",
  "Ⲑ": "ⲑ", "ⲑ": "Ⲑ", "Ⲓ": "ⲓ", "ⲓ": "Ⲓ", "Ⲕ": "ⲕ", "ⲕ": "Ⲕ", "Ⲗ": "ⲗ", "ⲗ": "Ⲗ",
  "Ⲙ": "ⲙ", "ⲙ": "Ⲙ", "Ⲛ": "ⲛ", "ⲛ": "Ⲛ", "Ⲝ": "ⲝ", "ⲝ": "Ⲝ", "Ⲟ": "ⲟ", "ⲟ": "Ⲟ",
  "Ⲡ": "ⲡ", "ⲡ": "Ⲡ", "Ⲣ": "ⲣ", "ⲣ": "Ⲣ", "Ⲥ": "ⲥ", "ⲥ": "Ⲥ", "Ⲧ": "ⲧ", "ⲧ": "Ⲧ",
  "Ⲩ": "ⲩ", "ⲩ": "Ⲩ", "Ⲫ": "ⲫ", "ⲫ": "Ⲫ", "Ⲭ": "ⲭ", "ⲭ": "Ⲭ", "Ⲯ": "ⲯ", "ⲯ": "Ⲯ",
  "Ⲱ": "ⲱ", "ⲱ": "Ⲱ", "Ϣ": "ϣ", "ϣ": "Ϣ", "Ϥ": "ϥ", "ϥ": "Ϥ", "Ϩ": "ϩ", "ϩ": "Ϩ",
  "Ϫ": "ϫ", "ϫ": "Ϫ", "Ϭ": "ϭ", "ϭ": "Ϭ", "Ϯ": "ϯ", "ϯ": "Ϯ",
});

const special = (key, label) => label ? { key, label } : { key };
export const COPTIC_KEYBOARD_LAYOUTS = Object.freeze({
  ABC: [
    ["ϧ", "ⲱ", "ⲉ", "ⲣ", "ⲧ", "ⲏ", "ⲩ", "ⲓ", "ⲟ", "ⲡ"],
    ["ⲁ", "ϣ", "ⲇ", "ⲫ", "ⲅ", "ϩ", "ϫ", "ⲕ", "ⲗ", "ⲑ"],
    ["ⲍ", "ⲝ", "ⲥ", "ϥ", "ⲃ", "ⲛ", "ⲙ", "ⲭ"],
    [special("shift"), "ⲯ", "ϭ", "ϯ", special("backspace")],
    [special("toNumbers", "ⲁ̅ⲃ̅ⲅ̅"), "̀", special("space"), special("return")],
  ],
  NUMBERS: [
    ["ⲁ̅", "ⲃ̅", "ⲅ̅", "ⲇ̅", "ⲉ̅", "ⲋ̅", "ⲍ̅", "ⲏ̅", "ⲑ̅", "ⲓ̅"],
    ["ⲕ̅", "ⲗ̅", "ⲙ̅", "ⲛ̅", "ⲝ̅", "ⲟ̅", "ⲡ̅", "ϥ̅", "ⲣ̅"],
    ["ⲥ̅", "ⲧ̅", "ⲩ̅", "ⲫ̅", "ⲭ̅", "ⲯ̅", "ⲱ̅", "ϣ̅", special("backspace")],
    [".", "⳾", ":", "–", "⸗", special("backspace")],
    [special("toSymbols", "#+="), special("toABC", "ⲁ̅ⲃ̅ⲅ̅"), special("space"), special("return")],
  ],
  SYMBOLS: [
    ["̈", "॓", "̂", "︤", "̄", "︥", "̅", "̿", "̇", "̣"],
    ["́", "̑", "͡", "⳽", "𐋠", "⳰", "⳯", "⳱", "︦", "⸗"],
    ["[", "]", "{", "}", "(", ")", "^", "*", "+", "=", special("backspace")],
    ["|", "~", "-", "_", "<", ">", "”", "’", "!", "?"],
    [special("toABC", "ⲁ̅ⲃ̅ⲅ̅"), ";", ":", "@", "#", "&", ",", ".", "$", "\\", "/", "%", special("space"), special("return")],
  ],
});

export const isCopticKey = key => Object.hasOwn(COPTIC_CASE_MAP, key);
export const applyCopticCase = key => COPTIC_CASE_MAP[key] ?? key;

export function removePreviousGrapheme(value) {
  if (!value) return value;
  if (typeof Intl.Segmenter === "function") {
    const segments = Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value));
    return segments.slice(0, -1).map(segment => segment.segment).join("");
  }
  const points = Array.from(value);
  let start = points.length - 1;
  while (start > 0 && /[\p{Mark}\uFE00-\uFE0F]/u.test(points[start])) start--;
  points.splice(start);
  return points.join("");
}

export function editTextAtSelection(value, selectionStart, selectionEnd, insertedText) {
  let start = selectionStart;
  const end = selectionEnd;
  if (start !== end) {
    const next = value.slice(0, start) + (insertedText ?? "") + value.slice(end);
    return { value: next, selection: start + (insertedText?.length ?? 0) };
  }
  if (insertedText !== null) {
    return { value: value.slice(0, start) + insertedText + value.slice(end), selection: start + insertedText.length };
  }
  if (start === 0) return { value, selection: 0 };
  let deletionStart;
  let deletionEnd = end;
  if (typeof Intl.Segmenter === "function") {
    const segments = Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value));
    const containingCursor = segments.find(segment => segment.index < start && segment.index + segment.segment.length > start);
    const previous = [...segments].reverse().find(segment => segment.index + segment.segment.length <= start);
    if (containingCursor) {
      deletionStart = containingCursor.index;
      deletionEnd = containingCursor.index + containingCursor.segment.length;
    } else if (previous) deletionStart = previous.index;
    else return { value, selection: 0 };
  } else {
    deletionStart = removePreviousGrapheme(value.slice(0, start)).length;
  }
  return { value: value.slice(0, deletionStart) + value.slice(deletionEnd), selection: deletionStart };
}
