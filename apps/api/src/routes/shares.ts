import { Hono } from 'hono'
import { auth, type AuthEnv } from '../middleware/auth'

const shares = new Hono<AuthEnv>()

shares.post('/', auth, (c) => {
  return c.json({ message: 'create share — not implemented' })
})

shares.get('/:slug', (c) => {
  return c.json({ message: 'get share — not implemented' })
})

export { shares }
