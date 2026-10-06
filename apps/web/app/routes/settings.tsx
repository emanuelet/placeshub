import { createFileRoute, Link } from '@tanstack/react-router'
import { Bot, Palette, RefreshCw, Share2 } from 'lucide-react'
import { useLocalStorage } from 'usehooks-ts'
import { GoogleSyncSettings } from '@/components/GoogleSyncSettings'
import { McpSettings } from '@/components/McpSettings'
import { SnapshotSettings } from '@/components/SnapshotSettings'

type SettingsTab = 'google-sync' | 'appearance' | 'mcp' | 'snapshots'

export const Route = createFileRoute('/settings')({
  validateSearch: (search: Record<string, unknown>): { tab: SettingsTab } => ({
    tab:
      search.tab === 'appearance' || search.tab === 'mcp' || search.tab === 'snapshots'
        ? search.tab
        : 'google-sync',
  }),
  component: Settings,
})

function Settings() {
  const { tab } = Route.useSearch()
  const [side, setSide] = useLocalStorage<'left' | 'right'>('sidebar-side', 'right')

  return (
    <div className="space-y-5">
      <h1 className="ui-page-title">Settings</h1>
      <nav className="flex flex-wrap gap-2 border-b pb-3" aria-label="Settings tabs">
        <Link
          to="/settings"
          search={{ tab: 'mcp' }}
          className={`ui-button ${tab === 'mcp' ? 'ui-button-primary' : 'ui-button-secondary'}`}
          aria-current={tab === 'mcp' ? 'page' : undefined}
        >
          <Bot className="mr-1 h-4 w-4" aria-hidden="true" /> AI agents
        </Link>
        <Link
          to="/settings"
          search={{ tab: 'google-sync' }}
          className={`ui-button ${tab === 'google-sync' ? 'ui-button-primary' : 'ui-button-secondary'}`}
          aria-current={tab === 'google-sync' ? 'page' : undefined}
        >
          <RefreshCw className="mr-1 h-4 w-4" aria-hidden="true" /> Google Sync
        </Link>
        <Link
          to="/settings"
          search={{ tab: 'appearance' }}
          className={`ui-button ${tab === 'appearance' ? 'ui-button-primary' : 'ui-button-secondary'}`}
          aria-current={tab === 'appearance' ? 'page' : undefined}
        >
          <Palette className="mr-1 h-4 w-4" aria-hidden="true" /> Appearance
        </Link>
        <Link
          to="/settings"
          search={{ tab: 'snapshots' }}
          className={`ui-button ${tab === 'snapshots' ? 'ui-button-primary' : 'ui-button-secondary'}`}
          aria-current={tab === 'snapshots' ? 'page' : undefined}
        >
          <Share2 className="mr-1 h-4 w-4" aria-hidden="true" /> Snapshots
        </Link>
      </nav>
      {tab === 'google-sync' ? (
        <GoogleSyncSettings />
      ) : tab === 'mcp' ? (
        <McpSettings />
      ) : tab === 'snapshots' ? (
        <SnapshotSettings />
      ) : (
        <section className="ui-panel space-y-4 p-5" aria-labelledby="sidebar-heading">
          <h2 id="sidebar-heading" className="ui-section-title">
            Sidebar position
          </h2>
          <p className="text-sm text-muted-foreground">
            Choose which side shows your places and place details on desktop.
          </p>
          <fieldset className="flex flex-wrap gap-4">
            <legend className="sr-only">Sidebar position</legend>
            {(['left', 'right'] as const).map((value) => (
              <label
                key={value}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-control border bg-surface px-4"
              >
                <input
                  type="radio"
                  name="sidebar-side"
                  value={value}
                  checked={side === value}
                  onChange={() => setSide(value)}
                />
                {value === 'left' ? 'Left' : 'Right'}
              </label>
            ))}
          </fieldset>
        </section>
      )}
    </div>
  )
}
