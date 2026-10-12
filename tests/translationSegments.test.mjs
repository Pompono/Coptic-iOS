import test from 'node:test';
import assert from 'node:assert/strict';
import { passageSegments } from '../lib/localTranslation/segments.mjs';
import { prepareCoptic } from '../lib/localTranslation/preprocess.mjs';
import { checkTranslationOutput } from '../lib/localTranslation/quality.mjs';
test('keeps poetic colons and wrapped lines together, separates complete sentences and paragraphs', () => {
 assert.deepEqual(passageSegments('ⲭⲉⲣⲉ: ⲛⲉ\nⲙⲁⲣⲓⲁ. ⲡⲉⲛⲛⲟⲩϯ.\n\nⲓⲏⲥ ⲡⲭⲥ'), ['ⲭⲉⲣⲉ: ⲛⲉ\nⲙⲁⲣⲓⲁ.', 'ⲡⲉⲛⲛⲟⲩϯ.', 'ⲓⲏⲥ ⲡⲭⲥ']);
 assert.deepEqual(passageSegments('ⲓ.ⲏ.ⲥ'), ['ⲓ.ⲏ.ⲥ']);
 assert.throws(()=>passageSegments(''),/Enter Coptic/);
 assert.throws(()=>passageSegments('ⲁ'.repeat(1201)),/1,200/);
});
test('Bohairic model input removes printed marks without altering letters or punctuation; Sahidic remains unchanged', () => {
 const original='Ⲙ̀ⲙⲟⲥ: ⲡⲭ̅ⲥ̅.';
 assert.equal(prepareCoptic(original), 'б μμοσ: πχσ.');
 assert.equal(original,'Ⲙ̀ⲙⲟⲥ: ⲡⲭ̅ⲥ̅.');
 assert.equal(prepareCoptic('ⲙ̀ⲙⲟⲥ','sahidic'), 'з μ̀μοσ');
 assert.equal(prepareCoptic('ⲙ̀ⲙⲟⲥ','bohairic',{normalizeMarks:false}), 'б μ̀μοσ');
});
test('refuses an obviously incomplete Halleluia-only output for a longer passage', () => {
 assert.throws(()=>checkTranslationOutput('Alleluia, alleluia, alleluia.', 'ⲁ'.repeat(90)), /short fragment|only a refrain/);
 assert.doesNotThrow(()=>checkTranslationOutput('our God','ⲡⲉⲛⲛⲟⲩϯ'));
});
