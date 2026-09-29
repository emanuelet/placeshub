# Chrome and Firefox extension releases

One source tree in `apps/extension` produces two Manifest V3 packages. Chrome
uses a service worker; Firefox uses a module background event page. Neither ZIP
contains tests, development tooling, local credentials, or Google Maps data.

## Build and validate

From the repository root, using the pinned Node 24 / pnpm 12.6 toolchain:

```sh
pnpm install --frozen-lockfile
pnpm --filter @placeshub/extension test
pnpm --filter @placeshub/extension check
pnpm --filter @placeshub/extension build
pnpm --filter @placeshub/extension lint:firefox
```

Upload the ZIP files in `apps/extension/artifacts/chrome/` and
`apps/extension/artifacts/firefox/` to their respective stores. The ZIPs put
`manifest.json` at the root. Build inputs are explicitly allowlisted in
`apps/extension/scripts/package.mjs`; `dist/` and `artifacts/` are ignored by
Git. For Firefox local testing, load `apps/extension/dist/firefox/manifest.json`
from `about:debugging#/runtime/this-firefox` (temporary installation). For
Chrome, load `apps/extension/dist/chrome/` unpacked in `chrome://extensions`.

The shared version is `apps/extension/manifest.json` → `version` (currently
`0.1.0`). Increase it before each store update; do not change the Firefox ID
`placeshub-sync@emanuelet.github.io` after the first AMO submission. Firefox
requires version 142 or later for the declared data-collection permissions.

## Store submission

- **Chrome Web Store:** Upload the Chrome ZIP to the developer dashboard, then
  supply a description, screenshots of the actual popup/options UI, support
  contact, and privacy fields. The single purpose is to sync selected Google
  Maps saved lists to the user's configured PlacesHub account. Describe the
  permissions: `alarms` for hourly sync; `storage` for the chosen site/key,
  selected lists and sync state; `tabs` to find/open Google Maps; `webRequest`
  and the Google host permission to capture list/place request templates;
  optional HTTPS site permission only for the PlacesHub origin chosen in
  settings. `http://localhost/*` supports local development only.
- **Firefox Add-ons (AMO):** Upload the Firefox ZIP and its source repository
  link. The Firefox manifest declares the required auth-key, saved-list,
  location, and Google Maps content data sent to the configured PlacesHub
  server. Validate the exact ZIP with `web-ext lint` before submitting. AMO
  signs accepted extensions; do not distribute the unsigned ZIP as a normal
  installable XPI.
- **Privacy URL:** Publish the web app's public `/privacy` page first and use
  `https://<your-pages-domain>/privacy` in both store listings. Review its
  wording against the final hosted data-handling policy and provide a real
  support contact in the listings. The extension key stays local until used to
  authenticate a sync; disconnect clears its local storage, while revoking a
  key in PlacesHub blocks future uploads.

Before submission, use the production PlacesHub URL in extension settings and
test install → connect → capture list and place details → sync → revoke on
both browsers using a signed-in Google Maps account. Google Maps' list APIs
are undocumented; the previously reported **Favorite places** response-format
error must be resolved with a real captured response before claiming that list
is supported in either store. Neither package is submitted or signed by the
build commands above.

Installing a store release alongside the old unpacked Chrome extension creates
a separate extension identity and local storage. Reconnect the released version
in its settings; disable the unpacked copy to avoid duplicate hourly syncs.

Official references: [Chrome release preparation](https://developer.chrome.com/docs/webstore/prepare),
[Firefox signing](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/),
and [Firefox background compatibility](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background).
