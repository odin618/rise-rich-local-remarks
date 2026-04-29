# Privacy Policy for Rise.Rich Local Remarks

Last updated: April 29, 2026

Rise.Rich Local Remarks is a Chrome extension that helps users add local wallet notes, tags, and quick actions on rise.rich pages.

## Data Stored Locally

The extension stores the following data locally in the user's Chrome browser using `chrome.storage.local`:

- Wallet notes
- Tags
- Language settings
- Custom RPC settings
- Token-gate verification status

User-created notes and tags are not uploaded to developer-controlled servers.

## Data Read From Web Pages

The extension reads wallet addresses displayed on rise.rich pages to provide wallet note controls, tags, and quick actions.

If the user clicks an add-note control for a trade row, the extension temporarily listens for the next wallet-address copy action from rise.rich and uses it only to open the local note editor.

## Solana RPC Requests

To verify RBOT token-gate eligibility, the extension sends the detected wallet address and RBOT mint address to a Solana RPC endpoint.

The default RPC endpoints are:

- `https://api.mainnet-beta.solana.com`
- `https://public.rpc.solanavibestation.com`

If the user configures a custom HTTPS RPC endpoint, the wallet address and RBOT mint may be sent to that user-selected RPC endpoint.

User-created notes and tags are not sent to Solana RPC endpoints.

## Data Sharing

The extension does not sell user data.

The extension does not use user data for advertising.

The extension does not use user data for creditworthiness, lending, or financial profiling.

The extension does not allow humans to read user-created notes or tags.

## Data Deletion

Users can delete stored notes and settings by removing the extension or clearing the extension's local storage in Chrome.

## Contact

For support or privacy questions, please open an issue in the public source repository.
