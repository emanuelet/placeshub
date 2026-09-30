import assert from 'node:assert/strict'
import test from 'node:test'

test('disconnect clears stored credentials and captured Google request data in Firefox', async (t) => {
  const originals = {
    browser: globalThis.browser,
    chrome: globalThis.chrome,
    document: globalThis.document,
  }
  t.after(() => Object.assign(globalThis, originals))
  const handlers = {}
  const elements = Object.fromEntries(
    ['appUrl', 'token', 'status', 'connect', 'disconnect', 'connection'].map((id) => [
      id,
      {
        value: '',
        disabled: false,
        textContent: '',
        addEventListener: (type, handler) => {
          handlers[`${id}:${type}`] = handler
        },
      },
    ]),
  )
  const storage = {
    appUrl: 'https://placeshub.example',
    token: 'phs_example',
    selectedListIds: ['list'],
    availableLists: ['list'],
    lastSync: {},
    discoveryUrl: 'google request',
    listTemplate: 'google request',
    listTemplates: { list: 'google request' },
    placeTemplate: 'google request',
  }
  let removedPermissions
  globalThis.document = { getElementById: (id) => elements[id] }
  globalThis.chrome = undefined
  globalThis.browser = {
    storage: {
      local: {
        get: async (keys) =>
          Object.fromEntries(
            (Array.isArray(keys) ? keys : [keys]).map((key) => [key, storage[key]]),
          ),
        remove: async (keys) => {
          for (const key of keys) delete storage[key]
        },
      },
    },
    permissions: {
      remove: async (permission) => {
        removedPermissions = permission
      },
    },
  }

  await import('./options.js')
  await handlers['disconnect:click']()

  assert.deepEqual(storage, {})
  assert.deepEqual(removedPermissions, { origins: ['https://placeshub.example/*'] })
  assert.match(elements.status.textContent, /Disconnected locally/)
})

test('requests site access within the connect gesture before saving credentials', async (t) => {
  const originals = {
    browser: globalThis.browser,
    chrome: globalThis.chrome,
    document: globalThis.document,
  }
  t.after(() => Object.assign(globalThis, originals))
  const handlers = {}
  const elements = Object.fromEntries(
    ['appUrl', 'token', 'status', 'connect', 'disconnect', 'connection'].map((id) => [
      id,
      {
        value: '',
        disabled: false,
        textContent: '',
        addEventListener: (type, handler) => {
          handlers[`${id}:${type}`] = handler
        },
      },
    ]),
  )
  const token = `phs_${'a'.repeat(72)}`
  const operations = []
  globalThis.document = { getElementById: (id) => elements[id] }
  globalThis.chrome = undefined
  globalThis.browser = {
    storage: {
      local: {
        get: async () => ({ appUrl: 'https://placeshub.example', token }),
        set: async () => {
          operations.push('storage')
        },
      },
    },
    permissions: {
      request: async () => {
        operations.push('permission')
        return true
      },
    },
  }

  await import('./options.js?test=connect')
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(elements.connect.disabled, false)
  await handlers['connection:submit']({ preventDefault() {} })

  assert.deepEqual(operations, ['permission', 'storage'])
  assert.equal(elements.token.value, '')
})
