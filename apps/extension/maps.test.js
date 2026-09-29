import assert from 'node:assert/strict'
import test from 'node:test'

for (const namespace of ['chrome', 'browser']) {
  test(`Maps content script replies through the ${namespace} messaging API`, async (t) => {
    const original = {
      browser: globalThis.browser,
      chrome: globalThis.chrome,
      location: globalThis.location,
      fetch: globalThis.fetch,
    }
    t.after(() => Object.assign(globalThis, original))
    let listener
    globalThis.browser =
      namespace === 'browser'
        ? {
            runtime: {
              onMessage: {
                addListener: (fn) => {
                  listener = fn
                },
              },
            },
          }
        : undefined
    globalThis.chrome =
      namespace === 'chrome'
        ? {
            runtime: {
              onMessage: {
                addListener: (fn) => {
                  listener = fn
                },
              },
            },
          }
        : undefined
    globalThis.location = { origin: 'https://www.google.com' }
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.credentials, 'include')
      return { ok: true, text: async () => 'safe response' }
    }
    await import(`./maps.js?test=${namespace}`)
    const request = {
      type: 'READ_GOOGLE',
      urls: ['https://www.google.com/maps/preview/place?pb=test'],
    }

    if (namespace === 'browser') {
      const reply = await listener(request, null, () => assert.fail('Firefox should use a Promise'))
      assert.deepEqual(reply, { responses: ['safe response'] })
    } else {
      const reply = await new Promise((resolve) => {
        assert.equal(listener(request, null, resolve), true)
      })
      assert.deepEqual(reply, { responses: ['safe response'] })
    }
  })
}
