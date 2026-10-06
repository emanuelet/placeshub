# PlacesHub Sync store listing kit

Draft for the Chrome Web Store and Firefox Add-ons (AMO). Use the browser-specific
ZIPs built from `apps/extension`; these images and words are listing materials,
not installable packages. Nothing here has been submitted.

## Listing copy

**Name:** PlacesHub Google Maps Sync

**Short summary:** Sync your Google Maps saved lists to your PlacesHub account.

**Description (both stores):**

> Bring the places you save in Google Maps into PlacesHub. Connect the extension
> with a key created in PlacesHub, open Google Maps Saved and a place in each list
> you want to sync, then choose Sync now. Select which discovered lists to keep
> in sync. The extension checks them hourly while your browser is running and
> shortly after startup.
>
> In PlacesHub you can search saved places on a map, keep notes, organise
> collections and share a snapshot or export KML. Sync goes from Google Maps to
> PlacesHub only; it does not change your Google Maps lists. Some Google lists
> may not be available because their list APIs are undocumented. Check the
> extension popup for per-list results and errors.
>
> Your Google sign-in cookies and password are not uploaded to PlacesHub. The
> extension sends selected list and place data to the PlacesHub address you
> configure, using a revocable extension key. You can use placeshub.org or a
> self-hosted HTTPS PlacesHub instance. See the [privacy policy](https://placeshub.org/privacy).

**Website:** https://placeshub.org
**Privacy policy:** https://placeshub.org/privacy
**Source and support website:** https://github.com/emanuelet/placeshub/issues
**Support email:** support@placeshub.org (verify delivery before submission)

## Store images

| File | Use | Status |
| --- | --- | --- |
| `chrome-promo.png` | Chrome small promotional tile, 440 × 280 | Ready; editable source: `chrome-promo.svg` |
| `chrome-settings.png` | Chrome screenshot, 640 × 400 | Captured from the packaged extension in a fresh Chromium profile; disconnected state |
| `chrome-popup.png` | Chrome screenshot, 640 × 400 | Captured from the packaged extension in a fresh Chromium profile; disconnected state |

The two screenshots show real extension pages with no account or key. AMO can
use the same captures. Before a public listing, add a screenshot from an actual
successful sync showing list selection and results using a dedicated test
account. Do not use the **example-data** popup image in
`apps/web/public/screenshots/extension-popup.png` as a store screenshot.
Avoid showing extension keys, personal places, or Google account information in
submitted screenshots. Chrome requires at least one full-bleed 640 × 400 or
1280 × 800 screenshot and the 440 × 280 tile.

## Chrome Web Store privacy answers

**Single purpose:** Synchronise selected Google Maps saved lists to the user's
configured PlacesHub account.

| Permission | Reviewer justification |
| --- | --- |
| `alarms` | Schedule hourly sync and a check shortly after browser startup. |
| `storage` | Keep the chosen PlacesHub address, extension key, selected lists, captured Google request templates and last sync result locally. |
| `tabs` | Find an existing Google Maps tab or open one in the background to read selected lists. |
| `webRequest` and `https://www.google.com/*` | Observe Google Maps list/place request URLs so the extension can read saved lists from the user's signed-in Maps session. The extension does not upload Google cookies to PlacesHub. |
| Optional `https://*/*` | Support self-hosted HTTPS PlacesHub origins. Request permission only for the exact origin the user enters when connecting; do not run on unrelated sites. |
| Optional `http://localhost/*` | Connect to a local development server. Not used for remote HTTP sites. |

**Remote code:** None executed by the extension; all JavaScript is in the ZIP.
Network requests read Google Maps data and upload snapshots to the chosen
PlacesHub origin. Disclose the extension key and selected list/place names,
identifiers, notes, addresses, coordinates and available details in the
dashboard's matching data-use categories. Review and certify the exact privacy
checkboxes against the final package and public policy before submission.

## Firefox AMO disclosures

Select **On this site** (listed add-on), **desktop Firefox**, and include the
privacy URL, support contact, summary and description above. The Firefox
manifest uses the stable ID `placeshub-sync@emanuelet.github.io`, minimum
Firefox 142, and declares `authenticationInfo`, `bookmarksInfo`, `locationInfo`
and `websiteContent` as required data types. Check these declarations against
the release build and test its consent experience on a fresh profile. Keep the
Firefox ID unchanged for later updates.

The ZIP is unminified JavaScript, HTML and CSS. Link reviewers to the matching
public source revision. If AMO requests a source archive, supply one with the
build instructions from [`../extension-publishing.md`](../extension-publishing.md);
do not upload development credentials or ignored local files. AMO signs the
accepted extension; the unsigned ZIP is not the final Firefox download.

## Reviewer test instructions (enter privately in each dashboard)

1. Provide dedicated **PlacesHub and Google Maps test accounts** with a few
   non-personal saved lists and place details. Do not put credentials in the
   repository or listing text.
2. Sign in to PlacesHub, open **Settings → Google Sync**, create an extension
   key, and copy the site address and key to the extension's Settings page.
3. Sign in to the test Google Maps account in the same browser. Open **Saved**,
   a list, and one place's full details card to capture the list/place requests.
4. In the extension popup, choose **Sync now**, inspect discovered lists and
   results, then select the lists to sync. Open PlacesHub to confirm they appear.
5. Show that **Disconnect** removes the local connection and revoking the key
   in PlacesHub prevents further uploads. Verify scheduled sync after startup
   in a clean browser profile.

## Before submitting

- Confirm the test accounts and support email work, and verify a real list sync
  on the exact Chrome and Firefox packages. Do not claim that **Favorite places**
  works until it has been checked with a real captured response.
- Recheck the live privacy page against the packaged code, including Firefox's
  different extension-storage access behavior.
- Record the release commit, then build and lint the exact ZIPs. Increment the
  shared manifest version for every subsequent store upload.
- Finish publisher registration and contact verification, upload each browser's
  ZIP, complete the remaining dashboard fields, and submit for review. Add the
  approved store links to the marketing page after publication.

Official requirements: [Chrome images](https://developer.chrome.com/docs/webstore/images),
[Chrome privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy),
[Chrome publishing](https://developer.chrome.com/docs/webstore/publish), and
[AMO submission](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/).
