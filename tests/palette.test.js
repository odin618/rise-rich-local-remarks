const test = require('node:test');
const assert = require('node:assert/strict');

const { getTagTone, TAG_PALETTE_SIZE } = require('../src/core/palette.js');

test('returns stable bounded tag tones for wallet labels', () => {
  const first = getTagTone('4HS6N9SyhYx7T5H6C2wE6RzzzzzzzzzzzzzzHfco');
  const second = getTagTone('4HS6N9SyhYx7T5H6C2wE6RzzzzzzzzzzzzzzHfco');
  const index = Number(first.replace('tone-', ''));

  assert.equal(first, second);
  assert.match(first, /^tone-\d$/);
  assert.ok(index >= 0);
  assert.ok(index < TAG_PALETTE_SIZE);
});
