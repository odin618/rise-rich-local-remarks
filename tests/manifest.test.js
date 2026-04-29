const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function loadManifest() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8'));
}

function readPngSize(relativePath) {
  const buffer = fs.readFileSync(path.join(__dirname, '..', relativePath));
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test('loads clipboard bridge in the page main world before site scripts handle copy clicks', () => {
  const manifest = loadManifest();
  const clipboardBridge = manifest.content_scripts.find((script) =>
    script.js.includes('src/content/clipboard-bridge.js'),
  );

  assert.ok(clipboardBridge, 'missing clipboard bridge content script');
  assert.equal(clipboardBridge.world, 'MAIN');
  assert.equal(clipboardBridge.run_at, 'document_start');
  assert.deepEqual(clipboardBridge.matches, ['https://rise.rich/*', 'https://*.rise.rich/*']);
});

test('declares Chrome Web Store compatible square PNG icons', () => {
  const manifest = loadManifest();
  const expected = {
    16: 'src/assets/icons/icon-16.png',
    32: 'src/assets/icons/icon-32.png',
    48: 'src/assets/icons/icon-48.png',
    128: 'src/assets/icons/icon-128.png',
  };

  assert.deepEqual(manifest.icons, expected);
  assert.deepEqual(manifest.action.default_icon, expected);

  for (const [size, file] of Object.entries(expected)) {
    assert.equal(path.extname(file), '.png');
    assert.deepEqual(readPngSize(file), { width: Number(size), height: Number(size) });
  }
});

test('uses a background service worker for cross-origin RPC requests', () => {
  const manifest = loadManifest();

  assert.deepEqual(manifest.background, {
    service_worker: 'src/background/service-worker.js',
  });
  assert.deepEqual(manifest.host_permissions, [
    'https://api.mainnet-beta.solana.com/*',
    'https://public.rpc.solanavibestation.com/*',
  ]);
  assert.deepEqual(manifest.optional_host_permissions, ['https://*/*']);
});
