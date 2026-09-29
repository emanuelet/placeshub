// Google Maps internal responses are undocumented. Reject unexpected shapes instead of
// treating them as empty lists (which would remove memberships on the server).
export function decodeResponse(text) {
  return JSON.parse(text.replace(/^\)\]\}'\s*/, ''))
}

export function parseLists(text) {
  const payload = decodeResponse(text)
  const lists = new Map()
  function visit(node) {
    if (!Array.isArray(node)) return
    const id = node[0]?.[0]
    if (
      typeof id === 'string' &&
      /^[\w-]{10,}$/.test(id) &&
      typeof node[4] === 'string' &&
      node[4] &&
      typeof node[1] === 'number' &&
      Array.isArray(node[0]?.[2])
    ) {
      lists.set(id, {
        sourceListId: id,
        title: node[4],
        advertisedCount: Number.isInteger(node[11]) ? node[11] : null,
      })
    }
    for (const item of node) visit(item)
  }
  visit(payload)
  if (!lists.size)
    throw new Error('Google list discovery response changed or contains no supported lists')
  return [...lists.values()]
}

function placeKey(item, lat, lng, name) {
  const pair = item[1]?.[6]
  if (Array.isArray(pair) && pair.length === 2 && pair.every((part) => typeof part === 'string')) {
    return `maps:cid:${pair[0]}:${pair[1]}`
  }
  const feature = item[1]?.[7]
  if (typeof feature === 'string' && feature.startsWith('/g/')) return `maps:feature:${feature}`
  // Some Maps entries have only coordinates. Their fallback identity can change if
  // Google moves or renames them; do not pretend it is a Places API place ID.
  return `maps:coordinates:${lat.toFixed(7)}:${lng.toFixed(7)}:${name.trim().toLowerCase().slice(0, 100)}`
}

