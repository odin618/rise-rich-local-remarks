const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readProjectFile(...parts) {
  return fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');
}

test('popup credits RBOT token and both co-developers as clickable links', () => {
  const html = readProjectFile('src', 'popup', 'popup.html');

  assert.match(html, /<a[^>]+>RBOT<\/a>\s*&middot;\s*(?:\u8054\u5408\u5f00\u53d1|&#32852;&#21512;&#24320;&#21457;)\s*<a[^>]+>(?:\u521d\u58a8\u4e0d\u59d3\u718a|&#21021;&#22696;&#19981;&#22995;&#29066;)<\/a>\s*&amp;\s*<a[^>]+>(?:\u9ea6\u5b50|&#40614;&#23376;)<\/a>/);
  assert.match(html, /id="rbotLink"[^>]+href="https:\/\/rise\.rich\/trade\/89ib7vR1bTdKEACWkjuBcMbuGaWpmQcBFB7N3Ddvrise"/);
  assert.match(html, /id="chumoLink"[^>]+href="https:\/\/x\.com\/chumo_btc"/);
  assert.match(html, /id="maiziLink"[^>]+href="https:\/\/x\.com\/rex00618"/);
});

test('popup renders insufficient RBOT balance with a clickable RBOT link', () => {
  const js = readProjectFile('src', 'popup', 'popup.js');

  assert.match(js, /RBOT_TRADE_URL\s*=\s*'https:\/\/rise\.rich\/trade\/89ib7vR1bTdKEACWkjuBcMbuGaWpmQcBFB7N3Ddvrise'/);
  assert.match(js, /RBOT \u4ee3\u5e01\u4f59\u989d\u4e0d\u8db3/);
  assert.match(js, /makeRbotLink\(\)/);
  assert.match(js, /openExternalUrl\(RBOT_TRADE_URL\)/);
});

test('popup header uses the extension icon instead of a text mark', () => {
  const html = readProjectFile('src', 'popup', 'popup.html');
  const css = readProjectFile('src', 'popup', 'popup.css');

  assert.match(html, /<img[^>]+class="mark"[^>]+src="\.\.\/assets\/icons\/icon-128\.png"[^>]+alt=""/);
  assert.doesNotMatch(html, /<div class="mark">R<\/div>/);
  assert.match(css, /\.mark\s*{[^}]*width:\s*34px;[^}]*height:\s*auto;/s);
  assert.doesNotMatch(css, /\.mark\s*{[^}]*object-fit:\s*cover;/s);
});

test('options page does not render acknowledgement credits', () => {
  const html = readProjectFile('src', 'options', 'options.html');

  assert.doesNotMatch(html, /acknowledgement/i);
  assert.doesNotMatch(html, /Chumo_btc|\u521d\u58a8\u4e0d\u59d3\u718a/);
});

test('options page exposes custom RPC endpoint settings', () => {
  const html = readProjectFile('src', 'options', 'options.html');
  const remarksIndex = html.indexOf('id="remarks"');
  const rpcSettingsIndex = html.indexOf('id="customRpcEndpoint"');

  assert.match(html, /id="customRpcEndpointLabel"/);
  assert.match(html, /id="customRpcEndpoint"/);
  assert.match(html, /id="saveRpcEndpoint"/);
  assert.match(html, /placeholder="Leave empty to use default RPC"/);
  assert.ok(rpcSettingsIndex > remarksIndex, 'custom RPC settings should appear below the wallet remarks list');
});

test('options page exposes a dedicated JSON import and export area', () => {
  const html = readProjectFile('src', 'options', 'options.html');
  const remarksIndex = html.indexOf('id="remarks"');
  const dataToolsIndex = html.indexOf('class="data-tools"');
  const settingsIndex = html.indexOf('class="settings"');

  assert.match(html, /id="dataToolsTitle"/);
  assert.match(html, /id="dataToolsStatus"/);
  assert.match(html, /id="exportJson"/);
  assert.match(html, /id="importJson"[^>]+type="file"[^>]+accept="application\/json"/);
  assert.ok(dataToolsIndex > remarksIndex, 'data tools should appear below the remarks list');
  assert.ok(dataToolsIndex < settingsIndex, 'data tools should appear above technical settings');
});

test('content script uses custom remark dialogs instead of browser prompts', () => {
  const js = readProjectFile('src', 'content', 'content.js');
  const css = readProjectFile('src', 'content', 'content.css');

  assert.doesNotMatch(js, /window\.(prompt|alert)\(/);
  assert.match(js, /openRemarkDialog/);
  assert.match(js, /openMessageDialog/);
  assert.match(css, /\.rr-remarks-modal-backdrop/);
  assert.match(css, /\.rr-remarks-dialog/);
});

test('clipboard bridge only captures after a user-triggered wallet-copy arm message', () => {
  const bridgeJs = readProjectFile('src', 'content', 'clipboard-bridge.js');
  const contentJs = readProjectFile('src', 'content', 'content.js');

  assert.match(bridgeJs, /rr-remarks-clipboard-arm/);
  assert.match(bridgeJs, /captureUntil/);
  assert.match(bridgeJs, /captureUntil\s*=\s*0/);
  assert.match(bridgeJs, /Promise\.resolve\(result\)/);
  assert.match(contentJs, /armClipboardBridge\(15000\)/);
  assert.match(contentJs, /armClipboardBridge\(0\)/);
});

test('content script shuts down quietly when Chrome invalidates the extension context', () => {
  const js = readProjectFile('src', 'content', 'content.js');

  assert.match(js, /handleExtensionContextError/);
  assert.match(js, /Extension context invalidated/);
  assert.match(js, /safeStorageGet/);
  assert.match(js, /safeStorageSet/);
  assert.match(js, /safeStorageRemove/);
  assert.match(js, /observer\?\.disconnect\(\)/);
  assert.match(js, /processPage\(\)\.catch/);
});

test('trade record injection skips own-trader labels and guards the whole row against duplicates', () => {
  const js = readProjectFile('src', 'content', 'content.js');

  assert.match(js, /row\.querySelector\('\[data-rr-remarks-ui="trade-note"\]'\)/);
  assert.match(js, /isLikelyTraderAddressLabel\(addressLabel\)/);
  assert.match(js, /text === '\\u6211'/);
  assert.match(js, /\(\?:\\\.\{3\}\|\\u2026\)/);
});

test('remark surfaces preload existing tags and display note-tag labels with the Chinese separator', () => {
  const contentJs = readProjectFile('src', 'content', 'content.js');
  const optionsJs = readProjectFile('src', 'options', 'options.js');

  assert.match(contentJs, /existingAnnotation = storage\.get\(wallet\)/);
  assert.match(contentJs, /initialTags: formatTagsInput\(existingAnnotation\)/);
  assert.match(contentJs, /const currentAnnotation = storage\.get\(entityId\) \|\| annotation/);
  assert.match(contentJs, /initialTags: formatTagsInput\(currentAnnotation\)/);
  assert.match(contentJs, /parts\.join\('\\u4e28'\)/);
  assert.match(optionsJs, /formatAnnotationLabel\(item, item\.entityId\)/);
  assert.match(optionsJs, /parts\.join\('\\u4e28'\)/);
});

test('remark dialog offers existing tags as selectable options', () => {
  const contentJs = readProjectFile('src', 'content', 'content.js');
  const css = readProjectFile('src', 'content', 'content.css');

  assert.match(contentJs, /collectExistingTags/);
  assert.match(contentJs, /makeTagPickerField/);
  assert.match(contentJs, /rr-remarks-tag-select/);
  assert.match(contentJs, /selectExistingTag/);
  assert.match(contentJs, /addTagInputValue/);
  assert.match(contentJs, /toggleTagInputValue/);
  assert.match(contentJs, /rr-remarks-existing-tags/);
  assert.match(contentJs, /rr-remarks-tag-option/);
  assert.match(css, /\.rr-remarks-tag-select/);
  assert.match(css, /\.rr-remarks-tag-picker/);
  assert.match(css, /\.rr-remarks-tag-option\.selected/);
});
