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

      <section aria-labelledby="extension-heading" className="space-y-5">
        <div className="space-y-2 text-center">
          <h2 id="extension-heading" className="ui-page-title">
            See the browser extension in action
          </h2>
          <p className="text-muted-foreground">
            Connect PlacesHub, choose your Google Maps lists, and sync them from Chrome or Firefox.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <figure className="ui-panel overflow-hidden p-4">
            <img
              src="/screenshots/extension-popup.png"
              alt="PlacesHub extension popup with selected Google Maps lists and example sync results"
              width="500"
              height="455"
              loading="lazy"
              className="mx-auto h-auto w-full max-w-[500px] rounded-control"
            />
            <figcaption className="mt-3 text-sm text-muted-foreground">
              Select lists and see sync results (example data).
            </figcaption>
          </figure>
          <figure className="ui-panel overflow-hidden p-4">
            <img
              src="/screenshots/extension-settings.png"
              alt="PlacesHub extension settings with fields for the site address and extension key"
              width="760"
              height="430"
              loading="lazy"
              className="mx-auto h-auto w-full max-w-[760px] rounded-control"
            />
            <figcaption className="mt-3 text-sm text-muted-foreground">
              Connect securely with a revocable extension key.
            </figcaption>
          </figure>
        </div>
        <div className="text-center">
          <a
            href="https://github.com/emanuelet/placeshub#google-maps-list-sync-chrome-and-firefox-extensions"
            className={buttonClass('secondary', 'min-h-11 px-6')}
          >
            Chrome &amp; Firefox install instructions
          </a>
        </div>
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
