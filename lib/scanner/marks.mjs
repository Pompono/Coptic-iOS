// An overline may be an abbreviation, not a misread jinkem. Never apply this
// automatically: keep the original OCR output and require an explicit action.
export const hasOverline = text => /[\u0304\u0305]/u.test(text);
export const overlinesToJinkem = text => text.replace(/[\u0304\u0305]/gu, '\u0300');
