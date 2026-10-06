import { placeEnrichmentJobs, placeSourceKeys, places } from '@placeshub/db/schema'
import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm'
import { getDb } from './db'

const automaticDailyTarget = 900
const hardDailyLimit = 1000
const requestSpacingMs = (24 * 60 * 60 * 1000) / automaticDailyTarget

type Env = { DATABASE_URL: string; GOOGLE_PLACES_API_KEY?: string }
type Candidate = { id: string; name: string; address: string | null; lat: number | null; lng: number | null }

function pacificDay() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`
}

async function reserveGoogleRequest(db: ReturnType<typeof getDb>['db']) {
  const now = new Date()
  const row = await db.execute(sql<{ attempts: number }>`
    INSERT INTO google_request_usage (day, attempts, next_request_at, updated_at)
    VALUES (${pacificDay()}::date, 1, ${new Date(now.getTime() + requestSpacingMs)}, ${now})
    ON CONFLICT (day) DO UPDATE SET
      attempts = google_request_usage.attempts + 1,
      next_request_at = GREATEST(google_request_usage.next_request_at, ${now}) + interval '96 seconds',
      updated_at = ${now}
    WHERE google_request_usage.attempts < ${hardDailyLimit}
      AND google_request_usage.next_request_at <= ${now}
    RETURNING attempts
  `)
  return row.length > 0
}

function isStrongMatch(place: { name: string; lat: number | null; lng: number | null }, candidate: Candidate) {
  const name = place.name.trim().toLowerCase()
  const candidateName = candidate.name.trim().toLowerCase()
  if (!name || !candidateName || !(name === candidateName || candidateName.includes(name) || name.includes(candidateName))) return false
  if (place.lat == null || place.lng == null || candidate.lat == null || candidate.lng == null) return true
  const lat = ((place.lat - candidate.lat) * Math.PI) / 180
  const lng = ((place.lng - candidate.lng) * Math.PI) / 180
  const a = Math.sin(lat / 2) ** 2 + Math.cos((place.lat * Math.PI) / 180) * Math.cos((candidate.lat * Math.PI) / 180) * Math.sin(lng / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= 500
}

async function searchCandidates(key: string, place: { name: string; lat: number | null; lng: number | null }) {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.formattedAddress' },
    body: JSON.stringify({
      textQuery: place.name,
      pageSize: 3,
      ...(place.lat != null && place.lng != null ? { locationBias: { circle: { center: { latitude: place.lat, longitude: place.lng }, radius: 1000 } } } : {}),
    }),
  })
  if (!response.ok) throw new Error(`Google search failed (${response.status})`)
  const body = (await response.json()) as { places?: Array<{ id?: string; displayName?: { text?: string }; location?: { latitude?: number; longitude?: number }; formattedAddress?: string }> }
  return (body.places ?? []).flatMap((candidate): Candidate[] => candidate.id && candidate.displayName?.text ? [{ id: candidate.id, name: candidate.displayName.text, address: candidate.formattedAddress ?? null, lat: candidate.location?.latitude ?? null, lng: candidate.location?.longitude ?? null }] : [])
}

async function getDetails(key: string, id: string) {
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'id,displayName,location,formattedAddress,googleMapsUri,types,nationalPhoneNumber,websiteUri,rating,businessStatus,priceLevel,userRatingCount,regularOpeningHours.weekdayDescriptions,plusCode.globalCode' },
  })
  if (!response.ok) throw new Error(`Google details failed (${response.status})`)
  return (await response.json()) as { displayName?: { text?: string }; location?: { latitude?: number; longitude?: number }; formattedAddress?: string; googleMapsUri?: string; types?: string[]; nationalPhoneNumber?: string; websiteUri?: string; rating?: number; businessStatus?: string; priceLevel?: string; userRatingCount?: number; regularOpeningHours?: { weekdayDescriptions?: string[] }; plusCode?: { globalCode?: string } }
}

export async function processOnePlaceEnrichment(env: Env) {
  if (!env.GOOGLE_PLACES_API_KEY) return
  const { db, client } = getDb(env.DATABASE_URL)
  try {
    const [job] = await db.select({ id: placeEnrichmentJobs.id, status: placeEnrichmentJobs.status, resolvedGooglePlaceId: placeEnrichmentJobs.resolvedGooglePlaceId, place: { id: places.id, name: places.name, lat: places.lat, lng: places.lng } }).from(placeEnrichmentJobs).innerJoin(places, eq(placeEnrichmentJobs.placeId, places.id)).where(and(inArray(placeEnrichmentJobs.status, ['pending', 'resolving', 'details']), lte(placeEnrichmentJobs.nextAttemptAt, new Date()))).orderBy(asc(placeEnrichmentJobs.nextAttemptAt)).limit(1).for('update')
    if (!job) return
    if (!(await reserveGoogleRequest(db))) return
    try {
      if (job.status === 'pending' || job.status === 'resolving') {
        const candidates = await searchCandidates(env.GOOGLE_PLACES_API_KEY, job.place)
        const strong = candidates[0] && isStrongMatch(job.place, candidates[0])
        await db.update(placeEnrichmentJobs).set(strong ? { status: 'details', resolvedGooglePlaceId: strong.id, candidates, attempts: sql`${placeEnrichmentJobs.attempts} + 1`, nextAttemptAt: new Date(), updatedAt: new Date() } : { status: candidates.length ? 'ambiguous' : 'unmatched', candidates, attempts: sql`${placeEnrichmentJobs.attempts} + 1`, completedAt: new Date(), updatedAt: new Date() }).where(eq(placeEnrichmentJobs.id, job.id))
        return
      }
      const details = await getDetails(env.GOOGLE_PLACES_API_KEY, job.resolvedGooglePlaceId as string)
      await db.transaction(async (tx) => {
        const [canonical] = await tx
          .select({ id: places.id })
          .from(places)
          .where(eq(places.googlePlaceId, job.resolvedGooglePlaceId as string))
          .limit(1)
        if (canonical && canonical.id !== job.place.id) {
          // Keep every user relationship before deleting the temporary My Maps row.
          await tx.execute(sql`
            INSERT INTO saved_places (user_id, place_id, notes, directly_saved, tags, created_at)
            SELECT user_id, ${canonical.id}, notes, directly_saved, tags, created_at
            FROM saved_places WHERE place_id = ${job.place.id}
            ON CONFLICT (user_id, place_id) DO UPDATE SET
              directly_saved = saved_places.directly_saved OR excluded.directly_saved,
              notes = COALESCE(saved_places.notes, excluded.notes)
          `)
          await tx.execute(sql`
            INSERT INTO collection_places (collection_id, place_id, sort_order, notes, created_at)
            SELECT collection_id, ${canonical.id}, sort_order, notes, created_at
            FROM collection_places WHERE place_id = ${job.place.id}
            ON CONFLICT (collection_id, place_id) DO UPDATE SET
              notes = COALESCE(collection_places.notes, excluded.notes)
          `)
          await tx.update(placeSourceKeys).set({ placeId: canonical.id }).where(eq(placeSourceKeys.placeId, job.place.id))
          await tx.delete(places).where(eq(places.id, job.place.id))
          return
        }
        await tx.update(places).set({ googlePlaceId: job.resolvedGooglePlaceId as string, name: details.displayName?.text ?? job.place.name, lat: details.location?.latitude ?? job.place.lat, lng: details.location?.longitude ?? job.place.lng, address: details.formattedAddress ?? null, googleMapsUri: details.googleMapsUri ?? null, types: details.types ?? null, phone: details.nationalPhoneNumber ?? null, website: details.websiteUri ?? null, rating: details.rating ?? null, metadata: { ...(details.businessStatus ? { businessStatus: details.businessStatus } : {}), ...(details.priceLevel ? { priceLevel: details.priceLevel } : {}), ...(details.userRatingCount != null ? { reviewCount: details.userRatingCount } : {}), ...(details.plusCode?.globalCode ? { plusCode: details.plusCode.globalCode } : {}), ...(details.regularOpeningHours?.weekdayDescriptions ? { hours: details.regularOpeningHours.weekdayDescriptions } : {}) }, cachedAt: new Date() }).where(eq(places.id, job.place.id))
        await tx.update(placeEnrichmentJobs).set({ status: 'completed', attempts: sql`${placeEnrichmentJobs.attempts} + 1`, completedAt: new Date(), updatedAt: new Date() }).where(eq(placeEnrichmentJobs.id, job.id))
      })
    } catch (error) {
      await db.update(placeEnrichmentJobs).set({ status: 'failed', attempts: sql`${placeEnrichmentJobs.attempts} + 1`, lastError: error instanceof Error ? error.message : 'Google request failed', nextAttemptAt: new Date(Date.now() + 60 * 60 * 1000), updatedAt: new Date() }).where(eq(placeEnrichmentJobs.id, job.id))
    }
  } finally { await client.end() }
}
