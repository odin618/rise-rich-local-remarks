(function (root) {
  const DEFAULT_RPC_ENDPOINTS = [
    'https://api.mainnet-beta.solana.com',
    'https://public.rpc.solanavibestation.com',
  ];
  const DEFAULT_RPC_ENDPOINT = DEFAULT_RPC_ENDPOINTS[0];
  const REQUIRED_MINT = '89ib7vR1bTdKEACWkjuBcMbuGaWpmQcBFB7N3Ddvrise';
  const REQUIRED_UI_AMOUNT = 1000;
  const SUCCESS_CACHE_MS = 15 * 60 * 1000;
  const RETRY_CACHE_MS = 30 * 1000;

  function extractWalletFromSolscanAccountHref(href) {
    try {
      const url = new URL(href);
      if (url.hostname !== 'solscan.io') return null;
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] !== 'account' || !parts[1]) return null;
      const wallet = decodeURIComponent(parts[1]).trim();
      if (!wallet || wallet === 'null' || wallet === 'undefined') return null;
      return wallet;
    } catch (_error) {
      return null;
    }
  }

  function createTokenAccountsRequest(wallet, mint) {
    return {
      jsonrpc: '2.0',
      id: 'rise-rich-remarks-token-gate',
      method: 'getTokenAccountsByOwner',
      params: [wallet, { mint }, { encoding: 'jsonParsed' }],
    };
  }

  function resolveRpcEndpoints(customEndpoint) {
    const endpoint = String(customEndpoint || '').trim();
    if (endpoint) {
      try {
        const url = new URL(endpoint);
        if (url.protocol === 'https:') return [url.href];
      } catch (_error) {}
    }
    return DEFAULT_RPC_ENDPOINTS.slice();
  }

  function hasRequiredTokenBalance(response, minimumUiAmount) {
    const accounts = response?.result?.value || [];
    let totalRaw = 0n;
    let decimals = null;

    for (const account of accounts) {
      const tokenAmount = account?.account?.data?.parsed?.info?.tokenAmount;
      if (!tokenAmount?.amount || typeof tokenAmount.decimals !== 'number') continue;
      decimals = decimals ?? tokenAmount.decimals;
      totalRaw += BigInt(tokenAmount.amount);
    }

    const resolvedDecimals = decimals ?? 0;
    const requiredRaw = parseUiAmountToRaw(minimumUiAmount, resolvedDecimals);

    return {
      allowed: totalRaw >= requiredRaw,
      balanceUi: formatRawAmount(totalRaw, resolvedDecimals),
    };
  }

  function parseUiAmountToRaw(uiAmount, decimals) {
    const text = String(uiAmount).trim();
    if (!/^\d+(\.\d+)?$/.test(text)) throw new Error(`Invalid token threshold: ${uiAmount}`);

    const [whole, fraction = ''] = text.split('.');
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
    return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(paddedFraction || '0');
  }

  function formatRawAmount(rawAmount, decimals) {
    if (decimals === 0) return rawAmount.toString();

    const scale = 10n ** BigInt(decimals);
    const whole = rawAmount / scale;
    const fraction = (rawAmount % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : whole.toString();
  }

  root.RREligibility = {
    DEFAULT_RPC_ENDPOINT,
    DEFAULT_RPC_ENDPOINTS,
    REQUIRED_MINT,
    REQUIRED_UI_AMOUNT,
    RETRY_CACHE_MS,
    SUCCESS_CACHE_MS,
    createTokenAccountsRequest,
    extractWalletFromSolscanAccountHref,
    hasRequiredTokenBalance,
    parseUiAmountToRaw,
    resolveRpcEndpoints,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      DEFAULT_RPC_ENDPOINT,
      DEFAULT_RPC_ENDPOINTS,
      REQUIRED_MINT,
      REQUIRED_UI_AMOUNT,
      RETRY_CACHE_MS,
      SUCCESS_CACHE_MS,
      createTokenAccountsRequest,
      extractWalletFromSolscanAccountHref,
      hasRequiredTokenBalance,
      parseUiAmountToRaw,
      resolveRpcEndpoints,
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
