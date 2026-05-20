import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

export function getDb(url: string) {
  const client = postgres(url)
  const db = drizzle({ client })
  return { db, client }
}
