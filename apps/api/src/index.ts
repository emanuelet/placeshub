import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { collections } from './routes/collections'
import { places } from './routes/places'
import { shares } from './routes/shares'

export type Bindings = {
  SUPABASE_URL: string
  SUPABASE_KEY: string
  DATABASE_URL: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/*', cors())

app.get('/api/health', (c) => c.json({ status: 'ok' }))

app.route('/api/places', places)
app.route('/api/collections', collections)
app.route('/api/shares', shares)

export default app
