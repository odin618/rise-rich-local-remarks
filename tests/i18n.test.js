const test = require('node:test');
const assert = require('node:assert/strict');

const { createTranslator, resolveLanguage } = require('../src/core/i18n.js');

test('resolves auto language from browser locale', () => {
  assert.equal(resolveLanguage('auto', 'zh-CN'), 'zh');
  assert.equal(resolveLanguage(undefined, 'en-US'), 'en');
  assert.equal(resolveLanguage('zh', 'en-US'), 'zh');
  assert.equal(resolveLanguage('en', 'zh-CN'), 'en');
});

test('translates shared extension copy in Chinese and English', () => {
  const zh = createTranslator('zh', 'en-US');
  const en = createTranslator('en', 'zh-CN');

  assert.equal(zh('walletAddress'), '\u94b1\u5305\u5730\u5740');
  assert.equal(zh('addWalletNoteShort'), '\u6dfb\u52a0\u5907\u6ce8');
  assert.equal(zh('customRpcEndpoint'), '\u81ea\u5b9a\u4e49 RPC');
  assert.equal(zh('customRpcEndpointPlaceholder'), '\u7559\u7a7a\u5219\u4f7f\u7528\u9ed8\u8ba4 RPC');
  assert.equal(zh('customRpcInvalid'), '\u8bf7\u8f93\u5165\u6709\u6548\u7684 HTTPS RPC \u5730\u5740\u3002');
  assert.equal(zh('customRpcPermissionDenied'), '\u9700\u8981\u5148\u6388\u6743 Chrome \u8bbf\u95ee\u8be5\u81ea\u5b9a\u4e49 RPC\u3002');
  assert.equal(zh('dataToolsTitle'), '\u6570\u636e');
  assert.equal(zh('exportJsonDone', 2), '\u5df2\u5bfc\u51fa 2 \u6761\u5907\u6ce8\u3002');
  assert.equal(zh('importJsonDone', 1), '\u5df2\u5bfc\u5165 1 \u6761\u65b0\u5907\u6ce8\u3002');
  assert.equal(zh('importJsonFailed'), '\u5bfc\u5165\u5931\u8d25\uff0c\u8bf7\u9009\u62e9\u6709\u6548\u7684 JSON \u6587\u4ef6\u3002');
  assert.equal(zh('saveRpcEndpoint'), '\u4fdd\u5b58 RPC');
  assert.equal(zh('selectExistingTag'), '\u9009\u62e9\u5df2\u6709\u6807\u7b7e');
  assert.equal(zh('clickTraderCopyFirst'), '\u8bf7\u5148\u70b9\u51fb\u5de6\u4fa7\u4ea4\u6613\u8005\u5730\u5740\u590d\u5236\u4e00\u6b21');
  assert.equal(zh('existingTags'), '\u5df2\u6709\u6807\u7b7e');
  assert.equal(zh('acknowledgementName'), '\u521d\u58a8\u4e0d\u59d3\u718a');
  assert.equal(zh('acknowledgementSuffix'), '\u63d0\u4f9b\u6280\u672f\u652f\u6301');
  assert.equal(zh('cancel'), '\u53d6\u6d88');
  assert.equal(zh('noteRequired'), '\u8bf7\u5148\u8f93\u5165\u94b1\u5305\u5907\u6ce8\u3002');
  assert.equal(zh('noticeTitle'), '\u63d0\u793a');
  assert.equal(zh('ok'), '\u786e\u5b9a');
  assert.equal(zh('autoLanguage'), '\u81ea\u52a8');
  assert.equal(zh('remarksSaved', 2), '\u5df2\u4fdd\u5b58 2 \u6761\u5907\u6ce8');
  assert.equal(
    zh('gateNoWallet'),
    '\u8bf7\u5148\u767b\u5f55 rise.rich\uff0c\u5f53\u524d\u672a\u8bfb\u53d6\u5230\u94b1\u5305\u5730\u5740\u3002',
  );
  assert.equal(
    zh('gateInsufficient', '11111111111111111111111111111111', '999', 1000),
    '\u9700\u8981\u6301\u6709\u81f3\u5c11 1000 \u4e2a RBOT \u4ee3\u5e01\u624d\u53ef\u5f00\u542f\u9875\u9762\u5907\u6ce8\uff0c1111...1111 \u5f53\u524d\u6301\u6709 999 \u4e2a\u3002',
  );
  assert.equal(
    zh('gateAuthorized', '11111111111111111111111111111111', '1001', 1000),
    '\u9875\u9762\u5907\u6ce8\u5df2\u542f\u7528\uff1a\u95e8\u69db 1000 \u4e2a\uff0c1111...1111 \u5f53\u524d\u6301\u6709 1001 \u4e2a\u3002',
  );
  assert.equal(
    zh('gateError', 'https://api.mainnet-beta.solana.com: RPC HTTP 403'),
    '\u9a8c\u8bc1\u5931\u8d25\uff1ahttps://api.mainnet-beta.solana.com: RPC HTTP 403\u3002\u8bf7\u91cd\u8bd5\u6216\u66f4\u6362 RPC\u3002',
  );
  assert.equal(en('walletAddress'), 'Wallet address');
  assert.equal(en('customRpcEndpoint'), 'Custom RPC');
  assert.equal(en('customRpcEndpointPlaceholder'), 'Leave empty to use default RPC');
  assert.equal(en('customRpcInvalid'), 'Enter a valid HTTPS RPC URL.');
  assert.equal(en('customRpcPermissionDenied'), 'Chrome permission is required before this custom RPC can be used.');
  assert.equal(en('dataToolsTitle'), 'Data');
  assert.equal(en('exportJsonDone', 2), 'Exported 2 remarks.');
  assert.equal(en('importJsonDone', 1), 'Imported 1 new remark.');
  assert.equal(en('importJsonFailed'), 'Import failed. Choose a valid JSON file.');
  assert.equal(en('saveRpcEndpoint'), 'Save RPC');
  assert.equal(en('selectExistingTag'), 'Select existing tag');
  assert.equal(en('acknowledgementName'), 'Chumo_btc');
  assert.equal(en('existingTags'), 'Existing tags');
  assert.equal(en('cancel'), 'Cancel');
  assert.equal(en('noteRequired'), 'Enter a wallet note before saving.');
  assert.equal(en('noticeTitle'), 'Notice');
  assert.equal(en('ok'), 'OK');
  assert.equal(en('autoLanguage'), 'Auto');
  assert.equal(en('remarksSaved', 1), '1 remark saved');
  assert.equal(
    en('gateAuthorized', '11111111111111111111111111111111', '1001', 1000),
    'Page annotations enabled: threshold 1000, 1111...1111 currently holds 1001.',
  );
  assert.equal(
    en('gateInsufficient', '11111111111111111111111111111111', '999', 1000),
    'Page annotations require at least 1000 RBOT tokens. 1111...1111 currently holds 999.',
  );
});
