import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Ellipsis, Pencil, Plus, Share2, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AddPlaceForm } from '@/components/AddPlaceForm'
import { PlaceDetails } from '@/components/PlaceDetails'
import {
  useBulkRemovePlacesFromCollection,
  useCollection,
  useDeleteCollection,
  useRemovePlaceFromCollection,
  useUpdateCollection,
} from '@/hooks/useCollections'
import { useCreateShare } from '@/hooks/useShares'
import { useAuth } from '@/lib/auth'
import { type MapPlace, toMapPlace, useMapManager } from '@/lib/mapContext'

export const Route = createFileRoute('/collections/$collectionId')({ component: CollectionDetail })

function CollectionDetail() {
  const { collectionId } = Route.useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { data, isLoading, error } = useCollection(collectionId, !!user)
  const removePlace = useRemovePlaceFromCollection()
  const bulkRemove = useBulkRemovePlacesFromCollection()
  const updateCollection = useUpdateCollection()
  const deleteCollection = useDeleteCollection()
  const createShare = useCreateShare()
  const { setPlaces, setOnPlaceClick, setSelectedPlaceId, flyTo } = useMapManager()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checkedIds, setCheckedIds] = useState<string[]>([])
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionsOpen, setActionsOpen] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  const collection = data?.collection
  const collectionPlaces = data?.places ?? []
  const selected = collectionPlaces.find((cp) => cp.place.id === selectedId)

  useEffect(() => {
    const mapPlaces: MapPlace[] = (data?.places ?? []).flatMap((cp) => {
      const place = toMapPlace(cp.place)
      return place ? [place] : []
    })
    setPlaces(mapPlaces)
    setOnPlaceClick((place) => {
      setSelectedId(place.id)
      setSelectedPlaceId(place.id)
      flyTo(place.lat, place.lng)
    })
    return () => {
      setOnPlaceClick(null)
    }
  }, [data, setPlaces, setOnPlaceClick, setSelectedPlaceId, flyTo])

  useEffect(() => {
    setSelectedPlaceId(selectedId)
  }, [selectedId, setSelectedPlaceId])

  useEffect(() => () => setSelectedPlaceId(null), [setSelectedPlaceId])

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus()
  }, [editingTitle])

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !actionsRef.current?.contains(event.target)) {
        setActionsOpen(false)
      }
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])

  const handleShare = async () => {
    const { share } = await createShare.mutateAsync({ collectionId })
    setShareUrl(`${window.location.origin}/share/${share.slug}`)
  }

  const handleActionsKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setActionsOpen(false)
      actionsRef.current?.querySelector('button')?.focus()
    }
  }

  if (authLoading) return <div>Loading...</div>
  if (!user)
    return (
      <div className="text-center">
        Sign in to view this collection.{' '}
        <Link to="/auth/login" className="text-primary underline">
          Sign in
        </Link>
      </div>
    )
  if (isLoading) return <div>Loading...</div>
  if (error)
    return <div className="ui-alert-error">Couldn't load this collection: {error.message}</div>
  if (!collection) return <div className="text-center">Collection not found</div>

  const manual = !collection.syncedFromGoogle
  const allChecked =
    collectionPlaces.length > 0 && collectionPlaces.every((cp) => checkedIds.includes(cp.place.id))

  return (
    <div className={`grid min-h-0 gap-3 lg:h-full ${selected ? 'min-[1280px]:grid-cols-2' : ''}`}>
      <section
        className="ui-panel flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto p-4 sm:p-5"
        aria-label="Collection places"
      >
        <div className="space-y-3">
          {editingTitle && manual ? (
            <form
              className="space-y-2"
              onSubmit={async (event) => {
                event.preventDefault()
                if (!title.trim()) {
                  setActionError('Enter a collection name.')
                  return
                }
                setActionError('')
                try {
                  await updateCollection.mutateAsync({ id: collectionId, title: title.trim() })
                  setEditingTitle(false)
                } catch (reason) {
                  setActionError(
                    reason instanceof Error ? reason.message : "Couldn't rename collection",
                  )
                }
              }}
            >
              <label htmlFor="edit-collection-title" className="ui-field-label">
                Collection title
              </label>
              <input
                ref={titleRef}
                id="edit-collection-title"
                className="ui-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="ui-button ui-button-primary"
                  disabled={updateCollection.isPending}
                >
                  Save title
                </button>
                <button
                  type="button"
                  className="ui-button ui-button-secondary"
                  onClick={() => setEditingTitle(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-32 flex-1">
                <h2 className="break-words text-lg font-bold tracking-tight">{collection.title}</h2>
                {collection.description && (
                  <p className="break-words text-sm text-muted-foreground">
                    {collection.description}
                  </p>
                )}
                {collection.syncedFromGoogle && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Synced from Google Maps. Remove places there; they update here on the next sync.
                  </p>
                )}
              </div>
              {manual && (
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="ui-button ui-button-primary gap-1 px-2"
                    onClick={() => setShowAddForm(true)}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" /> Add place
                  </button>
                  <div ref={actionsRef} className="relative">
                    <button
                      type="button"
                      className="ui-button ui-button-secondary px-2"
                      aria-label="Collection actions"
                      aria-expanded={actionsOpen}
                      aria-controls="collection-actions-menu"
                      onClick={() => setActionsOpen((open) => !open)}
                      onKeyDown={handleActionsKeyDown}
                    >
                      <Ellipsis className="h-5 w-5" aria-hidden="true" />
                    </button>
                    {actionsOpen && (
                      <fieldset
                        id="collection-actions-menu"
                        className="ui-panel absolute right-0 z-30 mt-1 min-w-44 overflow-hidden p-1"
                      >
                        <legend className="sr-only">Collection actions menu</legend>
                        <button
                          type="button"
                          className="ui-button ui-button-quiet w-full justify-start gap-2"
                          onKeyDown={handleActionsKeyDown}
                          onClick={() => {
                            setActionsOpen(false)
                            setTitle(collection.title)
                            setEditingTitle(true)
                          }}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" /> Rename
                        </button>
                        <button
                          type="button"
                          className="ui-button ui-button-danger w-full justify-start gap-2"
                          disabled={deleteCollection.isPending}
                          onKeyDown={handleActionsKeyDown}
                          onClick={async () => {
                            setActionsOpen(false)
                            if (
                              !window.confirm(
                                `Delete “${collection.title}”? This also invalidates its share links. Saved places remain available.`,
                              )
                            )
                              return
                            setActionError('')
                            try {
                              await deleteCollection.mutateAsync(collectionId)
                              await navigate({ to: '/collections' })
                            } catch (reason) {
                              setActionError(
                                reason instanceof Error
                                  ? reason.message
                                  : "Couldn't delete collection",
                              )
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete collection
                        </button>
                      </fieldset>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                handleShare().catch(() => {})
              }}
              disabled={createShare.isPending}
              className="ui-button ui-button-secondary gap-1"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              {createShare.isPending ? 'Sharing...' : 'Share snapshot'}
            </button>
          </div>
        </div>

        {showAddForm && manual && (
          <AddPlaceForm
            collectionId={collectionId}
            onAdded={(id) => {
              setSelectedId(id)
              setSelectedPlaceId(id)
              setShowAddForm(false)
            }}
            onCancel={() => setShowAddForm(false)}
          />
        )}
        {shareUrl && (
          <div className="ui-alert-success">
            <p className="font-medium">Share link created:</p>
            <a href={shareUrl} className="break-all text-primary underline">
              {shareUrl}
            </a>
            <p className="text-xs">This snapshot does not update when the collection changes.</p>
          </div>
        )}
        {createShare.isError && (
          <p role="alert" className="ui-alert-error">
            {createShare.error.message}
          </p>
        )}
        {(actionError || removePlace.error || bulkRemove.error) && (
          <p role="alert" className="ui-alert-error">
            {actionError || removePlace.error?.message || bulkRemove.error?.message}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Places ({collectionPlaces.length})</h3>
          {manual && checkedIds.length > 0 && (
            <button
              type="button"
              className="ui-button ui-button-danger gap-1"
              disabled={bulkRemove.isPending}
              onClick={async () => {
                if (
                  !window.confirm(
                    `Remove ${checkedIds.length} places from “${collection.title}”? Saved places will remain available.`,
                  )
                )
                  return
                setActionError('')
                try {
                  for (let offset = 0; offset < checkedIds.length; offset += 100) {
                    await bulkRemove.mutateAsync({
                      collectionId,
                      placeIds: checkedIds.slice(offset, offset + 100),
                    })
                  }
                  if (selectedId && checkedIds.includes(selectedId)) {
                    setSelectedId(null)
                    setSelectedPlaceId(null)
                  }
                  setCheckedIds([])
                } catch (reason) {
                  setActionError(
                    reason instanceof Error ? reason.message : "Couldn't remove places",
                  )
                }
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove selected ({checkedIds.length}
              )
            </button>
          )}
        </div>
        {manual && collectionPlaces.length > 0 && (
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(event) =>
                setCheckedIds(event.target.checked ? collectionPlaces.map((cp) => cp.place.id) : [])
              }
            />
            Select all
          </label>
        )}
        {collectionPlaces.length === 0 && (
          <p className="ui-empty-state">No places in this collection.</p>
        )}
        <div className="space-y-2">
          {collectionPlaces.map((cp) => (
            <div
              key={cp.place.id}
              className={`flex w-full min-w-0 items-start gap-2 rounded-control border bg-surface p-3 ${selectedId === cp.place.id ? 'border-primary bg-muted' : ''}`}
            >
              {manual && (
                <input
                  type="checkbox"
                  className="mt-2 shrink-0"
                  aria-label={`Select ${cp.place.name}`}
                  checked={checkedIds.includes(cp.place.id)}
                  onChange={(event) =>
                    setCheckedIds((previous) =>
                      event.target.checked
                        ? [...previous, cp.place.id]
                        : previous.filter((id) => id !== cp.place.id),
                    )
                  }
                />
              )}
              <button
                type="button"
                className="min-w-0 flex-1 py-1 text-left"
                aria-pressed={selectedId === cp.place.id}
                onClick={() => {
                  setSelectedId(cp.place.id)
                  setSelectedPlaceId(cp.place.id)
                  const mapPlace = toMapPlace(cp.place)
                  if (mapPlace) flyTo(mapPlace.lat, mapPlace.lng)
                }}
              >
                <span className="block break-words text-sm font-medium">{cp.place.name}</span>
                {cp.place.address && (
                  <span className="mt-1 block break-words text-xs text-muted-foreground">
                    {cp.place.address}
                  </span>
                )}
                {cp.notes && (
                  <span className="mt-1 block break-words text-xs italic text-muted-foreground">
                    {cp.notes}
                  </span>
                )}
              </button>
              {manual && (
                <button
                  type="button"
                  onClick={async () => {
                    setActionError('')
                    try {
                      await removePlace.mutateAsync({ collectionId, placeId: cp.place.id })
                      setCheckedIds((ids) => ids.filter((id) => id !== cp.place.id))
                      if (selectedId === cp.place.id) {
                        setSelectedId(null)
                        setSelectedPlaceId(null)
                      }
                    } catch (reason) {
                      setActionError(
                        reason instanceof Error ? reason.message : "Couldn't remove place",
                      )
                    }
                  }}
                  disabled={removePlace.isPending}
                  className="ui-button ui-button-danger shrink-0 gap-1 px-2 text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      {selected && (
        <PlaceDetails
          place={selected.place}
          importedNotes={selected.notes}
          personalNotes={selected.personalNotes}
          savedPlaceId={selected.savedPlaceId}
          onClose={() => {
            setSelectedId(null)
            setSelectedPlaceId(null)
          }}
        />
      )}
    </div>
  )
}
