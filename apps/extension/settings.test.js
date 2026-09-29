import assert from 'node:assert/strict'
import test from 'node:test'
import { validateConnection } from './settings.js'

const key = `phs_${'a'.repeat(72)}`

test('accepts HTTPS origins and local development origins', () => {
  assert.deepEqual(validateConnection(' https://places.example:8443 ', ` ${key} `), {
    appUrl: 'https://places.example:8443',
    token: key,
  })
  assert.equal(validateConnection('http://localhost:3000', key).appUrl, 'http://localhost:3000')
})

test('rejects non-origins and insecure remote addresses', () => {
  for (const address of [
    'not a url',
    'http://places.example',
    'http://127.0.0.1:3000',
    'https://user:pass@places.example',
    'https://places.example/path',
    'https://places.example/?q=1',
    'https://places.example/?',
    'https://places.example/#fragment',
    'https://places.example/#',
    'ftp://places.example',
  ]) {
    assert.throws(() => validateConnection(address, key), /PlacesHub origin/)
  }
})

test('rejects missing and malformed keys', () => {
  for (const invalid of ['', 'phs_short', `phs_${'A'.repeat(72)}`, `phs_${'a'.repeat(73)}`]) {
    assert.throws(() => validateConnection('https://places.example', invalid), /extension key/)
  }
})
