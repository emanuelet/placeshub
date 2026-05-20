import { Hono } from 'hono'
import { auth, type AuthEnv } from '../middleware/auth'

const places = new Hono<AuthEnv>()

places.use('/*', auth)

places.get('/search', (c) => {
  return c.json({ message: 'search places — not implemented' })
})

places.get('/', (c) => {
  return c.json({ message: 'list places — not implemented' })
})

places.post('/', (c) => {
  return c.json({ message: 'save place — not implemented' })
})

places.patch('/:id', (c) => {
  return c.json({ message: 'update place — not implemented' })
})

places.delete('/:id', (c) => {
  return c.json({ message: 'delete place — not implemented' })
})

export { places }
