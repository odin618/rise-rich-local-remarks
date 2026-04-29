const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fetchTokenAccountsWithFallback,
  isAllowedSenderUrl,
} = require('../src/background/service-worker.js');

const WALLET = '11111111111111111111111111111111';

test('background RPC bridge fetches token accounts from extension context', async () => {
  const calls = [];
  const payload = { result: { value: [] } };
  const result = await fetchTokenAccountsWithFallback({
    wallet: WALLET,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, json: async () => payload };
    },
  });

  assert.equal(result.endpoint, 'https://api.mainnet-beta.solana.com');
  assert.deepEqual(result.payload, payload);
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(calls[0].init.body).method, 'getTokenAccountsByOwner');
});

test('background RPC bridge falls back when the first RPC endpoint fails', async () => {
  const calls = [];
  const result = await fetchTokenAccountsWithFallback({
    wallet: WALLET,
    fetchImpl: async (url) => {
      calls.push(url);
      if (calls.length === 1) return { ok: false, status: 403, json: async () => ({}) };
      return { ok: true, json: async () => ({ result: { value: [] } }) };
    },
  });

  assert.equal(result.endpoint, 'https://public.rpc.solanavibestation.com');
  assert.deepEqual(calls, [
    'https://api.mainnet-beta.solana.com',
    'https://public.rpc.solanavibestation.com',
  ]);
});

test('background RPC bridge times out a stalled endpoint before fallback', async () => {
  const calls = [];
  const result = await fetchTokenAccountsWithFallback({
    wallet: WALLET,
    rpcTimeoutMs: 5,
    fetchImpl: async (url, init) => {
      calls.push(url);
      if (calls.length === 1) {
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        });
      }
      return { ok: true, json: async () => ({ result: { value: [] } }) };
    },
  });

  assert.equal(result.endpoint, 'https://public.rpc.solanavibestation.com');
  assert.deepEqual(calls, [
    'https://api.mainnet-beta.solana.com',
    'https://public.rpc.solanavibestation.com',
  ]);
});

test('background RPC bridge reports timeout when all endpoints stall', async () => {
  await assert.rejects(
    fetchTokenAccountsWithFallback({
      wallet: WALLET,
      customRpcEndpoint: 'https://rpc.example.com',
      rpcTimeoutMs: 5,
      fetchImpl: async (_url, init) => {
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        });
      },
    }),
    /RPC timeout after 5ms/,
  );
});

test('background RPC bridge only accepts rise.rich sender URLs', () => {
  assert.equal(isAllowedSenderUrl('https://rise.rich/profile/example'), true);
  assert.equal(isAllowedSenderUrl('https://app.rise.rich/profile/example'), true);
  assert.equal(isAllowedSenderUrl('https://example.com/profile/example'), false);
  assert.equal(isAllowedSenderUrl('not a url'), false);
});
