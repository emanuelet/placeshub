import { createDb, type Db } from '@placeshub/db'

let db: Db | null = null
let currentUrl: string | null = null

export function getDb(url: string): Db {
  if (!db || currentUrl !== url) {
    db = createDb(url)
    currentUrl = url
  }
  return db
}
