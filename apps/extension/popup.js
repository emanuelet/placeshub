const extensionApi = globalThis.browser ?? globalThis.chrome
const $ = (id) => document.getElementById(id)

function renderLists(lists, selectedListIds) {
  const container = $('lists')
  container.replaceChildren()
  if (!lists?.length) return
  const heading = document.createElement('h2')
  heading.textContent = 'Lists to synchronize'
  container.append(heading)
  for (const list of lists) {
    const label = document.createElement('label')
    label.className = 'list'
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.value = list.sourceListId
    box.checked = !Array.isArray(selectedListIds) || selectedListIds.includes(list.sourceListId)
    box.addEventListener('change', async () => {
      const checked = [...container.querySelectorAll('input:checked')].map((input) => input.value)
      await extensionApi.storage.local.set({ selectedListIds: checked })
    })
    label.append(box, document.createTextNode(list.title))
    container.append(label)
  }
}

async function refresh() {
  const { appUrl, token, availableLists, selectedListIds, lastSync } =
    await extensionApi.storage.local.get([
      'appUrl',
      'token',
      'availableLists',
      'selectedListIds',
      'lastSync',
    ])
  $('connection').textContent =
    appUrl && token ? `Connected to ${appUrl}` : 'Not connected. Open settings to connect.'
  renderLists(availableLists, selectedListIds)
  $('lastSync').textContent = lastSync
    ? `${lastSync.at}: ${
        lastSync.error ||
        lastSync.results
          ?.map(
            (r) =>
              `${r.title}: ${r.error || `${r.imported} places, ${r.enriched ?? 0} enriched, ${r.removed} removed${r.detailsUnavailable ? '; open a place’s full detail card in Google Maps to enable enrichment' : ''}${r.detailFailures ? `, ${r.detailFailures} details unavailable` : ''}`}`,
          )
          .join('\n')
      }`
    : 'No sync yet'
}

$('settings').addEventListener('click', async () => {
  try {
    await extensionApi.runtime.openOptionsPage()
  } catch (error) {
    $('status').textContent = String(error)
  }
})

$('sync').addEventListener('click', async () => {
  $('status').textContent = 'Checking Google Maps…'
  try {
    const result = await extensionApi.runtime.sendMessage({ type: 'SYNC_NOW' })
    $('status').textContent = result.error || 'Sync finished; see results below.'
    await refresh()
  } catch (error) {
    $('status').textContent = String(error)
  }
})

extensionApi.storage.onChanged.addListener((changes, area) => {
  if (
    area === 'local' &&
    Object.keys(changes).some((key) =>
      ['appUrl', 'token', 'availableLists', 'selectedListIds', 'lastSync'].includes(key),
    )
  ) {
    refresh().catch((error) => {
      $('status').textContent = String(error)
    })
  }
})

refresh().catch((error) => {
  $('status').textContent = String(error)
})
