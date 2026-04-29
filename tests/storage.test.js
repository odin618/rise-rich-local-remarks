const test = require('node:test');
const assert = require('node:assert/strict');

const { AnnotationStorage, MemoryStorageArea } = require('../src/core/storage.js');

test('loads, upserts, removes, exports, and imports annotations by entity id', async () => {
  const area = new MemoryStorageArea();
  const storage = new AnnotationStorage(area, 'remarks');

  await storage.load();
  assert.deepEqual(storage.all(), []);

  await storage.upsert({
    entityId: '0xabc',
    note: 'early supporter',
    tags: ['vip'],
  });

  assert.equal(storage.get('0xabc').note, 'early supporter');
  assert.match(storage.get('0xabc').updatedAt, /^\d{4}-\d{2}-\d{2}T/);

  const exported = storage.exportJson();
  assert.equal(exported.version, 1);
  assert.equal(exported.items.length, 1);

  await storage.remove('0xabc');
  assert.equal(storage.get('0xabc'), undefined);

  await storage.importJson({
    version: 1,
    items: [
      { entityId: '0xabc', note: 'restored', tags: ['watch'] },
      { entityId: '', note: 'ignored' },
    ],
  });

  assert.equal(storage.get('0xabc').note, 'restored');
  assert.deepEqual(storage.get('0xabc').tags, ['watch']);
  assert.equal(storage.all().length, 1);
});

test('keeps a single remark field and migrates legacy display names into notes', async () => {
  const area = new MemoryStorageArea({
    remarks: JSON.stringify([
      { entityId: 'legacy-address', displayName: 'legacy label', tags: ['old'] },
    ]),
  });
  const storage = new AnnotationStorage(area, 'remarks');

  await storage.load();

  assert.equal(storage.get('legacy-address').note, 'legacy label');
  assert.equal(Object.hasOwn(storage.get('legacy-address'), 'displayName'), false);
});

test('finds annotations by exact address or unique abbreviated address label', async () => {
  const area = new MemoryStorageArea();
  const storage = new AnnotationStorage(area, 'remarks');

  await storage.load();
  await storage.upsert({
    entityId: '4HS6N9SyhYx7T5H6C2wE6RzzzzzzzzzzzzzzHfco',
    note: 'tracked whale',
  });
  await storage.upsert({
    entityId: '2xHkN9SyhYx7T5H6C2wE6Raaaaaaaaaaaaaawuit',
    note: 'bot wallet',
  });

  assert.equal(
    storage.findByAddressLabel('4HS6N9SyhYx7T5H6C2wE6RzzzzzzzzzzzzzzHfco').note,
    'tracked whale',
  );
  assert.equal(storage.findByAddressLabel('4HS6...Hfco').note, 'tracked whale');
  assert.equal(storage.findByAddressLabel('2xHk...wuit').note, 'bot wallet');
  assert.equal(storage.findByAddressLabel('missing...addr'), undefined);
});
