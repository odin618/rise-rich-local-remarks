(async function () {
  const adapter = window.RiseRichAdapter;
  const AnnotationStorage = window.RRAnnotationStorage;
  const ChromeStorageArea = window.RRChromeStorageArea;
  const getTagTone = window.RRGetTagTone;
  const createTranslator = window.RRI18n.createTranslator;
  const eligibility = window.RREligibility;

  if (!adapter || !AnnotationStorage || !ChromeStorageArea || !getTagTone || !createTranslator || !eligibility || !window.chrome || !chrome.storage) return;

  const storage = new AnnotationStorage(
    new ChromeStorageArea(chrome.storage.local),
    adapter.storageKeys.annotations,
  );
  let settings = { enabled: true };
  let observer = null;
  let lastHref = window.location.href;
  let debounceTimer = 0;
  let eligibilityCache = null;
  let eligibilityPending = null;
  let lastPublishedEligibility = '';
  let pendingWalletCapture = null;
  let activeDialogClose = null;
  let extensionContextInvalidated = false;

  try {
    await storage.load();
    settings = Object.assign(settings, await loadSettings());
    eligibilityCache = await loadEligibilityCache();
  } catch (error) {
    if (handleExtensionContextError(error)) return;
    throw error;
  }
  listenForClipboardCapture();

  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    try {
      if (extensionContextInvalidated || areaName !== 'local') return;
      if (changes[adapter.storageKeys.annotations]) {
        await storage.load();
        scheduleProcess();
      }
      if (changes[adapter.storageKeys.settings]) {
        const previousRpcEndpoint = settings.customRpcEndpoint || '';
        settings = Object.assign(settings, await loadSettings());
        if ((settings.customRpcEndpoint || '') !== previousRpcEndpoint) {
          eligibilityCache = null;
          eligibilityPending = null;
          lastPublishedEligibility = '';
          await safeStorageRemove(adapter.storageKeys.eligibility);
          await safeStorageSet({ [adapter.storageKeys.eligibilityRetry]: Date.now() });
        }
        refreshInjectedUi();
      }
      if (changes[adapter.storageKeys.eligibility]) {
        eligibilityCache = normalizeEligibilityCache(changes[adapter.storageKeys.eligibility].newValue);
      }
      if (changes[adapter.storageKeys.eligibilityRetry]) {
        eligibilityCache = null;
        eligibilityPending = null;
        lastPublishedEligibility = '';
        refreshInjectedUi();
      }
    } catch (error) {
      if (!handleExtensionContextError(error)) throw error;
    }
  });

  patchHistory();
  startObserver();
  scheduleProcess();

  async function loadSettings() {
    const result = await safeStorageGet(adapter.storageKeys.settings);
    return result?.[adapter.storageKeys.settings] || {};
  }

  async function loadEligibilityCache() {
    const result = await safeStorageGet(adapter.storageKeys.eligibility);
    return normalizeEligibilityCache(result?.[adapter.storageKeys.eligibility]);
  }

  function normalizeEligibilityCache(state) {
    if (!state || typeof state !== 'object') return null;
    if (state.mint !== eligibility.REQUIRED_MINT) return null;
    if (state.requiredAmount !== eligibility.REQUIRED_UI_AMOUNT) return null;
    if (!state.expiresAt || state.expiresAt <= Date.now()) return null;
    return state;
  }

  function patchHistory() {
    const notify = () => {
      if (window.location.href !== lastHref) {
        lastHref = window.location.href;
        scheduleProcess();
      }
    };
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      notify();
    };
    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      notify();
    };
    window.addEventListener('popstate', notify);
  }

  function startObserver() {
    observer = new MutationObserver(() => scheduleProcess());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function scheduleProcess() {
    if (extensionContextInvalidated) return;
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      void processPage().catch((error) => {
        if (!handleExtensionContextError(error)) throw error;
      });
    }, 120);
  }

  async function processPage() {
    if (extensionContextInvalidated) return;
    removeUiWhenDisabled();
    if (!settings.enabled) return;
    const allowed = await ensureEligible();
    if (!allowed) {
      removeInjectedUi();
      return;
    }
    injectLinkControls();
    injectDetailPanel();
    injectTradeRecordRemarks();
  }

  function t(key, ...args) {
    return createTranslator(settings.language || 'auto', navigator.language)(key, ...args);
  }

  function removeUiWhenDisabled() {
    if (settings.enabled) return;
    removeInjectedUi();
  }

  function removeInjectedUi() {
    if (activeDialogClose) activeDialogClose(null);
    document.querySelectorAll('[data-rr-remarks-ui]').forEach((node) => node.remove());
  }

  async function ensureEligible() {
    const wallet = extractCurrentWallet();
    const now = Date.now();

    if (!wallet) {
      if (eligibilityCache?.status === 'no_wallet' && eligibilityCache.expiresAt > now) return false;
      eligibilityCache = {
        allowed: false,
        balanceUi: '0',
        checkedAt: now,
        expiresAt: now + eligibility.RETRY_CACHE_MS,
        mint: eligibility.REQUIRED_MINT,
        requiredAmount: eligibility.REQUIRED_UI_AMOUNT,
        status: 'no_wallet',
        wallet: '',
      };
      await tryPublishEligibility(eligibilityCache);
      return false;
    }

    if (eligibilityCache?.wallet === wallet && eligibilityCache.expiresAt > now) {
      return eligibilityCache.allowed;
    }
    if (eligibilityPending?.wallet === wallet) {
      return eligibilityPending.promise;
    }

    eligibilityPending = {
      wallet,
      promise: verifyWalletEligibility(wallet, now),
    };
    return eligibilityPending.promise;
  }

  async function verifyWalletEligibility(wallet, checkedAt) {
    try {
      const published = await tryPublishEligibility({
        allowed: false,
        balanceUi: '0',
        checkedAt,
        mint: eligibility.REQUIRED_MINT,
        requiredAmount: eligibility.REQUIRED_UI_AMOUNT,
        status: 'checking',
        wallet,
      });
      if (!published) return false;

      const rpcResult = await fetchTokenAccountsWithFallback(wallet);
      const payload = rpcResult.payload;
      const result = eligibility.hasRequiredTokenBalance(payload, eligibility.REQUIRED_UI_AMOUNT);
      eligibilityCache = {
        allowed: result.allowed,
        balanceUi: result.balanceUi,
        checkedAt: Date.now(),
        expiresAt: Date.now() + (result.allowed ? eligibility.SUCCESS_CACHE_MS : eligibility.RETRY_CACHE_MS),
        mint: eligibility.REQUIRED_MINT,
        requiredAmount: eligibility.REQUIRED_UI_AMOUNT,
        rpcEndpoint: rpcResult.endpoint,
        status: result.allowed ? 'authorized' : 'insufficient',
        wallet,
      };
      await tryPublishEligibility(eligibilityCache);
      return result.allowed;
    } catch (error) {
      if (handleExtensionContextError(error)) return false;
      eligibilityCache = {
        allowed: false,
        balanceUi: '0',
        checkedAt: Date.now(),
        error: error instanceof Error ? error.message : String(error),
        expiresAt: Date.now() + eligibility.RETRY_CACHE_MS,
        mint: eligibility.REQUIRED_MINT,
        requiredAmount: eligibility.REQUIRED_UI_AMOUNT,
        rpcEndpoint: error?.endpoint || '',
        status: 'error',
        wallet,
      };
      await tryPublishEligibility(eligibilityCache);
      return false;
    } finally {
      if (eligibilityPending?.wallet === wallet) eligibilityPending = null;
    }
  }

  async function fetchTokenAccountsWithFallback(wallet) {
    if (!isExtensionContextAvailable() || !chrome.runtime?.sendMessage) {
      throw createRpcError('Extension RPC bridge unavailable', '');
    }
    let response = null;
    try {
      response = await chrome.runtime.sendMessage({
        type: 'RR_FETCH_TOKEN_ACCOUNTS',
        customRpcEndpoint: settings.customRpcEndpoint || '',
        wallet,
      });
    } catch (error) {
      if (handleExtensionContextError(error)) throw error;
      throw error;
    }
    if (!response?.ok) {
      throw createRpcError(response?.error || 'RPC request failed', response?.endpoint || '');
    }
    return { endpoint: response.endpoint, payload: response.payload };
  }

  function createRpcError(message, endpoint) {
    const error = new Error(message);
    error.endpoint = endpoint;
    return error;
  }

  async function publishEligibility(state) {
    const key = JSON.stringify({
      allowed: state.allowed,
      balanceUi: state.balanceUi,
      status: state.status,
      wallet: state.wallet,
    });
    if (key === lastPublishedEligibility) return;
    lastPublishedEligibility = key;
    await safeStorageSet({ [adapter.storageKeys.eligibility]: state });
  }

  async function tryPublishEligibility(state) {
    try {
      await publishEligibility(state);
      return true;
    } catch (error) {
      if (handleExtensionContextError(error)) return false;
      throw error;
    }
  }

  async function safeStorageGet(key) {
    try {
      return await chrome.storage.local.get(key);
    } catch (error) {
      if (handleExtensionContextError(error)) return {};
      throw error;
    }
  }

  async function safeStorageSet(values) {
    try {
      await chrome.storage.local.set(values);
      return true;
    } catch (error) {
      if (handleExtensionContextError(error)) return false;
      throw error;
    }
  }

  async function safeStorageRemove(key) {
    try {
      await chrome.storage.local.remove(key);
      return true;
    } catch (error) {
      if (handleExtensionContextError(error)) return false;
      throw error;
    }
  }

  function isExtensionContextAvailable() {
    try {
      const available = !extensionContextInvalidated && Boolean(chrome.runtime?.id);
      if (!available && !extensionContextInvalidated) {
        handleExtensionContextError(new Error('Extension context invalidated'));
      }
      return available;
    } catch (error) {
      handleExtensionContextError(error);
      return false;
    }
  }

  function handleExtensionContextError(error) {
    if (!isExtensionContextError(error)) return false;
    if (extensionContextInvalidated) return true;

    extensionContextInvalidated = true;
    window.clearTimeout(debounceTimer);
    observer?.disconnect();
    observer = null;
    eligibilityPending = null;
    lastPublishedEligibility = '';
    clearPendingWalletCapture();
    removeInjectedUi();
    return true;
  }

  function isExtensionContextError(error) {
    const message = error instanceof Error ? error.message : String(error || '');
    return /Extension context invalidated|context invalidated/i.test(message);
  }

  function extractCurrentWallet() {
    const links = document.querySelectorAll('a[href*="solscan.io/account/"]');
    for (const link of links) {
      const wallet = eligibility.extractWalletFromSolscanAccountHref(link.href);
      if (wallet) return wallet;
    }
    return null;
  }

  function injectLinkControls() {
    document.querySelectorAll(adapter.selectors.entityLink).forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) return;
      const entityId = adapter.extractEntityId(link);
      if (!entityId || link.parentElement?.querySelector(`[data-rr-entity-id="${cssEscape(entityId)}"]`)) return;

      const annotation = storage.get(entityId);
      const wrapper = document.createElement('span');
      wrapper.className = 'rr-remarks-inline';
      wrapper.dataset.rrRemarksUi = 'inline';
      wrapper.dataset.rrEntityId = entityId;

      wrapper.append(
        makeEditButton(entityId, annotation),
        makeCopyButton(entityId),
        makeOpenButton(entityId),
      );
      link.insertAdjacentElement('afterend', wrapper);
    });
  }

  function injectDetailPanel() {
    const page = adapter.routes.parse(window.location.pathname);
    if (page.type !== 'profile' || !page.id) return;

    const anchor = document.querySelector(adapter.selectors.detailHeader);
    if (!anchor || anchor.querySelector(`[data-rr-detail-id="${cssEscape(page.id)}"]`)) return;

    const annotation = storage.get(page.id);
    const panel = document.createElement('div');
    panel.className = `rr-remarks-panel ${getTagTone(page.id)}`;
    panel.dataset.rrRemarksUi = 'detail';
    panel.dataset.rrDetailId = page.id;

    const label = document.createElement('strong');
    label.textContent = t('walletNote');
    const note = document.createElement('span');
    note.textContent = formatAnnotationLabel(annotation, t('noWalletNote'));
    note.title = formatAnnotationTitle(annotation);

    panel.append(label, note, makeEditButton(page.id, annotation), makeCopyButton(page.id));
    anchor.prepend(panel);
  }

  function injectTradeRecordRemarks() {
    const page = adapter.routes.parse(window.location.pathname);
    if (page.type !== 'trade') return;

    document.querySelectorAll(adapter.selectors.tradeRecordTitle).forEach((title) => {
      if ((title.textContent || '').trim() !== '\u4ea4\u6613\u8bb0\u5f55') return;

      const container = title.closest('div');
      const table = container?.parentElement?.querySelector(adapter.selectors.tradeRecordTable);
      if (!table) return;

      const headers = Array.from(table.querySelectorAll('thead th')).map((th) =>
        (th.textContent || '').trim(),
      );
      const traderIndex = headers.findIndex((header) => header === '\u4ea4\u6613\u8005');
      if (traderIndex < 0) return;

      table.querySelectorAll('tbody tr').forEach((row) => {
        const cells = row.querySelectorAll(adapter.selectors.tradeTraderCell);
        const traderCell = cells[traderIndex];
        if (!traderCell || row.querySelector('[data-rr-remarks-ui="trade-note"]')) return;

        const traderButton = traderCell.querySelector('button');
        const addressLabel = extractTraderAddressLabel(traderButton || traderCell);
        if (!isLikelyTraderAddressLabel(addressLabel)) return;

        const annotation = storage.findByAddressLabel(addressLabel);
        if (!hasAnnotationDisplay(annotation)) {
          const addButton = makeQuickAddTradeButton(addressLabel, traderButton);
          (traderButton || traderCell).insertAdjacentElement('afterend', addButton);
          return;
        }

        const note = document.createElement('span');
        note.className = `rr-remarks-trader-note ${getTagTone(annotation.entityId)}`;
        note.dataset.rrRemarksUi = 'trade-note';
        note.dataset.rrEntityId = annotation.entityId;
        note.textContent = formatAnnotationLabel(annotation, annotation.entityId);
        note.title = formatAnnotationTitle(annotation);

        (traderButton || traderCell).insertAdjacentElement('afterend', note);
      });
    });
  }

  function makeQuickAddTradeButton(addressLabel, traderButton) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rr-remarks-trader-add';
    button.dataset.rrRemarksUi = 'trade-note';
    button.dataset.rrEntityId = addressLabel;
    button.textContent = `+ ${t('addWalletNoteShort')}`;
    button.title = t('addWalletNote');
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      waitForTraderWalletCopy(addressLabel, traderButton, button);
    });
    return button;
  }

  function listenForClipboardCapture() {
    window.addEventListener('message', (event) => {
      if (event.source !== window || event.data?.source !== 'rr-remarks-clipboard') return;
      const wallet = String(event.data.text || '').trim();
      if (!isLikelySolanaAddress(wallet)) return;
      void handleCapturedWallet(wallet);
    });
  }

  function waitForTraderWalletCopy(addressLabel, traderButton, addButton) {
    if (!traderButton) {
      void openMessageDialog(t('clickTraderCopyFirst'));
      return;
    }

    clearPendingWalletCapture();
    pendingWalletCapture = {
      addressLabel,
      addButton,
      expiresAt: Date.now() + 15000,
      traderButton,
      timeoutId: window.setTimeout(clearPendingWalletCapture, 15000),
    };
    traderButton.classList.add('rr-remarks-copy-target');
    addButton.classList.add('waiting');
    addButton.textContent = t('clickTraderCopyFirst');
    addButton.title = t('clickTraderCopyFirst');
    armClipboardBridge(15000);
  }

  function armClipboardBridge(durationMs) {
    try {
      window.postMessage(
        { source: 'rr-remarks-clipboard-arm', durationMs },
        window.location.origin,
      );
    } catch (_error) {}
  }

  async function handleCapturedWallet(wallet) {
    if (!pendingWalletCapture || pendingWalletCapture.expiresAt < Date.now()) {
      clearPendingWalletCapture();
      return;
    }

    const { addressLabel } = pendingWalletCapture;
    clearPendingWalletCapture();
    const existingAnnotation = storage.get(wallet)
      || storage.findByAddressLabel(addressLabel)
      || storage.get(addressLabel);
    const result = await openRemarkDialog({
      entityId: wallet,
      initialNote: existingAnnotation?.note || '',
      initialTags: formatTagsInput(existingAnnotation),
      requireNote: true,
    });
    if (!result) return;
    try {
      await storage.upsert({
        entityId: wallet,
        note: result.note,
        tags: result.tags,
      });

      const compactAlias = storage.get(addressLabel);
      if (compactAlias && compactAlias.entityId !== wallet) {
        await storage.remove(addressLabel);
      }
    } catch (error) {
      if (handleExtensionContextError(error)) return;
      throw error;
    }
    refreshInjectedUi();
  }

  function clearPendingWalletCapture() {
    if (!pendingWalletCapture) return;
    window.clearTimeout(pendingWalletCapture.timeoutId);
    pendingWalletCapture.traderButton?.classList.remove('rr-remarks-copy-target');
    pendingWalletCapture.addButton?.classList.remove('waiting');
    pendingWalletCapture = null;
    armClipboardBridge(0);
  }

  function isLikelySolanaAddress(value) {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
  }

  function isLikelyTraderAddressLabel(value) {
    const text = String(value || '').trim();
    if (!text || text === '\u6211' || /^me$/i.test(text)) return false;
    return isLikelySolanaAddress(text)
      || /^[1-9A-HJ-NP-Za-km-z]{2,}(?:\.{3}|\u2026)[1-9A-HJ-NP-Za-km-z]{2,}$/.test(text);
  }

  function makeEditButton(entityId, annotation) {
    const button = document.createElement('button');
    button.type = 'button';
    const buttonLabel = formatAnnotationLabel(annotation, t('addWalletNote'));
    button.className = `rr-remarks-button${hasAnnotationDisplay(annotation) ? ' has-note' : ''}`;
    button.dataset.rrRemarksUi = 'edit';
    button.textContent = buttonLabel;
    button.title = hasAnnotationDisplay(annotation) ? `${t('editWalletNote')}: ${buttonLabel}` : t('addWalletNote');
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const currentAnnotation = storage.get(entityId) || annotation;
      const result = await openRemarkDialog({
        entityId,
        initialNote: currentAnnotation?.note || '',
        initialTags: formatTagsInput(currentAnnotation),
        requireNote: false,
      });
      if (!result) return;
      try {
        await storage.upsert({
          entityId,
          note: result.note,
          tags: result.tags,
        });
      } catch (error) {
        if (handleExtensionContextError(error)) return;
        throw error;
      }
      refreshInjectedUi();
    });
    return button;
  }

  function makeCopyButton(entityId) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rr-remarks-copy';
    button.dataset.rrRemarksUi = 'copy';
    button.textContent = '#';
    button.title = t('copyWalletAddress');
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await navigator.clipboard.writeText(entityId);
      button.textContent = 'OK';
      window.setTimeout(() => {
        button.textContent = '#';
      }, 900);
    });
    return button;
  }

  function makeOpenButton(entityId) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rr-remarks-open';
    button.dataset.rrRemarksUi = 'open';
    button.textContent = '>';
    button.title = t('openProfile');
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.open(adapter.externalLinks.profile(entityId), '_blank', 'noopener');
    });
    return button;
  }

  function hasAnnotationDisplay(annotation) {
    return Boolean(formatAnnotationLabel(annotation, ''));
  }

  function formatAnnotationLabel(annotation, fallback) {
    if (!annotation) return fallback;
    const parts = [
      String(annotation.note || '').trim(),
      formatTagsInput(annotation),
    ].filter(Boolean);
    return parts.length ? parts.join('\u4e28') : fallback;
  }

  function formatAnnotationTitle(annotation) {
    if (!annotation) return '';
    return [
      annotation.entityId,
      formatAnnotationLabel(annotation, ''),
    ]
      .filter(Boolean)
      .join('\n');
  }

  function formatTagsInput(annotation) {
    return (annotation?.tags || [])
      .map((tag) => String(tag).trim())
      .filter(Boolean)
      .join(', ');
  }

  function refreshInjectedUi() {
    removeInjectedUi();
    scheduleProcess();
  }

  function openMessageDialog(message) {
    return openDialog({
      title: t('noticeTitle'),
      message,
      fields: false,
      confirmLabel: t('ok'),
    });
  }

  function openRemarkDialog({ entityId, initialNote, initialTags, requireNote }) {
    return openDialog({
      title: initialNote ? t('editWalletNote') : t('addWalletNote'),
      entityId,
      fields: true,
      initialNote,
      initialTags,
      requireNote,
      confirmLabel: t('saveRemark'),
    });
  }

  function openDialog(options) {
    if (activeDialogClose) activeDialogClose(null);

    return new Promise((resolve) => {
      const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const overlay = document.createElement('div');
      overlay.className = 'rr-remarks-modal-backdrop';
      overlay.dataset.rrRemarksUi = 'dialog';

      const dialog = document.createElement('section');
      dialog.className = 'rr-remarks-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'rr-remarks-dialog-title');

      const header = document.createElement('header');
      header.className = 'rr-remarks-dialog-header';

      const title = document.createElement('h2');
      title.id = 'rr-remarks-dialog-title';
      title.className = 'rr-remarks-dialog-title';
      title.textContent = options.title;

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'rr-remarks-dialog-close';
      closeButton.textContent = '\u00d7';
      closeButton.title = t('cancel');

      header.append(title, closeButton);
      dialog.append(header);

      if (options.entityId) {
        const wallet = document.createElement('p');
        wallet.className = 'rr-remarks-dialog-wallet';
        wallet.textContent = options.entityId;
        dialog.append(wallet);
      }

      if (options.message) {
        const message = document.createElement('p');
        message.className = 'rr-remarks-dialog-message';
        message.textContent = options.message;
        dialog.append(message);
      }

      let noteInput = null;
      let tagsInput = null;
      let error = null;

      if (options.fields) {
        const existingTags = collectExistingTags();
        noteInput = document.createElement('textarea');
        noteInput.className = 'rr-remarks-dialog-input';
        noteInput.value = options.initialNote || '';
        noteInput.placeholder = t('walletNote');
        noteInput.rows = 4;

        tagsInput = document.createElement('input');
        tagsInput.className = 'rr-remarks-dialog-input';
        tagsInput.value = options.initialTags || '';
        tagsInput.placeholder = t('tagsPlaceholder');
        tagsInput.setAttribute('list', 'rr-remarks-existing-tags');

        error = document.createElement('p');
        error.className = 'rr-remarks-dialog-error';
        error.textContent = t('noteRequired');
        error.hidden = true;

        dialog.append(
          makeDialogField(t('walletNote'), noteInput),
          makeTagPickerField(tagsInput, existingTags),
          error,
        );
      }

      const footer = document.createElement('footer');
      footer.className = 'rr-remarks-dialog-actions';

      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'rr-remarks-dialog-secondary';
      cancelButton.textContent = t('cancel');

      const confirmButton = document.createElement('button');
      confirmButton.type = 'button';
      confirmButton.className = 'rr-remarks-dialog-primary';
      confirmButton.textContent = options.confirmLabel || t('ok');

      if (options.fields) {
        footer.append(cancelButton, confirmButton);
      } else {
        footer.append(confirmButton);
      }
      dialog.append(footer);
      overlay.append(dialog);

      const close = (result) => {
        if (activeDialogClose === close) activeDialogClose = null;
        document.removeEventListener('keydown', handleKeydown, true);
        overlay.remove();
        previousFocus?.focus?.();
        resolve(result);
      };

      const save = () => {
        if (!options.fields) {
          close(true);
          return;
        }

        const note = noteInput.value.trim();
        if (options.requireNote && !note) {
          error.hidden = false;
          noteInput.focus();
          return;
        }
        close({ note, tags: tagsInput.value.trim() });
      };

      const handleKeydown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          close(null);
        }
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          save();
        }
      };

      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) close(null);
      });
      closeButton.addEventListener('click', () => close(null));
      cancelButton.addEventListener('click', () => close(null));
      confirmButton.addEventListener('click', save);
      document.addEventListener('keydown', handleKeydown, true);

      document.body.append(overlay);
      activeDialogClose = close;
      (noteInput || confirmButton).focus();
    });
  }

  function makeDialogField(labelText, control) {
    const label = document.createElement('label');
    label.className = 'rr-remarks-dialog-field';
    const labelNode = document.createElement('span');
    labelNode.textContent = labelText;
    label.append(labelNode, control);
    return label;
  }

  function makeTagPickerField(tagsInput, existingTags) {
    const field = makeDialogField(t('tagsPrompt'), tagsInput);
    const dataList = document.createElement('datalist');
    dataList.id = 'rr-remarks-existing-tags';
    existingTags.forEach((tag) => {
      const option = document.createElement('option');
      option.value = tag;
      dataList.append(option);
    });
    field.append(dataList);

    if (!existingTags.length) return field;

    const select = document.createElement('select');
    select.className = 'rr-remarks-tag-select';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = t('selectExistingTag');
    select.append(placeholder);
    existingTags.forEach((tag) => {
      const option = document.createElement('option');
      option.value = tag;
      option.textContent = tag;
      select.append(option);
    });
    select.addEventListener('change', () => {
      if (!select.value) return;
      tagsInput.value = addTagInputValue(tagsInput.value, select.value);
      updateAllTagOptionStates(picker, tagsInput.value);
      select.value = '';
      tagsInput.focus();
    });

    const picker = document.createElement('div');
    picker.className = 'rr-remarks-tag-picker';
    picker.setAttribute('aria-label', t('existingTags'));

    existingTags.forEach((tag) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rr-remarks-tag-option';
      button.textContent = tag;
      updateTagOptionState(button, tag, tagsInput.value);
      button.addEventListener('click', () => {
        tagsInput.value = toggleTagInputValue(tagsInput.value, tag);
        updateAllTagOptionStates(picker, tagsInput.value);
        tagsInput.focus();
      });
      picker.append(button);
    });

    tagsInput.addEventListener('input', () => {
      updateAllTagOptionStates(picker, tagsInput.value);
    });

    field.append(select, picker);
    return field;
  }

  function collectExistingTags() {
    const seen = new Set();
    storage.all().forEach((item) => {
      (item.tags || []).forEach((tag) => {
        const normalized = String(tag).trim();
        if (normalized) seen.add(normalized);
      });
    });
    return Array.from(seen).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  function toggleTagInputValue(value, tag) {
    const tags = parseTagInputValue(value);
    const index = tags.findIndex((item) => item.toLowerCase() === tag.toLowerCase());
    if (index >= 0) {
      tags.splice(index, 1);
    } else {
      tags.push(tag);
    }
    return tags.join(', ');
  }

  function addTagInputValue(value, tag) {
    const tags = parseTagInputValue(value);
    if (!tags.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      tags.push(tag);
    }
    return tags.join(', ');
  }

  function parseTagInputValue(value) {
    return String(value || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  function updateAllTagOptionStates(picker, value) {
    picker.querySelectorAll('.rr-remarks-tag-option').forEach((button) => {
      updateTagOptionState(button, button.textContent || '', value);
    });
  }

  function updateTagOptionState(button, tag, value) {
    const selected = parseTagInputValue(value)
      .some((item) => item.toLowerCase() === tag.toLowerCase());
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
  }

  function extractTraderAddressLabel(node) {
    const span = node?.querySelector?.('span');
    return ((span || node)?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, '\\$&');
  }
})();
