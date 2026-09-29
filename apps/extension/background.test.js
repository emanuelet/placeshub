import assert from 'node:assert/strict'
import test from 'node:test'

for (const namespace of ['chrome', 'browser']) {
  test(`uses a captured request for each list with ${namespace} messaging`, async (t) => {
    const favoriteId = 'favoriteList_123456'
    const wantId = 'wantToGoList_123456'
    const base = 'https://www.google.com/maps/preview/entitylist/getlist'
    const wantUrl = `${base}?pb=!1m6!1s${wantId}!2e3!4i500`
    const favoriteUrl = `${base}?pb=!1m6!1s${favoriteId}!2e4!4i500`
    const discoveryUrl = 'https://www.google.com/locationhistory/preview/mas'
    const entry = [null, [null, null, '', null, 'Address', [null, null, 1, 2], ['1', '2']], 'Cafe']
    const list = Array(13).fill(null)
    list[0] = [favoriteId, 3, [[1]]]
    list[4] = 'Favorite places'
    list[8] = [entry]
    list[12] = 1
    const discovery = [[favoriteId, 3, [[1]]], 1, null, null, 'Favorite places']
    const storage = {
      appUrl: 'http://localhost:3013',
      token: 'phs_test',
      selectedListIds: [favoriteId],
      discoveryUrl,
    }
    let onRequest
    let onMessage
    const requested = []
    const originalChrome = globalThis.chrome
    const originalBrowser = globalThis.browser
    const originalFetch = globalThis.fetch
    t.after(() => {
      globalThis.chrome = originalChrome
      globalThis.browser = originalBrowser
      globalThis.fetch = originalFetch
    })
    const api = {
      webRequest: {
        onBeforeRequest: {
          addListener: (listener) => {
            onRequest = listener
          },
        },
      },
      runtime: {
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} },
        onMessage: {
          addListener: (listener) => {
            onMessage = listener
          },
        },
      },
      alarms: { onAlarm: { addListener() {} } },
      tabs: {
        query: async () => [{ id: 1 }],
        sendMessage: async (_id, { urls }) => {
          requested.push(...urls)
          return {
            responses: urls.map((url) => {
              if (url === discoveryUrl) return JSON.stringify([discovery])
              if (url.includes('/maps/preview/entitylist/getlist')) {
                assert.equal(
                  new URL(url).searchParams.get('pb'),
                  new URL(favoriteUrl).searchParams.get('pb'),
                )
                return JSON.stringify([list])
              }
              throw new Error('Unexpected Maps request')
            }),
          }
        },
      },
      storage: {
        local: {
          get: async (keys) =>
            Object.fromEntries(
              (Array.isArray(keys) ? keys : [keys]).map((key) => [key, storage[key]]),
            ),
          set: async (values) => {
            Object.assign(storage, values)
          },
        },
      },
    }
    globalThis.chrome = namespace === 'chrome' ? api : undefined
    globalThis.browser = namespace === 'browser' ? api : undefined
    globalThis.fetch = async (_url, options) => {
      assert.equal(JSON.parse(options.body).sourceListId, favoriteId)
      return { ok: true, json: async () => ({ imported: 1, removed: 0 }) }
    }

    await import(`./background.js?test=${namespace}`)
    onRequest({ url: favoriteUrl })
    onRequest({ url: wantUrl })
    const reply =
      namespace === 'browser'
        ? await onMessage({ type: 'SYNC_NOW' }, null, () =>
            assert.fail('Firefox should use a Promise'),
          )
        : await new Promise((resolve) => onMessage({ type: 'SYNC_NOW' }, null, resolve))

    assert.equal(reply.status.results[0].imported, 1)
    assert.equal(storage.listTemplate, wantUrl)
    assert.equal(storage.listTemplates[favoriteId], favoriteUrl)
    assert.equal(requested.length, 2)
  })
}
