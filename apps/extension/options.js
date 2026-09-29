import { validateConnection } from './settings.js'

const $ = (id) => document.getElementById(id)

async function refresh() {
  const { appUrl, token } = await chrome.storage.local.get(['appUrl', 'token'])
  $('appUrl').value = appUrl || ''
  $('disconnect').disabled = !appUrl && !token
  $('status').textContent = appUrl && token ? `Connected to ${appUrl}` : 'Not connected'
}

$('connection').addEventListener('submit', async (event) => {
  event.preventDefault()
  $('connect').disabled = true
  try {
    const previous = await chrome.storage.local.get(['appUrl', 'token'])
    const address = $('appUrl').value
    const sameOrigin = [previous.appUrl, `${previous.appUrl}/`].includes(address.trim())
    const key = $('token').value || (sameOrigin ? previous.token : '')
    const { appUrl, token } = validateConnection(address, key || '')
    const granted = await chrome.permissions.request({ origins: [`${appUrl}/*`] })
    if (!granted) throw new Error('PlacesHub site access is needed to upload lists')
    await chrome.storage.local.set({ appUrl, token })
    if (previous.appUrl && previous.appUrl !== appUrl)
      await chrome.permissions.remove({ origins: [`${previous.appUrl}/*`] })
    $('appUrl').value = appUrl
    $('token').value = ''
    $('disconnect').disabled = false
    $('status').textContent =
      `Connected to ${appUrl}. Open Google Maps → Saved, a list and a place, then Sync now.`
  } catch (error) {
    $('status').textContent = String(error)
  } finally {
    $('connect').disabled = false
  }
})

$('disconnect').addEventListener('click', async () => {
  $('disconnect').disabled = true
  try {
    const { appUrl } = await chrome.storage.local.get('appUrl')
    await chrome.storage.local.remove(['token', 'appUrl'])
    if (appUrl) await chrome.permissions.remove({ origins: [`${appUrl}/*`] })
    $('token').value = ''
    $('status').textContent = 'Disconnected locally. Revoke the key on PlacesHub too.'
  } catch (error) {
    $('status').textContent = String(error)
  } finally {
    const { appUrl, token } = await chrome.storage.local.get(['appUrl', 'token'])
    $('disconnect').disabled = !appUrl && !token
  }
})

refresh().catch((error) => {
  $('status').textContent = String(error)
})
