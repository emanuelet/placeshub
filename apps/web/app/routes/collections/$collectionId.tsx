import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useCollection, useRemovePlaceFromCollection } from '@/hooks/useCollections'
import { useCreateShare } from '@/hooks/useShares'
import { useAuth } from '@/lib/auth'
import { type MapPlace, toMapPlace, useMapManager } from '@/lib/mapContext'

export const Route = createFileRoute('/collections/$collectionId')({
  component: CollectionDetail,
})

function CollectionDetail() {
  const { collectionId } = Route.useParams()
  const { user, loading: authLoading } = useAuth()
  const { data, isLoading, error } = useCollection(collectionId, !!user)
  const removePlace = useRemovePlaceFromCollection()
  const createShare = useCreateShare()
  const { setPlaces, setOnPlaceClick, flyTo } = useMapManager()
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const collection = data?.collection
  const collectionPlaces = data?.places ?? []

  useEffect(() => {
    const mapPlaces: MapPlace[] = (data?.places ?? []).flatMap((cp) => {
      const place = toMapPlace(cp.place)
      return place ? [place] : []
    })
    setPlaces(mapPlaces)
    setOnPlaceClick((place) => flyTo(place.lat, place.lng))
  }, [data, setPlaces, setOnPlaceClick, flyTo])

  const handleShare = async () => {
    const { share } = await createShare.mutateAsync({ collectionId })
    setShareUrl(`${window.location.origin}/share/${share.slug}`)
  }

  if (authLoading) return <div>Loading...</div>

  if (!user) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Sign in to view this collection</h1>
        <Link to="/auth/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </div>
    )
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (error) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Couldn't load this collection</h1>
        <p className="text-muted-foreground">{error.message}</p>
      </div>
    )
  }

  if (!collection) {
    return <div className="text-center">Collection not found</div>
  }

  return (
    <div className="ui-panel flex h-full flex-col gap-4 overflow-y-auto p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold tracking-tight">{collection.title}</h2>
          {collection.description && (
            <p className="text-sm text-muted-foreground">{collection.description}</p>
          )}
          {collection.syncedFromGoogle && (
            <p className="text-xs text-muted-foreground mt-1">
              Synced from Google Maps. Remove places there; they update here on the next sync.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleShare}
          disabled={createShare.isPending}
          className="ui-button ui-button-secondary"
        >
          {createShare.isPending ? 'Sharing...' : 'Share snapshot'}
        </button>
      </div>

      {shareUrl && (
        <div className="ui-alert-success">
          <p className="font-medium mb-1">Share link created:</p>
          <a href={shareUrl} className="font-semibold text-primary hover:underline break-all">
            {shareUrl}
          </a>
          <p className="text-xs mt-1">This snapshot does not update when the collection changes.</p>
        </div>
      )}

      {createShare.isError && <p className="ui-alert-error">{createShare.error.message}</p>}

      {removePlace.isError && <p className="ui-alert-error">{removePlace.error.message}</p>}

      <h3 className="font-semibold">Places ({collectionPlaces.length})</h3>
      {collectionPlaces.length === 0 && (
        <p className="ui-empty-state">No places in this collection.</p>
      )}
      <div className="space-y-2">
        {collectionPlaces.map((cp) => (
          <div
            key={cp.place.id}
            className="rounded-control border bg-surface p-3 transition-colors hover:bg-muted"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm">{cp.place.name}</p>
                {cp.place.address && (
                  <p className="text-xs text-muted-foreground mt-1">{cp.place.address}</p>
                )}
                {cp.notes && (
                  <p className="text-xs text-muted-foreground mt-1 italic">{cp.notes}</p>
                )}
                {cp.place.rating != null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ★ {cp.place.rating}
                    {cp.place.metadata?.reviewCount != null
                      ? ` (${cp.place.metadata.reviewCount} reviews)`
                      : ''}
                  </p>
                )}
                {cp.place.phone && (
                  <p className="text-xs text-muted-foreground mt-1">{cp.place.phone}</p>
                )}
                {cp.place.website && (
                  <a
                    href={cp.place.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Website ↗
                  </a>
                )}
              </div>
              {!collection.syncedFromGoogle && (
                <button
                  type="button"
                  onClick={() => removePlace.mutate({ collectionId, placeId: cp.place.id })}
                  className="ui-button ui-button-danger min-h-8 px-2 text-xs"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
