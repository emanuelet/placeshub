import { Hono } from 'hono'
import { auth, type AuthEnv } from '../middleware/auth'

const collections = new Hono<AuthEnv>()

collections.use('/*', auth)

collections.get('/', (c) => {
  return c.json({ message: 'list collections — not implemented' })
})

collections.post('/', (c) => {
  return c.json({ message: 'create collection — not implemented' })
})

collections.get('/:id', (c) => {
  return c.json({ message: 'get collection — not implemented' })
})

collections.patch('/:id', (c) => {
  return c.json({ message: 'update collection — not implemented' })
})

collections.delete('/:id', (c) => {
  return c.json({ message: 'delete collection — not implemented' })
})

collections.post('/:id/places', (c) => {
  return c.json({ message: 'add place to collection — not implemented' })
})

collections.delete('/:id/places/:placeId', (c) => {
  return c.json({ message: 'remove place from collection — not implemented' })
})

export { collections }
