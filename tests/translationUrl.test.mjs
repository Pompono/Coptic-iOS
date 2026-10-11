import test from 'node:test';
import assert from 'node:assert/strict';
import { translationUrl } from '../lib/translationUrl.mjs';

test('joins the hosted API origin and both translation paths', () => {
  assert.equal(translationUrl('https://example.com/', '/api/translate'), 'https://example.com/api/translate');
  assert.equal(translationUrl('https://example.com', '/api/translate/en-coptic'), 'https://example.com/api/translate/en-coptic');
});
test('explains an offline-only build and rejects insecure or credentialed URLs', () => {
  assert.throws(() => translationUrl('', '/api/translate'), /not configured/);
  assert.throws(() => translationUrl('http://example.com', '/api/translate'), /HTTPS/);
  assert.throws(() => translationUrl('https://user:pass@example.com', '/api/translate'), /credentials/);
});
