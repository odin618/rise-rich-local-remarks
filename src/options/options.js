(async function () {
  const adapter = window.RiseRichAdapter;
  const AnnotationStorage = window.RRAnnotationStorage;
  const ChromeStorageArea = window.RRChromeStorageArea;
  const getTagTone = window.RRGetTagTone;
  const createTranslator = window.RRI18n.createTranslator;
  const storage = new AnnotationStorage(
    new ChromeStorageArea(chrome.storage.local),
    adapter.storageKeys.annotations,
  );

  const fields = {
    title: document.querySelector('#title'),
    languageLabel: document.querySelector('#languageLabel'),
    language: document.querySelector('#language'),
    languageAuto: document.querySelector('#languageAuto'),
    dataToolsTitle: document.querySelector('#dataToolsTitle'),
    dataToolsStatus: document.querySelector('#dataToolsStatus'),
    customRpcEndpointLabel: document.querySelector('#customRpcEndpointLabel'),
    customRpcEndpoint: document.querySelector('#customRpcEndpoint'),
    saveRpcEndpoint: document.querySelector('#saveRpcEndpoint'),
    entityId: document.querySelector('#entityId'),
    note: document.querySelector('#note'),
    tags: document.querySelector('#tags'),
    search: document.querySelector('#search'),
    list: document.querySelector('#remarks'),
    save: document.querySelector('#saveRemark'),
    exportJson: document.querySelector('#exportJson'),
    importJson: document.querySelector('#importJson'),
  };

  await storage.load();
  const settingsResult = await chrome.storage.local.get(adapter.storageKeys.settings);
  const settings = Object.assign({ language: 'auto' }, settingsResult[adapter.storageKeys.settings]);
  let t = createTranslator(settings.language, navigator.language);
  fields.language.value = settings.language;
  fields.customRpcEndpoint.value = settings.customRpcEndpoint || '';
  applyCopy();
  render();

  fields.save.addEventListener('click', saveCurrent);
  fields.search.addEventListener('input', render);
  fields.exportJson.addEventListener('click', exportJson);
  fields.importJson.addEventListener('change', importJson);
  fields.customRpcEndpoint.addEventListener('input', () => fields.customRpcEndpoint.setCustomValidity(''));
  fields.saveRpcEndpoint.addEventListener('click', saveSettingsAndRetryEligibility);
  fields.language.addEventListener('change', async () => {
    settings.language = fields.language.value;
    t = createTranslator(settings.language, navigator.language);
    applyCopy();
    render();
    await saveSettings();
  });

  async function saveSettingsAndRetryEligibility() {
    const customRpcEndpoint = fields.customRpcEndpoint.value.trim();
    if (customRpcEndpoint && !getEndpointOriginPattern(customRpcEndpoint)) {
      fields.customRpcEndpoint.setCustomValidity(t('customRpcInvalid'));
      fields.customRpcEndpoint.reportValidity();
      return;
    }

    const permissionGranted = await requestRpcEndpointPermission(customRpcEndpoint);
    if (!permissionGranted) {
      fields.customRpcEndpoint.setCustomValidity(t('customRpcPermissionDenied'));
      fields.customRpcEndpoint.reportValidity();
      fields.customRpcEndpoint.value = settings.customRpcEndpoint || '';
      return;
    }

    fields.customRpcEndpoint.setCustomValidity('');
    settings.customRpcEndpoint = customRpcEndpoint;
    await chrome.storage.local.remove(adapter.storageKeys.eligibility);
    await chrome.storage.local.set({
      [adapter.storageKeys.settings]: settings,
      [adapter.storageKeys.eligibilityRetry]: Date.now(),
    });
  }

  async function requestRpcEndpointPermission(endpoint) {
    const origin = getEndpointOriginPattern(endpoint);
    if (!origin || !chrome.permissions?.request) return true;

    const alreadyGranted = await chrome.permissions
      .contains({ origins: [origin] })
      .catch(() => false);
    if (alreadyGranted) return true;

    return chrome.permissions
      .request({ origins: [origin] })
      .catch(() => false);
  }

  function getEndpointOriginPattern(endpoint) {
    if (!endpoint) return '';
    try {
      const url = new URL(endpoint);
      if (url.protocol !== 'https:') return '';
      return `${url.protocol}//${url.host}/*`;
    } catch (_error) {
      return '';
    }
  }

  async function saveSettings() {
    await chrome.storage.local.set({
      [adapter.storageKeys.settings]: settings,
    });
  }

  async function saveCurrent() {
    await storage.upsert({
      entityId: fields.entityId.value,
      note: fields.note.value,
      tags: fields.tags.value,
    });
    fields.entityId.value = '';
    fields.note.value = '';
    fields.tags.value = '';
    render();
  }

  function render() {
    const query = fields.search.value.trim().toLowerCase();
    const items = storage.all().filter((item) => {
      const haystack = [item.entityId, item.note, ...(item.tags || [])]
        .join(' ')
        .toLowerCase();
      return !query || haystack.includes(query);
    });

    fields.list.textContent = '';
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'meta';
      empty.textContent = t('noRemarksFound');
      fields.list.append(empty);
      return;
    }

    for (const item of items) {
      fields.list.append(renderItem(item));
    }
  }

  function renderItem(item) {
    const row = document.createElement('article');
    row.className = `remark ${getTagTone(item.entityId)}`;

    const body = document.createElement('div');
    const title = document.createElement('h2');
    const label = document.createElement('span');
    label.className = `wallet-label ${getTagTone(item.entityId)}`;
    label.textContent = formatAnnotationLabel(item, item.entityId);
    title.append(label);
    const note = document.createElement('p');
    note.textContent = item.entityId;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${item.entityId} | ${(item.tags || []).join(', ')} | ${item.updatedAt}`;
    body.append(title, note, meta);

    const buttons = document.createElement('div');
    buttons.className = 'buttons';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = t('edit');
    edit.addEventListener('click', () => loadIntoEditor(item));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger';
    remove.textContent = 'Delete';
    remove.addEventListener('click', async () => {
      await storage.remove(item.entityId);
      render();
    });
    buttons.append(edit, remove);

    row.append(body, buttons);
    return row;
  }

  function loadIntoEditor(item) {
    fields.entityId.value = item.entityId;
    fields.note.value = item.note || '';
    fields.tags.value = (item.tags || []).join(', ');
    fields.note.focus();
  }

  function formatAnnotationLabel(item, fallback) {
    const parts = [
      String(item?.note || '').trim(),
      (item?.tags || []).map((tag) => String(tag).trim()).filter(Boolean).join(', '),
    ].filter(Boolean);
    return parts.length ? parts.join('\u4e28') : fallback;
  }

  function applyCopy() {
    document.title = t('titleManager');
    fields.title.textContent = t('title');
    fields.languageLabel.textContent = t('language');
    fields.languageAuto.textContent = t('autoLanguage');
    fields.dataToolsTitle.textContent = t('dataToolsTitle');
    fields.customRpcEndpointLabel.textContent = t('customRpcEndpoint');
    fields.customRpcEndpoint.placeholder = t('customRpcEndpointPlaceholder');
    fields.saveRpcEndpoint.textContent = t('saveRpcEndpoint');
    fields.entityId.placeholder = t('walletAddress');
    fields.note.placeholder = t('walletNote');
    fields.tags.placeholder = t('tagsPlaceholder');
    fields.save.textContent = t('saveRemark');
    fields.search.placeholder = t('searchRemarks');
    fields.exportJson.textContent = t('exportJson');
    document.querySelector('#importJsonLabel').textContent = t('importJson');
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(storage.exportJson(), null, 2)], {
      type: 'application/json',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rise-rich-remarks-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    fields.dataToolsStatus.textContent = t('exportJsonDone', storage.all().length);
  }

  async function importJson(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const beforeCount = storage.all().length;
      const text = await file.text();
      await storage.importJson(JSON.parse(text));
      event.target.value = '';
      render();
      fields.dataToolsStatus.textContent = t('importJsonDone', storage.all().length - beforeCount);
    } catch (error) {
      event.target.value = '';
      fields.dataToolsStatus.textContent = t('importJsonFailed');
    }
  }
})();
