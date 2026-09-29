import assert from 'node:assert/strict'
import test from 'node:test'
import {
  listRequestId,
  listUrl,
  listUrlForList,
  parseList,
  parseLists,
  parsePlace,
  placeUrl,
} from './parser.js'

const id = 'sampleList_123456789'
const entry = (name, pair, lat = -27.46, lng = 153.05) => [
  null,
  [null, null, '', null, 'Example address', [null, null, lat, lng], pair],
  name,
  'my note',
]
function response(entries, expectedCount = entries.length) {
  const list = Array(13).fill(null)
  list[0] = [id, 3, [[1], [9]]]
  list[4] = 'Want to go'
  list[8] = entries
  list[12] = expectedCount
  return `)]}'\n${JSON.stringify([list])}`
}

test('discovers list metadata without assuming fixed nesting', () => {
  const list = [[id, 3, [[1], [9]]], 1, null, null, 'Want to go']
  assert.deepEqual(parseLists(`)]}'\n${JSON.stringify([null, [null, [[list]]]])}`), [
    { sourceListId: id, title: 'Want to go', advertisedCount: null },
  ])
})

test('reads an entire list, preserving notes and coordinates without mislabelling the Maps identifier as a Places API ID', () => {
  const snapshot = parseList(
    response([entry('Cafe', ['1', '2']), entry('Unnamed', null, 41.9, 12.47)]),
    id,
  )
  assert.equal(snapshot.expectedCount, 2)
  assert.equal(snapshot.complete, true)
  assert.equal(snapshot.places[0].sourcePlaceId, 'maps:cid:1:2')
  assert.equal(snapshot.places[0].notes, 'my note')
  assert.equal(snapshot.places[0].lat, -27.46)
  assert.match(snapshot.places[1].sourcePlaceId, /^maps:coordinates:/)
})

test('fails closed on an incomplete page and duplicate identities instead of deleting missing places', () => {
  assert.throws(() => parseList(response([entry('Cafe', ['1', '2'])], 2), id), /Incomplete list/)
  assert.throws(() => parseList(response([], 0), id, 2), /Incomplete list/)
  assert.throws(() => parseList(response([], 0), id), /Incomplete list/)
  assert.equal(parseList(response([], 0), id, 0).places.length, 0)
  assert.throws(
    () => parseList(response([entry('Cafe', ['1', '2']), entry('Cafe', ['1', '2'])]), id),
    /Incomplete list/,
  )
  assert.throws(() => parseList(")]}'\n[null]", id), /response format changed/)
  assert.throws(() => parseList('<html>Sign in</html>', id), /not JSON; no changes sent/)
  assert.throws(
    () => parseList(response([entry('Cafe', ['1', '2'])]).replace(id, 'anotherList_123456'), id),
    /id differs, places array, count integer\); no changes sent/,
  )
})

test('replaces only the requested list ID in a captured Maps request', () => {
  const url = listUrl(
    `https://www.google.com/maps/preview/entitylist/getlist?pb=!1m6!1s${id}!2e3!4i500`,
    'abc1234567890',
  )
  assert.equal(new URL(url).searchParams.get('pb'), '!1m6!1sabc1234567890!2e3!4i500')
  assert.throws(
    () => listUrl('https://evil.example/maps/preview/entitylist/getlist?pb=!1m6!1sa', id),
    /Invalid Google/,
  )
})

test('prefers a list-specific captured request while rejecting stale or unrelated templates', () => {
  const favorite = 'favoriteList_123456'
  const base = `https://www.google.com/maps/preview/entitylist/getlist?pb=!1m6!1s${id}!2e3!4i500`
  const own = `https://www.google.com/maps/preview/entitylist/getlist?pb=!1m6!1s${favorite}!2e4!4i500`
  assert.equal(listRequestId(own), favorite)
  assert.equal(
    new URL(listUrlForList(own, base, favorite)).searchParams.get('pb'),
    `!1m6!1s${favorite}!2e4!4i500`,
  )
  assert.equal(
    new URL(listUrlForList(base, base, favorite)).searchParams.get('pb'),
    `!1m6!1s${favorite}!2e3!4i500`,
  )
  assert.equal(
    new URL(listUrlForList('https://evil.example/', base, favorite)).origin,
    'https://www.google.com',
  )
})

const sourcePlaceId = 'maps:cid:1:-2'
const cid = '0x1:0xfffffffffffffffe'

test('derives a Maps CID from signed decimal identifiers for a place-detail request', () => {
  const url = placeUrl(
    `https://www.google.com/maps/preview/place?pb=!1m14!1s0xa:0xb!3m9`,
    sourcePlaceId,
  )
  assert.equal(new URL(url).searchParams.get('pb'), `!1m14!1s${cid}!3m9`)
  assert.throws(() =>
    placeUrl('https://example.com/maps/preview/place?pb=!1s0xa:0xb', sourcePlaceId),
  )
})

test('extracts real Place ID, contact, rating and hours only when details match the saved place', () => {
  const p = Array(246).fill(null)
  p[10] = cid
  p[11] = 'Example cafe'
  p[18] = '123 Main St'
  p[78] = 'ChIJexamplePlaceID12345'
  p[4] = Array(9).fill(null)
  p[4][7] = 4.7
  p[4][8] = 166
  p[7] = ['https://example.com']
  p[13] = ['Cafe']
  p[178] = [['123456789']]
  p[203] = [[['Monday', null, null, [['Closed']]]]]
  const response = Array(7).fill(null)
  response[6] = p
  const details = parsePlace(`)]}'\n${JSON.stringify(response)}`, sourcePlaceId)
  assert.equal(details.placeId, p[78])
  assert.equal(details.phone, '123456789')
  assert.equal(details.website, 'https://example.com')
  assert.equal(details.rating, 4.7)
  assert.equal(details.metadata.reviewCount, 166)
  assert.deepEqual(details.metadata.hours, [{ day: 'Monday', hours: 'Closed' }])
  assert.throws(
    () => parsePlace(`)]}'\n${JSON.stringify(response)}`, 'maps:cid:3:4'),
    /did not match/,
  )
})
