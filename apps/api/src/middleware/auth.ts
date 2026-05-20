import { createClient } from '@supabase/supabase-js'
import { createMiddleware } from 'hono/factory'
import postgres from 'postgres'
import type { Bindings } from '../index'

export type AuthEnv = {
  Bindings: Bindings
  Variables: {
    userId: string
  }
}

export const auth = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const token = authHeader.slice(7)
  const supabaseUrl = c.env.SUPABASE_URL
  const supabaseKey = c.env.SUPABASE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return c.json({ error: 'auth not configured' }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const client = postgres(c.env.DATABASE_URL)
  try {
    await client`
      INSERT INTO users (id, email, display_name, avatar_url, created_at)
      VALUES (${user.id}, ${user.email ?? null}, ${user.user_metadata?.full_name ?? null}, ${user.user_metadata?.avatar_url ?? null}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = COALESCE(EXCLUDED.display_name, users.display_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url)
    `
  } finally {
    await client.end()
  }

  c.set('userId', user.id)
  await next()
})
