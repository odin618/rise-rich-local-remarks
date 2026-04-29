(function (root) {
  function shortWallet(wallet) {
    const text = String(wallet || '');
    if (text.length <= 12) return text || '-';
    return `${text.slice(0, 4)}...${text.slice(-4)}`;
  }

  const MESSAGES = {
    en: {
      addWalletNote: 'Add wallet note',
      addWalletNoteShort: 'Add',
      clickTraderCopyFirst: 'Click the trader address to copy first.',
      acknowledgementName: 'Chumo_btc',
      acknowledgementText: 'Thanks to',
      acknowledgementTitle: 'Acknowledgements',
      acknowledgementSuffix: 'for technical support.',
      autoLanguage: 'Auto',
      cancel: 'Cancel',
      copyWalletAddress: 'Copy wallet address',
      customRpcEndpoint: 'Custom RPC',
      customRpcEndpointPlaceholder: 'Leave empty to use default RPC',
      customRpcInvalid: 'Enter a valid HTTPS RPC URL.',
      customRpcPermissionDenied: 'Chrome permission is required before this custom RPC can be used.',
      dataToolsTitle: 'Data',
      edit: 'Edit',
      editWalletNote: 'Edit wallet note',
      enableAnnotations: 'Enable page annotations',
      existingTags: 'Existing tags',
      exportJson: 'Export Data',
      exportJsonDone: (count) => `Exported ${count} ${count === 1 ? 'remark' : 'remarks'}.`,
      gateAuthorized: (wallet, balance, required) => `Page annotations enabled: threshold ${required}, ${shortWallet(wallet)} currently holds ${balance}.`,
      gateChecking: 'Checking token gate...',
      gateError: (error) => `Verification failed: ${error || 'unknown RPC error'}. Please retry or change RPC.`,
      gateInsufficient: (wallet, balance, required) => `Page annotations require at least ${required} RBOT tokens. ${shortWallet(wallet)} currently holds ${balance}.`,
      gateNoWallet: 'Please log in to rise.rich first. Wallet address was not detected.',
      gateUnknown: 'Access not verified yet.',
      importJson: 'Import Data',
      importJsonDone: (count) => `Imported ${count} new ${count === 1 ? 'remark' : 'remarks'}.`,
      importJsonFailed: 'Import failed. Choose a valid JSON file.',
      language: 'Language',
      manageRemarks: 'Manage remarks',
      noRemarksFound: 'No remarks found.',
      noWalletNote: 'No wallet note',
      noteRequired: 'Enter a wallet note before saving.',
      noticeTitle: 'Notice',
      ok: 'OK',
      openProfile: 'Open rise.rich profile',
      remarksSaved: (count) => `${count} ${count === 1 ? 'remark' : 'remarks'} saved`,
      saveRpcEndpoint: 'Save RPC',
      saveRemark: 'Save remark',
      searchRemarks: 'Search remarks',
      selectExistingTag: 'Select existing tag',
      tagsPrompt: 'Tags separated by commas',
      tagsPlaceholder: 'Tags, separated by commas',
      title: 'Rise.Rich Remarks',
      titleManager: 'Rise.Rich Remarks Manager',
      walletAddress: 'Wallet address',
      walletNote: 'Wallet note',
      walletNoteFor: (wallet) => `Wallet note for ${wallet}`,
    },
    zh: {
      addWalletNote: '\u6dfb\u52a0\u94b1\u5305\u5907\u6ce8',
      addWalletNoteShort: '\u6dfb\u52a0\u5907\u6ce8',
      clickTraderCopyFirst: '\u8bf7\u5148\u70b9\u51fb\u5de6\u4fa7\u4ea4\u6613\u8005\u5730\u5740\u590d\u5236\u4e00\u6b21',
      acknowledgementName: '\u521d\u58a8\u4e0d\u59d3\u718a',
      acknowledgementText: '\u9e23\u8c22',
      acknowledgementTitle: '\u9e23\u8c22',
      acknowledgementSuffix: '\u63d0\u4f9b\u6280\u672f\u652f\u6301',
      autoLanguage: '\u81ea\u52a8',
      cancel: '\u53d6\u6d88',
      copyWalletAddress: '\u590d\u5236\u94b1\u5305\u5730\u5740',
      customRpcEndpoint: '\u81ea\u5b9a\u4e49 RPC',
      customRpcEndpointPlaceholder: '\u7559\u7a7a\u5219\u4f7f\u7528\u9ed8\u8ba4 RPC',
      customRpcInvalid: '\u8bf7\u8f93\u5165\u6709\u6548\u7684 HTTPS RPC \u5730\u5740\u3002',
      customRpcPermissionDenied: '\u9700\u8981\u5148\u6388\u6743 Chrome \u8bbf\u95ee\u8be5\u81ea\u5b9a\u4e49 RPC\u3002',
      dataToolsTitle: '\u6570\u636e',
      edit: '\u7f16\u8f91',
      editWalletNote: '\u7f16\u8f91\u94b1\u5305\u5907\u6ce8',
      enableAnnotations: '\u542f\u7528\u9875\u9762\u5907\u6ce8',
      existingTags: '\u5df2\u6709\u6807\u7b7e',
      exportJson: '\u5bfc\u51fa\u6570\u636e',
      exportJsonDone: (count) => `\u5df2\u5bfc\u51fa ${count} \u6761\u5907\u6ce8\u3002`,
      gateAuthorized: (wallet, balance, required) => `\u9875\u9762\u5907\u6ce8\u5df2\u542f\u7528\uff1a\u95e8\u69db ${required} \u4e2a\uff0c${shortWallet(wallet)} \u5f53\u524d\u6301\u6709 ${balance} \u4e2a\u3002`,
      gateChecking: '\u6b63\u5728\u9a8c\u8bc1\u4ee3\u5e01\u95e8\u69db...',
      gateError: (error) => `\u9a8c\u8bc1\u5931\u8d25\uff1a${error || '\u672a\u77e5 RPC \u9519\u8bef'}\u3002\u8bf7\u91cd\u8bd5\u6216\u66f4\u6362 RPC\u3002`,
      gateInsufficient: (wallet, balance, required) => `\u9700\u8981\u6301\u6709\u81f3\u5c11 ${required} \u4e2a RBOT \u4ee3\u5e01\u624d\u53ef\u5f00\u542f\u9875\u9762\u5907\u6ce8\uff0c${shortWallet(wallet)} \u5f53\u524d\u6301\u6709 ${balance} \u4e2a\u3002`,
      gateNoWallet: '\u8bf7\u5148\u767b\u5f55 rise.rich\uff0c\u5f53\u524d\u672a\u8bfb\u53d6\u5230\u94b1\u5305\u5730\u5740\u3002',
      gateUnknown: '\u5c1a\u672a\u9a8c\u8bc1\u8bbf\u95ee\u6743\u9650\u3002',
      importJson: '\u5bfc\u5165\u6570\u636e',
      importJsonDone: (count) => `\u5df2\u5bfc\u5165 ${count} \u6761\u65b0\u5907\u6ce8\u3002`,
      importJsonFailed: '\u5bfc\u5165\u5931\u8d25\uff0c\u8bf7\u9009\u62e9\u6709\u6548\u7684 JSON \u6587\u4ef6\u3002',
      language: '\u8bed\u8a00',
      manageRemarks: '\u7ba1\u7406\u5907\u6ce8',
      noRemarksFound: '\u6ca1\u6709\u627e\u5230\u5907\u6ce8\u3002',
      noWalletNote: '\u6682\u65e0\u94b1\u5305\u5907\u6ce8',
      noteRequired: '\u8bf7\u5148\u8f93\u5165\u94b1\u5305\u5907\u6ce8\u3002',
      noticeTitle: '\u63d0\u793a',
      ok: '\u786e\u5b9a',
      openProfile: '\u6253\u5f00 rise.rich \u4e3b\u9875',
      remarksSaved: (count) => `\u5df2\u4fdd\u5b58 ${count} \u6761\u5907\u6ce8`,
      saveRpcEndpoint: '\u4fdd\u5b58 RPC',
      saveRemark: '\u4fdd\u5b58\u5907\u6ce8',
      searchRemarks: '\u641c\u7d22\u5907\u6ce8',
      selectExistingTag: '\u9009\u62e9\u5df2\u6709\u6807\u7b7e',
      tagsPrompt: '\u6807\u7b7e\u7528\u82f1\u6587\u9017\u53f7\u5206\u9694',
      tagsPlaceholder: '\u6807\u7b7e\uff0c\u7528\u82f1\u6587\u9017\u53f7\u5206\u9694',
      title: 'Rise.Rich \u5907\u6ce8',
      titleManager: 'Rise.Rich \u5907\u6ce8\u7ba1\u7406',
      walletAddress: '\u94b1\u5305\u5730\u5740',
      walletNote: '\u94b1\u5305\u5907\u6ce8',
      walletNoteFor: (wallet) => `${wallet} \u7684\u94b1\u5305\u5907\u6ce8`,
    },
  };

  function resolveLanguage(setting, browserLanguage) {
    if (setting === 'en' || setting === 'zh') return setting;
    const language = String(browserLanguage || '').toLowerCase();
    return language.startsWith('zh') ? 'zh' : 'en';
  }

  function createTranslator(setting, browserLanguage) {
    const language = resolveLanguage(setting, browserLanguage);
    const messages = MESSAGES[language] || MESSAGES.en;

    return function translate(key, ...args) {
      const value = messages[key] || MESSAGES.en[key] || key;
      return typeof value === 'function' ? value(...args) : value;
    };
  }

  root.RRI18n = {
    MESSAGES,
    createTranslator,
    resolveLanguage,
    shortWallet,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MESSAGES, createTranslator, resolveLanguage, shortWallet };
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
