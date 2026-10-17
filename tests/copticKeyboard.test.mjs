import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCopticCase,
  COPTIC_CASE_MAP,
  COPTIC_KEYBOARD_LAYOUTS,
  editTextAtSelection,
  isCopticKey,
  removePreviousGrapheme,
} from "../lib/copticKeyboard.mjs";

test("Coptic case map covers paired capitals and lowercase letters", () => {
  assert.ok(Object.keys(COPTIC_CASE_MAP).length >= 60);
  for (const [letter, paired] of Object.entries(COPTIC_CASE_MAP)) {
    assert.equal(applyCopticCase(paired), letter);
    assert.equal(isCopticKey(letter), true);
  }
  assert.equal(applyCopticCase("a"), "a");
  assert.equal(isCopticKey("a"), false);
});

test("each keyboard mode includes its expected controls and Coptic numerals", () => {
  assert.deepEqual(Object.keys(COPTIC_KEYBOARD_LAYOUTS).sort(), ["ABC", "NUMBERS", "SYMBOLS"]);
  for (const mode of Object.values(COPTIC_KEYBOARD_LAYOUTS)) {
    assert.equal(mode.length, 5);
    assert.ok(mode.flat().some(key => typeof key === "object" && key.key === "backspace"));
    assert.ok(mode.flat().some(key => typeof key === "object" && key.key === "space"));
    assert.ok(mode.flat().some(key => typeof key === "object" && key.key === "return"));
  }
  const numbers = COPTIC_KEYBOARD_LAYOUTS.NUMBERS.flat().filter(key => typeof key === "string");
  assert.ok(numbers.includes("ⲁ̅"));
  assert.ok(numbers.includes("ϣ̅"));
  assert.ok(numbers.filter(key => isCopticKey(Array.from(key)[0])).every(key => key.includes("̅")));
});

test("backspace removes a Coptic letter with any attached combining mark", () => {
  for (const value of ["ⲁ̀", "ⲁ̅", "ⲁ̈", "ϣ̅"]) {
    assert.deepEqual(editTextAtSelection(value, value.length, value.length, null), { value: "", selection: 0 });
    assert.equal(removePreviousGrapheme(value), "");
  }
});

test("backspace at a cursor inside a combining sequence removes the whole grapheme", () => {
  const value = "xⲁ̅y";
  assert.deepEqual(editTextAtSelection(value, 3, 3, null), { value: "xy", selection: 1 });
});

test("key insertion and deletion honor cursor and selection", () => {
  assert.deepEqual(editTextAtSelection("abc", 1, 1, "ⲁ"), { value: "aⲁbc", selection: 2 });
  assert.deepEqual(editTextAtSelection("abcde", 1, 4, "ⲱ"), { value: "aⲱe", selection: 2 });
  assert.deepEqual(editTextAtSelection("abcde", 1, 4, null), { value: "ae", selection: 1 });
});
