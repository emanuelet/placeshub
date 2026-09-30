import {
  listRequestId,
  listUrlForList,
  parseList,
  parseLists,
  parsePlace,
  placeUrl,
} from './parser.js'

const extensionApi = globalThis.browser ?? globalThis.chrome
const ALARM = 'sync-google-lists'
const STARTUP_ALARM = 'startup-google-sync'
const GOOGLE = 'https://www.google.com/'
let listCapture = Promise.resolve()

extensionApi.webRequest.onBeforeRequest.addListener(
  async ({ url }) => {
    const parsed = new URL(url)
    if (parsed.pathname === '/locationhistory/preview/mas') {
      await extensionApi.storage.local.set({ discoveryUrl: url })
    } else if (
      parsed.pathname === '/maps/preview/entitylist/getlist' &&
      parsed.searchParams.get('pb')?.startsWith('!1m6!1s')
    ) {
      listCapture = listCapture
        .then(async () => {
          const id = listRequestId(url)
          const { listTemplates } = await extensionApi.storage.local.get('listTemplates')
          const previous =
            listTemplates && typeof listTemplates === 'object' && !Array.isArray(listTemplates)
              ? listTemplates
              : {}
          const recent = Object.fromEntries(Object.entries(previous).slice(-99))
          await extensionApi.storage.local.set({
            listTemplate: url,
            listTemplates: { ...recent, [id]: url },
          })
        })
        .catch(() => {
          // Unsupported Google requests are not safe templates for other lists.
        })
    } else if (
      parsed.pathname === '/maps/preview/place' &&
      /!1s0x[0-9a-f]+:0x[0-9a-f]+/.test(parsed.searchParams.get('pb') || '')
    ) {
      await extensionApi.storage.local.set({ placeTemplate: url })
    }
  },
  {
    urls: [
      `${GOOGLE}locationhistory/preview/mas*`,
      `${GOOGLE}maps/preview/entitylist/getlist*`,
      `${GOOGLE}maps/preview/place*`,
    ],
  },
)

async function initialize() {
  await extensionApi.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
  if (!(await extensionApi.alarms.get(ALARM)))
    await extensionApi.alarms.create(ALARM, { periodInMinutes: 60 })
}
extensionApi.runtime.onInstalled.addListener(initialize)
extensionApi.runtime.onStartup.addListener(async () => {
  await initialize()
  await extensionApi.alarms.create(STARTUP_ALARM, { delayInMinutes: 0.5 })
})

async function mapsTab() {
  const [existing] = await extensionApi.tabs.query({ url: 'https://www.google.com/maps*' })
  if (existing?.id) return existing.id
  const created = await extensionApi.tabs.create({
    url: 'https://www.google.com/maps/',
    active: false,
  })
  if (!created.id) throw new Error('Unable to open Google Maps')
  await new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timeout)
      extensionApi.tabs.onUpdated.removeListener(listener)
      if (error) reject(error)
      else resolve()
    }
    const listener = (id, info) => {
      if (id === created.id && info.status === 'complete') finish()
    }
    const timeout = setTimeout(() => finish(new Error('Google Maps tab did not load')), 30000)
    extensionApi.tabs.onUpdated.addListener(listener)
    extensionApi.tabs.get(created.id).then((tab) => {
      if (tab.status === 'complete') finish()
    }, finish)
  })
  return created.id
}

async function readGoogle(tabId, urls) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const reply = await extensionApi.tabs.sendMessage(tabId, { type: 'READ_GOOGLE', urls })
      if (reply?.error) throw new Error(reply.error)
      if (reply?.responses?.length !== urls.length) throw new Error('Missing Google response')
      return reply.responses
    } catch (error) {
      if (attempt === 4 || !String(error).includes('Receiving end does not exist')) throw error
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
}

let running = null
async function syncNow() {
  if (running) return running
  running = runSync().finally(() => {
    running = null
  })
  return running
}

async function runSync() {
  await listCapture
  const {
    token,
    appUrl,
    selectedListIds,
    discoveryUrl,
    listTemplate,
    listTemplates,
    placeTemplate,
  } = await extensionApi.storage.local.get([
    'token',
    'appUrl',
    'selectedListIds',
    'discoveryUrl',
    'listTemplate',
    'listTemplates',
    'placeTemplate',
  ])
  if (!token || !appUrl) throw new Error('Connect PlacesHub in extension settings first')
  if (!discoveryUrl || !listTemplate)
    throw new Error('Open Google Maps → Saved and open a list to initialize sync')
  const tabId = await mapsTab()
  const [discovery] = await readGoogle(tabId, [discoveryUrl])
  const lists = parseLists(discovery)
  await extensionApi.storage.local.set({ availableLists: lists })
  const selected = lists.filter(
    (list) => !Array.isArray(selectedListIds) || selectedListIds.includes(list.sourceListId),
  )
  const results = []
  for (const list of selected) {
    let requestKind = 'shared'
    try {
      const captured = listTemplates?.[list.sourceListId]
      if (typeof captured === 'string') {
        try {
          if (listRequestId(captured) === list.sourceListId) requestKind = 'list-specific'
        } catch {
          // A stale capture falls back to the shared request template.
        }
      }
      const [response] = await readGoogle(tabId, [
        listUrlForList(captured, listTemplate, list.sourceListId),
      ])
      const snapshot = parseList(response, list.sourceListId, list.advertisedCount)
      let enriched = 0
      let detailFailures = 0
      if (placeTemplate) {
        for (let offset = 0; offset < snapshot.places.length; offset += 3) {
          const batch = snapshot.places.slice(offset, offset + 3)
          await Promise.all(
            batch.map(async (place) => {
              if (!place.sourcePlaceId.startsWith('maps:cid:')) return
              try {
                const [details] = await readGoogle(tabId, [
                  placeUrl(placeTemplate, place.sourcePlaceId),
                ])
                const enrichedPlace = parsePlace(details, place.sourcePlaceId)
                Object.assign(place, enrichedPlace, {
                  name: enrichedPlace.name || place.name,
                  metadata: { ...place.metadata, ...enrichedPlace.metadata },
                })
                enriched++
              } catch {
                detailFailures++
              }
            }),
          )
        }
      }
      const upload = await fetch(`${appUrl}/api/sync/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(snapshot),
      })
      if (!upload.ok) throw new Error(`PlacesHub returned ${upload.status}: ${await upload.text()}`)
      const summary = await upload.json()
      results.push({
        title: list.title,
        imported: summary.imported,
        removed: summary.removed,
        enriched,
        detailFailures,
        detailsUnavailable: !placeTemplate,
      })
    } catch (error) {
      results.push({ title: list.title, error: `${String(error)} [${requestKind} request]` })
    }
  }
  const status = { at: new Date().toISOString(), results }
  await extensionApi.storage.local.set({ lastSync: status })
  return status
}

extensionApi.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM || alarm.name === STARTUP_ALARM)
    syncNow().catch(async (error) => {
      await extensionApi.storage.local.set({
        lastSync: { at: new Date().toISOString(), error: String(error) },
      })
    })
})

extensionApi.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message?.type !== 'SYNC_NOW') return
  if (globalThis.browser) {
    return syncNow().then(
      (status) => ({ status }),
      (error) => ({ error: String(error) }),
    )
  }
  syncNow().then(
    (status) => respond({ status }),
    (error) => respond({ error: String(error) }),
  )
  return true
})
