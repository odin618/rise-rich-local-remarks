(function (root) {
  const PROFILE_SEGMENTS = new Set(['users', 'user', 'profile', 'address', 'account']);
  const RISE_RICH_HOST_RE = /(^|\.)rise\.rich$/i;

  function cleanId(value) {
    if (!value || typeof value !== 'string') return null;
    const decoded = decodeURIComponent(value).trim();
    if (!decoded || decoded === 'undefined' || decoded === 'null') return null;
    return decoded.replace(/[?#].*$/, '').replace(/\/+$/, '') || null;
  }

  function parsePathname(pathname) {
    const path = pathname || '/';
    const segments = path.split('/').map(cleanId).filter(Boolean);

    if (segments.length === 0) {
      return { type: 'list', id: null };
    }

    if (segments[0].toLowerCase() === 'trade' && segments[1]) {
      return { type: 'trade', id: segments[1] };
    }

    const profileIndex = segments.findIndex((segment) => PROFILE_SEGMENTS.has(segment.toLowerCase()));
    if (profileIndex >= 0 && segments[profileIndex + 1]) {
      return { type: 'profile', id: segments[profileIndex + 1] };
    }

    if (/^(0x[a-f0-9]{6,}|[a-z0-9_-]+\.rich)$/i.test(segments[0])) {
      return { type: 'profile', id: segments[0] };
    }

    return { type: 'unknown', id: null };
  }

  function safeUrl(href) {
    try {
      return new URL(href, root.location && root.location.href ? root.location.href : 'https://rise.rich/');
    } catch (_error) {
      return null;
    }
  }

  const RiseRichAdapter = {
    id: 'rise-rich',
    domains: ['rise.rich', '*.rise.rich'],
    storagePrefix: 'riseRichRemarks',
    storageKeys: {
      annotations: 'riseRichRemarks.annotations',
      eligibility: 'riseRichRemarks.eligibility',
      eligibilityRetry: 'riseRichRemarks.eligibilityRetry',
      settings: 'riseRichRemarks.settings',
    },
    routes: {
      parse: parsePathname,
    },
    selectors: {
      listContainer: 'main, [role="main"], body',
      entityLink: [
        'a[href*="/users/"]',
        'a[href*="/user/"]',
        'a[href*="/profile/"]',
        'a[href*="/address/"]',
        'a[href^="/0x"]',
        'a[href*=".rich"]',
      ].join(','),
      detailHeader: 'main header, [role="main"] header, main, [role="main"]',
      displayName: 'h1, h2, [data-testid*="name"], [class*="name" i]',
      tradeRecordTitle: 'h3',
      tradeRecordTable: 'table',
      tradeTraderCell: 'td',
    },
    extractEntityId(link) {
      if (!link || !link.href) return null;
      const url = safeUrl(link.href);
      if (!url || !RISE_RICH_HOST_RE.test(url.hostname)) return null;
      const page = parsePathname(url.pathname);
      return page.id;
    },
    externalLinks: {
      profile: (entityId) => `https://rise.rich/profile/${encodeURIComponent(entityId)}`,
    },
  };

  root.RiseRichAdapter = RiseRichAdapter;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RiseRichAdapter };
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
