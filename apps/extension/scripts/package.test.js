import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { browserManifest } from './package.mjs'

const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'))

test('Chrome release keeps the service worker and shared manifest version', () => {
  const chrome = browserManifest(manifest, 'chrome')
  assert.deepEqual(chrome, manifest)
  assert.equal(chrome.background.service_worker, 'background.js')
  assert.equal(chrome.version, '0.1.0')
})

test('Firefox release uses an event-page module and a stable signing ID', () => {
  const firefox = browserManifest(manifest, 'firefox')
  assert.deepEqual(firefox.background, { scripts: ['background.js'], type: 'module' })
  assert.equal(firefox.browser_specific_settings.gecko.id, 'placeshub-sync@emanuelet.github.io')
  assert.equal(firefox.browser_specific_settings.gecko.strict_min_version, '142.0')
  assert.deepEqual(firefox.browser_specific_settings.gecko.data_collection_permissions.required, [
    'authenticationInfo',
    'bookmarksInfo',
    'locationInfo',
    'websiteContent',
  ])
  assert.equal(firefox.version, manifest.version)
  assert.deepEqual(manifest.background, { service_worker: 'background.js', type: 'module' })
  assert.throws(() => browserManifest(manifest, 'safari'), /Unknown browser/)
})
