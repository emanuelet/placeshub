# Places experience implementation plan

Historical plan from 2026-09-29. For current setup and behavior, see the
[README](../../README.md); this plan records the original design decisions.

## Scope and decisions

- App Settings has Google Sync and Appearance tabs. Preserve old `/sync` links. Appearance stores the left/right position of the place-list and details sidebar locally, like the current theme preference.
- On desktop the map occupies 60% of the content width; the list and selected-place details are separate columns within the other 40%. Put both on the chosen side. Stack the layout for tablet and phone. Collection entries fill their list column.
- Collection creation uses an accessible dialog. Manual collections allow renaming and confirmed deletion; deleting one invalidates its share links. Google-synced collections cannot be edited, deleted, or have their membership manually changed, including via direct API calls.
- Selecting a saved place or map marker opens a separate details column and highlights the marker. Show available details, an external Google Maps link immediately below the header image, and editable optional **personal** notes. Use icons for recognizable actions and details. Personal notes belong to the user's saved place, separate from imported collection/Google notes. Public shares use only their immutable snapshot data. Increase the marker popup close button's icon and touch target.
- Dashboard Add opens a popup dialog that searches Google Places for new places through the authenticated API, with `GOOGLE_PLACES_API_KEY` kept server-side. Autocomplete suggestions appear directly below the search input; choose a suggestion, then optionally pick a manual collection and enter notes before saving. Collection Add opens the same dialog with that collection preselected. Saved place and optional collection membership should be applied together.
- In manual collections, single and bulk removal delete **membership only**, not the user's saved place or global place cache. Confirm bulk removal. The API validates owner, manual status and the selected IDs.
- The Chrome extension has a browser Options/settings page for its PlacesHub address and extension key; its popup continues to show sync controls and status. Keep the key in trusted-context `chrome.storage.local` and request the site permission when connecting.

## Implementation tracks

1. API (`apps/api/src/routes`, API bindings): Google Places Text Search mapped to existing place fields; collection list sync flags and details personal notes; atomic save-with-optional-collection; owner/manual checks on mutation routes; bulk membership removal. Contracts: `GET /api/places/search?q=` returns `{ places }`, `POST /api/places` accepts optional `collectionId`, `GET /api/collections` returns `syncedFromGoogle`, `GET /api/collections/:id` returns each entry's `savedPlaceId` and `personalNotes`, and `POST /api/collections/:id/places/bulk-remove` accepts `{ placeIds: string[] }` and returns `{ removedCount }`.
2. Extension (`apps/extension`): Options page for address/key, link from popup, preserve sync and disconnect behavior.
3. Web (`apps/web/app`): app Settings/navigation; responsive layout and selection; collection creation/edit/delete and membership controls; shared add-place experience and notes editor; popup sizing.

## Verification

- Web and extension tests: creation dialog, manual-only mutations, selection/details/highlight, search results and errors, optional collection membership, personal notes, Options save/connect, and bulk remove.
- Typecheck, lint/check, production build; inspect phone, tablet and desktop layouts and touch targets.
