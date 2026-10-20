export const COPTIC_FONT_STORAGE_KEY = 'coptic-font-mode';

export const COPTIC_FONT_OPTIONS = Object.freeze([
  Object.freeze({ label: 'Modern', value: 'avva' }),
  Object.freeze({ label: 'Classic', value: 'unicode' }),
]);

export function readCopticFontMode(saved) {
  return saved === 'unicode' ? 'unicode' : 'avva';
}
