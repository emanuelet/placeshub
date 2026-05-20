import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useCollection, useRemovePlaceFromCollection } from '@/hooks/useCollections'
import { useCreateShare } from '@/hooks/useShares'
import { type MapPlace, useMapManager } from '@/lib/mapContext'

export const Route = createFileRoute('/collections/$collectionId')({
  component: CollectionDetail,
})

function CollectionDetail() {
  const { collectionId } = Route.useParams()
  const { data, isLoading } = useCollection(collectionId)
  const removePlace = useRemovePlaceFromCollection()
  const createShare = useCreateShare()
  const { setPlaces, setOnPlaceClick, flyTo } = useMapManager()
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const collection = data?.collection
  const collectionPlaces = data?.places ?? []

  useEffect(() => {
    const mapPlaces: MapPlace[] = (data?.places ?? []).map((cp) => ({
      id: cp.place.id,
      name: cp.place.name,
      lat: cp.place.lat ?? 0,
      lng: cp.place.lng ?? 0,
      address: cp.place.address ?? undefined,
      rating: cp.place.rating ?? undefined,
    }))
    setPlaces(mapPlaces)
    setOnPlaceClick((place) => flyTo(place.lat, place.lng))
  }, [data, setPlaces, setOnPlaceClick, flyTo])

  const handleShare = async () => {
    const { share } = await createShare.mutateAsync({ collectionId })
    setShareUrl(`${window.location.origin}/share/${share.slug}`)
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!collection) {
    return <div className="text-center">Collection not found</div>
  }

  return (
    <div className="border rounded-lg p-4 overflow-y-auto flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">{collection.title}</h2>
          {collection.description && (
            <p className="text-sm text-muted-foreground">{collection.description}</p>
          )}
        </div>
        <button
          onClick={handleShare}
          disabled={createShare.isPending}
          className="border rounded px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          {createShare.isPending ? 'Sharing...' : 'Share'}
        </button>
      </div>

      {shareUrl && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm">
          <p className="font-medium mb-1">Share link created:</p>
          <a href={shareUrl} className="text-blue-600 hover:underline break-all">
            {shareUrl}
          </a>
        </div>
      )}

      <h3 className="font-semibold">Places ({collectionPlaces.length})</h3>
      {collectionPlaces.length === 0 && (
        <p className="text-sm text-muted-foreground">No places in this collection.</p>
      )}
      <div className="space-y-2">
        {collectionPlaces.map((cp) => (
          <div key={cp.place.id} className="border rounded p-3 hover:bg-muted transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm">{cp.place.name}</p>
                {cp.place.address && (
                  <p className="text-xs text-muted-foreground mt-1">{cp.place.address}</p>
                )}
              </div>
              <button
                onClick={() => removePlace.mutate({ collectionId, placeId: cp.place.id })}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
