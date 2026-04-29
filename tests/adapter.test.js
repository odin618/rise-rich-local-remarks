const test = require('node:test');
const assert = require('node:assert/strict');

const { RiseRichAdapter } = require('../src/core/adapter.js');

test('parses known rise.rich page types and ids from paths', () => {
  assert.deepEqual(RiseRichAdapter.routes.parse('/'), { type: 'list', id: null });
  assert.deepEqual(RiseRichAdapter.routes.parse('/trade/9xQeWvG816bUx9EPjHmaT23yvVM2ZWk'), {
    type: 'trade',
    id: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWk',
  });
  assert.deepEqual(RiseRichAdapter.routes.parse('/users/0xabc123'), {
    type: 'profile',
    id: '0xabc123',
  });
  assert.deepEqual(RiseRichAdapter.routes.parse('/profile/alice.rich'), {
    type: 'profile',
    id: 'alice.rich',
  });
  assert.deepEqual(RiseRichAdapter.routes.parse('/address/0x000000000000000000000000000000000000dead'), {
    type: 'profile',
    id: '0x000000000000000000000000000000000000dead',
  });
});

test('extracts stable entity ids from rise.rich links', () => {
  const makeAnchor = (href) => ({ href });

  assert.equal(
    RiseRichAdapter.extractEntityId(makeAnchor('https://rise.rich/users/0xbeef')),
    '0xbeef',
  );
  assert.equal(
    RiseRichAdapter.extractEntityId(makeAnchor('https://app.rise.rich/profile/satoshi.rich?tab=activity')),
    'satoshi.rich',
  );
  assert.equal(
    RiseRichAdapter.extractEntityId(makeAnchor('https://rise.rich/address/0x0000000000000000000000000000000000000001')),
    '0x0000000000000000000000000000000000000001',
  );
  assert.equal(RiseRichAdapter.extractEntityId(makeAnchor('https://example.com/users/0xbeef')), null);
});
