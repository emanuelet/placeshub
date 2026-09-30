import { Alert } from '@repo/ui/alert'
import { buttonClass } from '@repo/ui/button'
import { Panel } from '@repo/ui/panel'
import { createFileRoute, Link, Navigate } from '@tanstack/react-router'
import { Layers, RefreshCw, Share2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'

export const Route = createFileRoute('/')({ component: Landing })

const features = [
  {
    icon: RefreshCw,
    title: 'Sync from Google Maps',
    body: 'The Chrome extension pulls your saved lists into PlacesHub every hour, so your bookmarks stay current without exporting anything.',
  },
  {
    icon: Layers,
    title: 'Curate collections',
    body: 'Group places into collections, see them on one map, and keep notes that Google Maps lists cannot hold.',
  },
  {
    icon: Share2,
    title: 'Share a map or KML',
    body: 'Publish a collection as a public map link, or download a KML file to open in any mapping tool.',
  },
]

function Landing() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <div className="space-y-12 py-6 sm:py-10">
      <section className="space-y-6 text-center">
        <p className="ui-eyebrow">Personal spatial CRM</p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
          Your curated places, on one shareable map.
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          PlacesHub turns the places you save in Google Maps into organised collections you can
          browse, annotate and share.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth/signup" className={buttonClass('accent', 'min-h-11 px-6')}>
            Get started
          </Link>
          <Link to="/auth/login" className={buttonClass('secondary', 'min-h-11 px-6')}>
            Sign in
          </Link>
        </div>
      </section>

      <section aria-label="Features" className="grid gap-4 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <Panel key={title} className="space-y-3 p-5">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-control bg-brand-50 text-brand-700 dark:bg-muted dark:text-primary">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="ui-section-title">{title}</h2>
            <p className="text-sm text-muted-foreground">{body}</p>
          </Panel>
        ))}
      </section>

      <Alert tone="success" className="mx-auto max-w-3xl text-center">
        Your Google Maps data stays yours: sync is one-way and keys can be revoked at any time.
      </Alert>
      <p className="text-center text-sm text-muted-foreground">
        <Link to="/privacy" className="font-semibold text-primary hover:underline">
          Extension privacy
        </Link>
      </p>
    </div>
  )
}
