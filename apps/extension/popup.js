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
      await chrome.storage.local.set({ selectedListIds: checked })
    })
    label.append(box, document.createTextNode(list.title))
    container.append(label)
  }
}

async function refresh() {
  const { appUrl, token, availableLists, selectedListIds, lastSync } =
    await chrome.storage.local.get([
      'appUrl',
      'token',
      'availableLists',
      'selectedListIds',
      'lastSync',
    ])
  $('appUrl').value = appUrl || ''
  $('token').value = token || ''
  renderLists(availableLists, selectedListIds)
  $('lastSync').textContent = lastSync
    ? `${lastSync.at}: ${
        lastSync.error ||
        lastSync.results
          ?.map(
            (r) =>
              `${r.title}: ${r.error || `${r.imported} places, ${r.enriched ?? 0} enriched, ${r.removed} removed${r.detailsUnavailable ? '; open a place in Maps to enable details' : ''}${r.detailFailures ? `, ${r.detailFailures} details unavailable` : ''}`}`,
          )
          .join('\n')
      }`
    : 'No sync yet'
}

$('connect').addEventListener('click', async () => {
  try {
    const url = new URL($('appUrl').value)
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      (url.protocol === 'http:' && url.hostname !== 'localhost') ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error('Enter the PlacesHub origin only (https://host)')
    const token = $('token').value.trim()
    if (!/^phs_[a-f0-9-]{72}$/.test(token))
      throw new Error('Paste the extension key from PlacesHub')
    const granted = await chrome.permissions.request({ origins: [`${url.origin}/*`] })
    if (!granted) throw new Error('PlacesHub site access is needed to upload lists')
    await chrome.storage.local.set({ appUrl: url.origin, token })
    $('status').textContent =
      'Connected. Open Google Maps → Saved, a list and a place, then Sync now.'
  } catch (error) {
    $('status').textContent = String(error)
  }
})

$('disconnect').addEventListener('click', async () => {
  const { appUrl } = await chrome.storage.local.get('appUrl')
  await chrome.storage.local.remove(['token', 'appUrl'])
  if (appUrl) await chrome.permissions.remove({ origins: [`${appUrl}/*`] })
  $('token').value = ''
  $('status').textContent = 'Disconnected locally. Revoke the key on PlacesHub too.'
})

$('sync').addEventListener('click', async () => {
  $('status').textContent = 'Checking Google Maps…'
  try {
    const result = await chrome.runtime.sendMessage({ type: 'SYNC_NOW' })
    $('status').textContent = result.error || 'Sync finished; see results below.'
    await refresh()
  } catch (error) {
    $('status').textContent = String(error)
  }
})

refresh()
