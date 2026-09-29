import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'

export const Route = createFileRoute('/sync')({ component: SyncPage })

interface Connection {
  id: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

interface SyncedList {
  title: string
  sourceListId: string
  lastSyncedAt: string | null
}

function SyncPage() {
  const { user, loading: authLoading } = useAuth()
  const [connections, setConnections] = useState<Connection[]>([])
  const [lists, setLists] = useState<SyncedList[]>([])
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const result = await api.get<{ connections: Connection[]; lists: SyncedList[] }>(
      '/sync/connections',
    )
    setConnections(result.connections)
    setLists(result.lists)
  }, [])

  const userId = user?.id
  useEffect(() => {
    if (userId) refresh().catch((e) => setError(e.message))
  }, [userId, refresh])

  if (authLoading) return <p className="text-muted-foreground">Loading...</p>

  if (!user)
    return (
      <div className="ui-panel p-5">
        <p>
          <Link to="/auth/login" className="font-semibold text-primary underline">
            Sign in
          </Link>{' '}
          to connect Google Maps.
        </p>
      </div>
    )

  const createKey = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await api.post<{ token: string }>('/sync/connections', {})
      setToken(result.token)
      setCopied(false)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      await api.delete(`/sync/connections/${id}`)
      setToken(null)
      setCopied(false)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const refreshStatus = async () => {
    setBusy(true)
    setError(null)
    try {
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const copyKey = async () => {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
    } catch {
      setError('Could not copy automatically. Select the key above to copy it.')
    }
  }

  return (
    <div className="ui-panel space-y-5 p-5">
      <h1 className="ui-page-title">Google Maps sync</h1>
      <p>
        Install the PlacesHub Chrome extension from <code>apps/extension</code> (Load unpacked in
        chrome://extensions). Sign in to Google Maps, open Saved, a list and a place in it, then
        sync from the extension popup.
      </p>
      <p>
        Google lists sync one way to PlacesHub each hour while Chrome runs. Removing a place from a
        Google list removes its collection membership. Direct PlacesHub saves and the place cache
        remain.
      </p>
      <div>
        <button
          type="button"
          className="ui-button ui-button-primary"
          disabled={busy}
          onClick={createKey}
        >
          Create extension key
        </button>
        {token && (
          <div className="mt-3 space-y-2">
            <p>Copy this key into the extension popup. It is shown only once.</p>
            <textarea
              className="ui-input w-full"
              readOnly
              value={token}
              aria-label="Extension key"
              rows={2}
            />
            <button type="button" className="ui-button ui-button-secondary" onClick={copyKey}>
              {copied ? 'Copied' : 'Copy key'}
            </button>
            <p>
              PlacesHub address: <code>{window.location.origin}</code>
            </p>
          </div>
        )}
      </div>
      {error && <p className="ui-alert-error">{error}</p>}
      <section>
        <h2 className="ui-section-title">Extension keys</h2>
        {connections
          .filter((c) => !c.revokedAt)
          .map((connection) => (
            <div key={connection.id} className="ui-list-row">
              <span>
                Created {new Date(connection.createdAt).toLocaleString()} · Last used{' '}
                {connection.lastUsedAt ? new Date(connection.lastUsedAt).toLocaleString() : 'never'}
              </span>
              <button
                type="button"
                className="ui-button ui-button-danger"
                disabled={busy}
                onClick={() => revoke(connection.id)}
              >
                Revoke
              </button>
            </div>
          ))}
      </section>
      <section>
        <div className="flex items-center justify-between gap-2">
          <h2 className="ui-section-title">Synced lists</h2>
          <button
            type="button"
            className="ui-button ui-button-quiet"
            disabled={busy}
            onClick={refreshStatus}
          >
            Refresh status
          </button>
        </div>
        {lists.length === 0 && <div className="ui-empty-state">No lists synced yet.</div>}
        {lists.map((list) => (
          <p key={list.sourceListId} className="ui-list-row">
            <span className="font-medium">{list.title}</span>
            <span className="text-muted-foreground">
              Last synced{' '}
              {list.lastSyncedAt ? new Date(list.lastSyncedAt).toLocaleString() : 'never'}
            </span>
          </p>
        ))}
      </section>
    </div>
  )
}
