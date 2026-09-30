import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { collections } from './routes/collections'
import { mcp } from './routes/mcp'
import { mcpKeys } from './routes/mcp-keys'
import { places } from './routes/places'
import { shares } from './routes/shares'
import { sync } from './routes/sync'

export type Bindings = {
  SUPABASE_URL: string
  SUPABASE_KEY: string
  DATABASE_URL: string
  GOOGLE_PLACES_API_KEY?: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/*', (c, next) => (c.req.path === '/api/mcp' ? next() : cors()(c, next)))

app.get('/api/health', (c) => c.json({ status: 'ok' }))

app.route('/api/places', places)
app.route('/api/collections', collections)
app.route('/api/shares', shares)
app.route('/api/sync', sync)
app.route('/api/mcp/keys', mcpKeys)
app.route('/api/mcp', mcp)

export default app
