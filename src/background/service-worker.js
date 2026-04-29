(function (root) {
  const MESSAGE_FETCH_TOKEN_ACCOUNTS = 'RR_FETCH_TOKEN_ACCOUNTS';
  const RPC_ENDPOINT_TIMEOUT_MS = 3500;

  if (typeof importScripts === 'function') {
    importScripts('../core/eligibility.js');
  }

  const eligibility = root.RREligibility || (
    typeof require === 'function' ? require('../core/eligibility.js') : null
  );

  if (root.chrome?.runtime?.onMessage && eligibility) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message?.type !== MESSAGE_FETCH_TOKEN_ACCOUNTS) return false;

      if (!isAllowedSenderUrl(sender?.url)) {
        sendResponse(toRpcErrorResponse(createRpcError('Unauthorized RPC request sender', '')));
        return false;
      }

      fetchTokenAccountsWithFallback({
        customRpcEndpoint: message.customRpcEndpoint,
        fetchImpl: root.fetch && root.fetch.bind(root),
        wallet: message.wallet,
      })
        .then((result) => sendResponse({ ok: true, ...result }))
        .catch((error) => sendResponse(toRpcErrorResponse(error)));
      return true;
    });
  }

  async function fetchTokenAccountsWithFallback({
    wallet,
    customRpcEndpoint,
    fetchImpl,
    rpcTimeoutMs = RPC_ENDPOINT_TIMEOUT_MS,
  }) {
    if (!eligibility) throw createRpcError('Eligibility module unavailable', '');
    if (!isLikelySolanaAddress(wallet)) throw createRpcError('Invalid wallet address', '');
    if (typeof fetchImpl !== 'function') throw createRpcError('Fetch API unavailable', '');

    const endpoints = eligibility.resolveRpcEndpoints
      ? eligibility.resolveRpcEndpoints(customRpcEndpoint)
      : eligibility.DEFAULT_RPC_ENDPOINTS || [eligibility.DEFAULT_RPC_ENDPOINT];
    const errors = [];

    for (const endpoint of endpoints) {
      try {
        return await fetchRpcEndpoint({ endpoint, fetchImpl, rpcTimeoutMs, wallet });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${endpoint}: ${message}`);
      }
    }

    throw createRpcError(errors.join(' | ') || 'All RPC endpoints failed', endpoints[endpoints.length - 1] || '');
  }

  async function fetchRpcEndpoint({ endpoint, fetchImpl, rpcTimeoutMs, wallet }) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = controller
      ? root.setTimeout(() => controller.abort(), rpcTimeoutMs)
      : 0;

    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller?.signal,
        body: JSON.stringify(
          eligibility.createTokenAccountsRequest(wallet, eligibility.REQUIRED_MINT),
        ),
      });
      if (!response.ok) throw createRpcError(`RPC HTTP ${response.status}`, endpoint);

      const payload = await response.json();
      if (payload?.error) {
        throw createRpcError(payload.error.message || 'Solana RPC error', endpoint);
      }
      return { endpoint, payload };
    } catch (error) {
      if (controller?.signal?.aborted || error?.name === 'AbortError') {
        throw createRpcError(`RPC timeout after ${rpcTimeoutMs}ms`, endpoint);
      }
      throw error;
    } finally {
      if (timeoutId) root.clearTimeout(timeoutId);
    }
  }

  function toRpcErrorResponse(error) {
    return {
      ok: false,
      endpoint: error?.endpoint || '',
      error: error instanceof Error ? error.message : String(error || 'RPC request failed'),
    };
  }

  function createRpcError(message, endpoint) {
    const error = new Error(message);
    error.endpoint = endpoint;
    return error;
  }

  function isAllowedSenderUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname === 'rise.rich' || parsed.hostname.endsWith('.rise.rich');
    } catch (_error) {
      return false;
    }
  }

  function isLikelySolanaAddress(value) {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(value || ''));
  }

  root.RRBackgroundRpc = {
    MESSAGE_FETCH_TOKEN_ACCOUNTS,
    RPC_ENDPOINT_TIMEOUT_MS,
    fetchTokenAccountsWithFallback,
    isAllowedSenderUrl,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      MESSAGE_FETCH_TOKEN_ACCOUNTS,
      RPC_ENDPOINT_TIMEOUT_MS,
      fetchTokenAccountsWithFallback,
      isAllowedSenderUrl,
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
