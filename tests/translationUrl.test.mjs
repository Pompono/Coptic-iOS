import test from 'node:test';
import assert from 'node:assert/strict';
import { translationUrl } from '../lib/translationUrl.mjs';

test('joins the hosted API origin and both translation paths', () => {
  assert.equal(translationUrl('https://example.com/', '/api/translate'), 'https://example.com/api/translate');
  assert.equal(translationUrl('https://example.com', '/api/translate/en-coptic'), 'https://example.com/api/translate/en-coptic');
});
test('defaults to the shared website and rejects insecure or credentialed URLs', () => {
  assert.equal(translationUrl('', '/api/translate'), 'https://coptlingo.com/api/translate');
  assert.throws(() => translationUrl('https://example.com/path', '/api/translate'), /origin/);
  assert.throws(() => translationUrl('', '//attacker.example'), /Unsupported/);
  assert.throws(() => translationUrl('http://example.com', '/api/translate'), /HTTPS/);
  assert.throws(() => translationUrl('https://user:pass@example.com', '/api/translate'), /credentials/);
});
