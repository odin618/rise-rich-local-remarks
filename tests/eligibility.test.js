const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractWalletFromSolscanAccountHref,
  hasRequiredTokenBalance,
  createTokenAccountsRequest,
  DEFAULT_RPC_ENDPOINTS,
  resolveRpcEndpoints,
  SUCCESS_CACHE_MS,
} = require('../src/core/eligibility.js');

test('extracts wallet address from Solscan account links', () => {
  assert.equal(
    extractWalletFromSolscanAccountHref(
      'https://solscan.io/account/11111111111111111111111111111111',
    ),
    '11111111111111111111111111111111',
  );
  assert.equal(extractWalletFromSolscanAccountHref('https://solscan.io/tx/abc'), null);
  assert.equal(extractWalletFromSolscanAccountHref('https://example.com/account/abc'), null);
  assert.equal(extractWalletFromSolscanAccountHref('https://solscan.io/account/null'), null);
  assert.equal(extractWalletFromSolscanAccountHref('https://solscan.io/account/undefined'), null);
  assert.equal(extractWalletFromSolscanAccountHref('https://solscan.io/account/'), null);
});

test('builds Solana getTokenAccountsByOwner request for the configured mint', () => {
  const request = createTokenAccountsRequest('wallet123', 'mint123');

  assert.equal(request.method, 'getTokenAccountsByOwner');
  assert.deepEqual(request.params[0], 'wallet123');
  assert.deepEqual(request.params[1], { mint: 'mint123' });
  assert.deepEqual(request.params[2], { encoding: 'jsonParsed' });
});

test('uses no-key fallback RPC endpoints after the official endpoint', () => {
  assert.equal(DEFAULT_RPC_ENDPOINTS[0], 'https://api.mainnet-beta.solana.com');
  assert.ok(DEFAULT_RPC_ENDPOINTS.includes('https://public.rpc.solanavibestation.com'));
});

test('keeps successful eligibility checks warm long enough for page navigation', () => {
  assert.equal(SUCCESS_CACHE_MS, 15 * 60 * 1000);
});

test('uses a valid custom RPC endpoint before built-in defaults', () => {
  assert.deepEqual(resolveRpcEndpoints(' https://rpc.example.com/solana '), [
    'https://rpc.example.com/solana',
  ]);
});

test('falls back to built-in RPC endpoints when custom RPC is empty or invalid', () => {
  assert.deepEqual(resolveRpcEndpoints(''), DEFAULT_RPC_ENDPOINTS);
  assert.deepEqual(resolveRpcEndpoints('not-a-url'), DEFAULT_RPC_ENDPOINTS);
  assert.deepEqual(resolveRpcEndpoints('http://rpc.example.com'), DEFAULT_RPC_ENDPOINTS);
  assert.deepEqual(resolveRpcEndpoints('ftp://rpc.example.com'), DEFAULT_RPC_ENDPOINTS);
});

test('requires at least 1000 ui tokens across token accounts', () => {
  const response = {
    result: {
      value: [
        {
          account: {
            data: {
              parsed: {
                info: {
                  tokenAmount: {
                    amount: '999999999999',
                    decimals: 9,
                  },
                },
              },
            },
          },
        },
        {
          account: {
            data: {
              parsed: {
                info: {
                  tokenAmount: {
                    amount: '1',
                    decimals: 9,
                  },
                },
              },
            },
          },
        },
      ],
    },
  };

  const result = hasRequiredTokenBalance(response, 1000);

  assert.equal(result.allowed, true);
  assert.equal(result.balanceUi, '1000');
});

test('rejects wallets below the 1000 token threshold', () => {
  const response = {
    result: {
      value: [
        {
          account: {
            data: {
              parsed: {
                info: {
                  tokenAmount: {
                    amount: '999000000000',
                    decimals: 9,
                  },
                },
              },
            },
          },
        },
      ],
    },
  };

  const result = hasRequiredTokenBalance(response, 1000);

  assert.equal(result.allowed, false);
  assert.equal(result.balanceUi, '999');
});

test('supports fractional token thresholds', () => {
  const response = {
    result: {
      value: [
        {
          account: {
            data: {
              parsed: {
                info: {
                  tokenAmount: {
                    amount: '299999999',
                    decimals: 9,
                  },
                },
              },
            },
          },
        },
      ],
    },
  };

  const result = hasRequiredTokenBalance(response, 0.3);

  assert.equal(result.allowed, false);
  assert.equal(result.balanceUi, '0.299999999');
});

test('allows wallets at fractional token thresholds', () => {
  const response = {
    result: {
      value: [
        {
          account: {
            data: {
              parsed: {
                info: {
                  tokenAmount: {
                    amount: '300000000',
                    decimals: 9,
                  },
                },
              },
            },
          },
        },
      ],
    },
  };

  const result = hasRequiredTokenBalance(response, 0.3);

  assert.equal(result.allowed, true);
  assert.equal(result.balanceUi, '0.3');
});
