(async function () {
  const adapter = window.RiseRichAdapter;
  const AnnotationStorage = window.RRAnnotationStorage;
  const ChromeStorageArea = window.RRChromeStorageArea;
  const createTranslator = window.RRI18n.createTranslator;
  const RBOT_TRADE_URL = 'https://rise.rich/trade/89ib7vR1bTdKEACWkjuBcMbuGaWpmQcBFB7N3Ddvrise';
  const title = document.querySelector('#title');
  const enabled = document.querySelector('#enabled');
  const enabledLabel = document.querySelector('#enabledLabel');
  const languageLabel = document.querySelector('#languageLabel');
  const language = document.querySelector('#language');
  const languageAuto = document.querySelector('#languageAuto');
  const gateCard = document.querySelector('#gateCard');
  const gateTitle = document.querySelector('#gateTitle');
  const gateDetail = document.querySelector('#gateDetail');
  const retryGate = document.querySelector('#retryGate');
  const count = document.querySelector('#count');
  const openOptions = document.querySelector('#openOptions');
  const poweredLinks = document.querySelectorAll('.powered a');

  const storage = new AnnotationStorage(
    new ChromeStorageArea(chrome.storage.local),
    adapter.storageKeys.annotations,
  );
  await storage.load();

  const settingsResult = await chrome.storage.local.get([
    adapter.storageKeys.settings,
    adapter.storageKeys.eligibility,
  ]);
  const settings = Object.assign({ enabled: true, language: 'auto' }, settingsResult[adapter.storageKeys.settings]);
  let eligibilityState = settingsResult[adapter.storageKeys.eligibility] || null;
  const t = () => createTranslator(settings.language, navigator.language);
  language.value = settings.language;
  applyCopy();

  enabled.addEventListener('change', async () => {
    await chrome.storage.local.set({
      [adapter.storageKeys.settings]: Object.assign(settings, { enabled: enabled.checked }),
    });
  });

  language.addEventListener('change', async () => {
    settings.language = language.value;
    applyCopy();
    await chrome.storage.local.set({
      [adapter.storageKeys.settings]: settings,
    });
  });

  openOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  poweredLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      openExternalUrl(link.href);
    });
  });

  retryGate.addEventListener('click', async () => {
    eligibilityState = {
      allowed: false,
      balanceUi: '0',
      checkedAt: Date.now(),
      forceRetryAt: Date.now(),
      requiredAmount: eligibilityState?.requiredAmount || 1000,
      status: 'checking',
      wallet: eligibilityState?.wallet || '',
    };
    applyCopy();
    await chrome.storage.local.set({
      [adapter.storageKeys.eligibility]: eligibilityState,
      [adapter.storageKeys.eligibilityRetry]: Date.now(),
    });
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes[adapter.storageKeys.eligibility]) {
      eligibilityState = changes[adapter.storageKeys.eligibility].newValue || null;
      applyCopy();
    }
  });

  function applyCopy() {
    const translate = t();
    const allowed = eligibilityState?.allowed === true;
    document.title = translate('title');
    title.textContent = translate('title');
    enabledLabel.textContent = translate('enableAnnotations');
    enabled.disabled = !allowed;
    enabled.checked = allowed && settings.enabled;
    languageLabel.textContent = translate('language');
    languageAuto.textContent = translate('autoLanguage');
    const gateCopy = getGateCopy(translate, eligibilityState);
    gateTitle.textContent = gateCopy.title;
    gateDetail.textContent = '';
    if (gateCopy.renderDetail) {
      gateCopy.renderDetail(gateDetail);
    } else {
      gateDetail.textContent = gateCopy.detail;
    }
    gateCard.className = `gate-card ${allowed ? 'allowed' : 'locked'}`;
    count.textContent = translate('remarksSaved', storage.all().length);
    openOptions.textContent = translate('manageRemarks');
  }

  function getGateCopy(translate, state) {
    const required = state?.requiredAmount || 1000;
    if (!state) {
      return {
        title: translate('gateUnknown'),
        detail: translate('gateNoWallet'),
      };
    }
    if (state.status === 'authorized') {
      return {
        title: settings.language === 'en' ? 'Page annotations enabled' : '\u9875\u9762\u5907\u6ce8\u5df2\u542f\u7528',
        detail: settings.language === 'en'
          ? `Threshold ${required} · Current ${state.balanceUi} · ${shortWallet(state.wallet)}`
          : `\u95e8\u69db ${required} \u00b7 \u5f53\u524d ${state.balanceUi} \u00b7 ${shortWallet(state.wallet)}`,
      };
    }
    if (state.status === 'checking') {
      return {
        title: translate('gateChecking'),
        detail: settings.language === 'en' ? 'Checking wallet token balance.' : '\u6b63\u5728\u8bfb\u53d6\u94b1\u5305\u4ee3\u5e01\u4f59\u989d\u3002',
      };
    }
    if (state.status === 'insufficient') {
      return {
        title: settings.language === 'en' ? 'RBOT balance too low' : 'RBOT 代币余额不足',
        renderDetail: (target) => renderInsufficientGateDetail(target, state, required),
      };
    }
    if (state.status === 'no_wallet') {
      return {
        title: settings.language === 'en' ? 'Wallet not detected' : '\u672a\u8bfb\u53d6\u5230\u94b1\u5305',
        detail: translate('gateNoWallet'),
      };
    }
    return {
      title: settings.language === 'en' ? 'Verification failed' : '\u9a8c\u8bc1\u5931\u8d25',
      detail: settings.language === 'en'
        ? `${state.error || 'Unknown RPC error'}. Retry or change RPC.`
        : `${state.error || '\u672a\u77e5 RPC \u9519\u8bef'}\u3002\u8bf7\u91cd\u8bd5\u6216\u66f4\u6362 RPC\u3002`,
    };
  }

  function shortWallet(wallet) {
    const text = String(wallet || '');
    if (text.length <= 12) return text || '-';
    return `${text.slice(0, 4)}...${text.slice(-4)}`;
  }

  function renderInsufficientGateDetail(target, state, required) {
    if (settings.language === 'en') {
      target.append(
        `Need ${required} `,
        makeRbotLink(),
        ` · Current ${state.balanceUi} · ${shortWallet(state.wallet)}`,
      );
      return;
    }
    target.append(
      `需要 ${required} `,
      makeRbotLink(),
      ` · 当前 ${state.balanceUi} · ${shortWallet(state.wallet)}`,
    );
  }

  function makeRbotLink() {
    const link = document.createElement('a');
    link.href = RBOT_TRADE_URL;
    link.textContent = 'RBOT';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      openExternalUrl(RBOT_TRADE_URL);
    });
    return link;
  }

  function openExternalUrl(url) {
    if (chrome.tabs?.create) {
      chrome.tabs.create({ url });
      return;
    }
    window.open(url, '_blank', 'noopener');
  }
})();
