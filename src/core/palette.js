(function (root) {
  const TAG_PALETTE_SIZE = 8;

  function getTagTone(value) {
    const text = String(value || '');
    let hash = 0;

    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }

    return `tone-${hash % TAG_PALETTE_SIZE}`;
  }

  root.RRGetTagTone = getTagTone;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getTagTone, TAG_PALETTE_SIZE };
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
