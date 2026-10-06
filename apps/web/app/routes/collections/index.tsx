import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ImportMyMapsDialog } from '@/components/ImportMyMapsDialog'
import { useCollections, useCreateCollection } from '@/hooks/useCollections'
import { useAuth } from '@/lib/auth'
import { useMapManager } from '@/lib/mapContext'

export const Route = createFileRoute('/collections/')({
  component: Collections,
})

function Collections() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { data, isLoading, error } = useCollections(!!user)
  const { setPlaces, setOnPlaceClick, setSelectedPlaceId } = useMapManager()
  const createCollection = useCreateCollection()
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    setPlaces([])
    setOnPlaceClick(null)
    setSelectedPlaceId(null)
  }, [setPlaces, setOnPlaceClick, setSelectedPlaceId])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !showForm) return
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close()
    }
  }, [showForm])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setFormError('Enter a collection name.')
      return
    }
    setFormError('')
    try {
      const { collection } = await createCollection.mutateAsync({
        title: trimmedTitle,
        description: description.trim() || undefined,
      })
      navigate({ to: '/collections/$collectionId', params: { collectionId: collection.id } })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't create collection")
    }
  }

  if (authLoading) return <div>Loading...</div>

  if (!user) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Sign in to view your collections</h1>
        <Link to="/auth/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </div>
    )
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-[calc(100vh-80px)]">Loading...</div>
  }

  if (error) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Couldn't load collections</h1>
        <p className="text-muted-foreground">{error.message}</p>
      </div>
    )
  }

  const collections = data?.collections ?? []

  return (
    <div className="min-w-0">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="ui-page-title">Collections</h1>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="ui-button ui-button-secondary gap-1"
          >
            <Upload className="h-4 w-4" aria-hidden="true" /> Import map
          </button>
          <button
            type="button"
            onClick={() => {
              setShowForm(true)
              setFormError('')
            }}
            className="ui-button ui-button-primary gap-1"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> New Collection
          </button>
        </div>
      </div>

      {showImport && (
        <ImportMyMapsDialog
          onCancel={() => setShowImport(false)}
          onImported={(id) =>
            navigate({ to: '/collections/$collectionId', params: { collectionId: id } })
          }
        />
      )}

      {showForm && (
        <dialog
          ref={dialogRef}
          onCancel={() => setShowForm(false)}
          aria-labelledby="create-collection-heading"
          className="ui-panel fixed inset-0 m-auto w-[min(32rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 text-foreground backdrop:bg-black/60"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 id="create-collection-heading" className="ui-section-title">
              New collection
            </h2>
            {formError && (
              <p role="alert" className="ui-alert-error">
                {formError}
              </p>
            )}
            <div>
              <label htmlFor="collection-title" className="ui-field-label">
                Title
              </label>
              <input
                id="collection-title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setFormError('')
                }}
                className="ui-input"
                autoFocus
                required
              />
            </div>
            <div>
              <label htmlFor="collection-description" className="ui-field-label">
                Description
              </label>
              <textarea
                id="collection-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="ui-input resize-y"
                rows={2}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="ui-button ui-button-secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createCollection.isPending}
                className="ui-button ui-button-primary"
              >
                {createCollection.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </dialog>
      )}

      {collections.length === 0 && !showForm && (
        <p className="ui-empty-state">No collections yet. Create one to get started.</p>
      )}

      <div className="space-y-3">
        {collections.map((collection) => (
          <button
            key={collection.id}
            type="button"
            onClick={() =>
              navigate({
                to: '/collections/$collectionId',
                params: { collectionId: collection.id },
              })
            }
            className="ui-panel block w-full min-w-0 p-4 text-left transition-colors hover:bg-muted"
          >
            <span className="flex flex-wrap items-center justify-between gap-2">
              <strong className="break-words">{collection.title}</strong>
              {collection.syncedFromGoogle && <span className="ui-badge">Google Sync</span>}
            </span>
            {collection.description && (
              <p className="text-sm text-muted-foreground mt-1">{collection.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Created {new Date(collection.createdAt).toLocaleDateString()}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
