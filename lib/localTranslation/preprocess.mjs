const LETTERS = {
  'ⲁ':'α','ⲃ':'β','ⲅ':'γ','ⲇ':'δ','ⲉ':'ε','ⲋ':'ϛ','ⲍ':'ζ','ⲏ':'η','ⲑ':'θ','ⲓ':'ι','ⲕ':'κ','ⲗ':'λ','ⲙ':'μ','ⲛ':'ν','ⲝ':'ξ','ⲟ':'ο','ⲡ':'π','ⲣ':'ρ','ⲥ':'σ','ⲧ':'τ','ⲩ':'υ','ⲫ':'φ','ⲭ':'χ','ⲯ':'ψ','ⲱ':'ω','ϣ':'s','ϥ':'f','ϧ':'k','ϩ':'h','ϫ':'j','ϭ':'c','ϯ':'t',
};
export function prepareCoptic(text, dialect = 'bohairic') {
  if (!['bohairic', 'sahidic'].includes(dialect)) throw new Error('Choose Bohairic or Sahidic.');
  const value = String(text ?? '').trim().toLowerCase();
  if (!value) throw new Error('Enter Coptic text to translate.');
  if (value.length > 1200) throw new Error('On-device translation currently supports short passages up to 1,200 characters.');
  const greek = Array.from(value, ch => LETTERS[ch] ?? ch).join('');
  return `${dialect === 'bohairic' ? 'б' : 'з'} ${greek}`;
}
