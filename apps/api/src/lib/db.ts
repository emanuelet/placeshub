import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

export function getDb(url: string) {
  // A Worker should not open a pool of connections per request. Supabase's
  // transaction pooler also requires prepared statements to be disabled.
  const client = postgres(url, { max: 1, prepare: false })
  const db = drizzle({ client })
  return { db, client }
}
