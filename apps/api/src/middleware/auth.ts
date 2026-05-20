import { createMiddleware } from 'hono/factory'
import { createClient } from '@supabase/supabase-js'
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
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  c.set('userId', user.id)
  await next()
})
