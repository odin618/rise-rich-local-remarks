(function () {
  if (window.__RR_REMARKS_CLIPBOARD_BRIDGE_INSTALLED__) return;
  window.__RR_REMARKS_CLIPBOARD_BRIDGE_INSTALLED__ = true;
  let captureUntil = 0;

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.source !== 'rr-remarks-clipboard-arm') return;
    const durationMs = Number(event.data.durationMs || 0);
    captureUntil = durationMs > 0 && durationMs <= 15000
      ? Date.now() + durationMs
      : 0;
  });

  function publishClipboardText(text) {
    if (captureUntil < Date.now()) return;
    captureUntil = 0;
    try {
      window.postMessage(
        { source: 'rr-remarks-clipboard', text: String(text || '') },
        window.location.origin,
      );
    } catch (_error) {}
  }

  function patchClipboard() {
    const clipboard = navigator.clipboard;
    if (!clipboard || typeof clipboard.writeText !== 'function') return false;
    if (clipboard.writeText.__rrRemarksWrapped) return true;

    const originalWriteText = clipboard.writeText.bind(clipboard);
    const wrappedWriteText = function (text) {
      const result = originalWriteText(text);
      Promise.resolve(result)
        .then(() => publishClipboardText(text))
        .catch(() => {});
      return result;
    };
    wrappedWriteText.__rrRemarksWrapped = true;

    try {
      Object.defineProperty(clipboard, 'writeText', {
        configurable: true,
        value: wrappedWriteText,
      });
    } catch (_error) {
      clipboard.writeText = wrappedWriteText;
    }

    return clipboard.writeText === wrappedWriteText;
  }

  if (patchClipboard()) return;

  const retryTimer = window.setInterval(() => {
    if (patchClipboard()) window.clearInterval(retryTimer);
  }, 250);
  window.setTimeout(() => window.clearInterval(retryTimer), 5000);
  window.addEventListener('DOMContentLoaded', patchClipboard, { once: true });
})();
