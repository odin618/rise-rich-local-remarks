# Rise.Rich Local Remarks

Rise.Rich Local Remarks is a Manifest V3 Chrome extension that adds local wallet notes, tags, and quick actions to rise.rich pages.

## Features

- Add and edit local notes for wallet addresses on rise.rich.
- Assign tags and reuse existing tags from the note dialog.
- Show saved notes and tags directly in supported rise.rich views.
- Import and export notes as JSON.
- Verify RBOT token-gate eligibility through Solana RPC.
- Configure a custom HTTPS Solana RPC endpoint.

## Privacy

Notes and tags are stored locally in Chrome with `chrome.storage.local`. They are not uploaded to developer-controlled servers.

The extension reads wallet addresses displayed on rise.rich pages so it can show local notes and quick actions. For RBOT token-gate verification, the detected wallet address and RBOT mint are sent to the configured Solana RPC endpoint.

See [PRIVACY.md](./PRIVACY.md) for the full policy.

## Development

Run the test suite:

```powershell
npm.cmd test
```

Create a Chrome Web Store package:

```powershell
npm.cmd run package:webstore
```

The packaged ZIP is written to `dist/`.

## Chrome Installation For Testing

1. Open `chrome://extensions/`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this project folder.

## License

MIT