export function parseList(text, sourceListId, advertisedCount = null) {
  let payload
  try {
    payload = decodeResponse(text)
  } catch {
    throw new Error('Google list response is not JSON; no changes sent')
  }
  const list = payload?.[0]
  if (
    !Array.isArray(list) ||
    list[0]?.[0] !== sourceListId ||
    !Array.isArray(list[8]) ||
    !Number.isInteger(list[12])
  ) {
    const shape = [
      `root ${Array.isArray(payload) ? 'array' : typeof payload}`,
      `first ${Array.isArray(list) ? 'array' : typeof list}`,
      `id ${list?.[0]?.[0] === sourceListId ? 'matches' : typeof list?.[0]?.[0] === 'string' ? 'differs' : 'missing'}`,
      `places ${Array.isArray(list?.[8]) ? 'array' : typeof list?.[8]}`,
      `count ${Number.isInteger(list?.[12]) ? 'integer' : typeof list?.[12]}`,
    ].join(', ')
    throw new Error(`Google list response format changed (${shape}); no changes sent`)
  }
  const title = list[4]
  if (typeof title !== 'string' || !title) throw new Error('Missing list title')
  const places = list[8].map((item) => {
    const coordinates = item?.[1]?.[5]
    const lat = coordinates?.[2]
    const lng = coordinates?.[3]
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Place has no coordinates')
    const name = typeof item[2] === 'string' ? item[2] : ''
    const sourcePlaceId = placeKey(item, lat, lng, name)
    const address = item[1]?.[4] || item[1]?.[3] || null
    const note = item[3] || null
    const timestamp = (parts) =>
      Array.isArray(parts) && Number.isInteger(parts[0])
        ? new Date(parts[0] * 1000 + (parts[1] || 0) / 1e6).toISOString()
        : null
    if (typeof address !== 'string' && address !== null) throw new Error('Unexpected address')
    if (typeof note !== 'string' && note !== null) throw new Error('Unexpected note')
    return {
      sourcePlaceId,
      name,
      lat,
      lng,
      address,
      notes: note,
      metadata: { dateAdded: timestamp(item[9]), dateUpdated: timestamp(item[10]) },
      googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`,
    }
  })
  const expectedCount = list[12]
  if (
    places.length !== expectedCount ||
    (expectedCount === 0 && advertisedCount === null) ||
    (advertisedCount !== null && expectedCount !== advertisedCount) ||
    new Set(places.map((place) => place.sourcePlaceId)).size !== places.length
  ) {
    throw new Error(
      `Incomplete list: ${places.length} of ${expectedCount} unique places; no changes sent`,
    )
  }
  return { sourceListId, title, complete: true, expectedCount, places }
}

export function listRequestId(template) {
  const url = new URL(template)
  if (
    url.origin !== 'https://www.google.com' ||
    url.pathname !== '/maps/preview/entitylist/getlist'
  ) {
    throw new Error('Invalid Google list request template')
  }
  const pb = url.searchParams.get('pb')
  const id = /^!1m6!1s([^!]+)/.exec(pb || '')?.[1]
  if (!id || !/^[\w-]{10,}$/.test(id)) throw new Error('Google request template changed')
  return id
}

export function listUrl(template, sourceListId) {
  if (!/^[\w-]{10,}$/.test(sourceListId)) throw new Error('Invalid list ID')
  listRequestId(template)
  const url = new URL(template)
  const pb = url.searchParams.get('pb')
  url.searchParams.set(
    'pb',
    pb.replace(/^(!1m6!1s)[^!]+/, (_match, prefix) => prefix + sourceListId),
  )
  return url.href
}

export function listUrlForList(captured, fallback, sourceListId) {
  if (typeof captured === 'string') {
    try {
      if (listRequestId(captured) === sourceListId) return listUrl(captured, sourceListId)
    } catch {
      // A stale or malformed capture must not replace a valid fallback template.
    }
  }
  return listUrl(fallback, sourceListId)
}

function cidFromSourceKey(sourcePlaceId) {
  const match = /^maps:cid:(-?\d+):(-?\d+)$/.exec(sourcePlaceId)
  if (!match) throw new Error('Place has no Google Maps CID')
  const hex = (part) => `0x${BigInt.asUintN(64, BigInt(part)).toString(16)}`
  return `${hex(match[1])}:${hex(match[2])}`
}

export function placeUrl(template, sourcePlaceId) {
  const url = new URL(template)
  if (url.origin !== 'https://www.google.com' || url.pathname !== '/maps/preview/place') {
    throw new Error('Invalid Google place request template')
  }
  const pb = url.searchParams.get('pb')
  if (!pb || !/!1s0x[0-9a-f]+:0x[0-9a-f]+/.test(pb)) {
    throw new Error('Google place request template changed')
  }
  url.searchParams.set(
    'pb',
    pb.replace(/!1s0x[0-9a-f]+:0x[0-9a-f]+/, `!1s${cidFromSourceKey(sourcePlaceId)}`),
  )
  return url.href
}

export function parsePlace(text, sourcePlaceId) {
  const place = decodeResponse(text)?.[6]
  if (!Array.isArray(place) || place[10] !== cidFromSourceKey(sourcePlaceId)) {
    throw new Error('Google place details did not match the requested place')
  }
  const placeId = place[78]
  if (typeof placeId !== 'string' || !/^[\w-]{15,200}$/.test(placeId)) {
    throw new Error('Google place details had no Place ID')
  }
  const hours = place[203]?.[0]
    ?.slice(0, 7)
    .map((day) => ({ day: day?.[0], hours: day?.[3]?.[0]?.[0] }))
  const imageUrl = place[51]?.[0]?.[0]?.[6]?.[0]
  const textOrNull = (value) => (typeof value === 'string' ? value : null)
  const metadata = {
    reviewCount: Number.isInteger(place[4]?.[8]) ? place[4][8] : null,
    category: Array.isArray(place[13])
      ? place[13].filter((type) => typeof type === 'string').slice(0, 20)
      : [],
    hours:
      Array.isArray(hours) &&
      hours.every((day) => typeof day.day === 'string' && typeof day.hours === 'string')
        ? hours
        : null,
    imageUrl: typeof imageUrl === 'string' && imageUrl.startsWith('https://') ? imageUrl : null,
    plusCode: textOrNull(place[183]?.[2]?.[1]?.[0]),
    city: textOrNull(place[183]?.[1]?.[3]),
    postalCode: textOrNull(place[183]?.[1]?.[4]),
    state: textOrNull(place[183]?.[1]?.[5]),
    countryCode: textOrNull(place[183]?.[1]?.[6]),
    country: textOrNull(place[245]?.[0]?.[0]?.[2]?.[0]?.[0]),
  }
  return {
    placeId,
    name: typeof place[11] === 'string' ? place[11] : null,
    address: typeof place[18] === 'string' ? place[18] : null,
    phone: typeof place[178]?.[0]?.[0] === 'string' ? place[178][0][0] : null,
    website:
      typeof place[7]?.[0] === 'string' && /^https?:\/\//.test(place[7][0]) ? place[7][0] : null,
    rating:
      typeof place[4]?.[7] === 'number' && place[4][7] >= 0 && place[4][7] <= 5
        ? place[4][7]
        : null,
    googleMapsUri: `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`,
    metadata,
  }
}
