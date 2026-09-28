import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useShare } from '@/hooks/useShares'
import { type MapPlace, useMapManager } from '@/lib/mapContext'

export const Route = createFileRoute('/share/$slug')({
  component: SharedView,
})

function SharedView() {
  const { slug } = Route.useParams()
  const { data, isLoading, error } = useShare(slug)
  const { setPlaces, setOnPlaceClick, flyTo } = useMapManager()

  useEffect(() => {
    if (!data?.share) {
      setPlaces([])
      setOnPlaceClick(null)
      return
    }
    const placesSnapshot = data.share.placesSnapshot as Array<{
      id: string
      name: string
      lat: number
      lng: number
      address?: string
      rating?: number
      notes?: string
    }>
    const mapPlaces: MapPlace[] = placesSnapshot.flatMap((p) =>
      Number.isFinite(p.lat) && Number.isFinite(p.lng)
        ? [
            {
              id: p.id,
              name: p.name,
              lat: p.lat,
              lng: p.lng,
              address: p.address,
              rating: p.rating,
              notes: p.notes,
            },
          ]
        : [],
    )
    setPlaces(mapPlaces)
    setOnPlaceClick(null)
  }, [data, setPlaces, setOnPlaceClick])

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (error) {
    const unavailable = error.message === 'share not found' || error.message === 'share expired'
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">
          {error.message === 'share expired'
            ? 'Share expired'
            : unavailable
              ? 'Share not found'
              : "Couldn't load this share"}
        </h1>
        <p className="text-muted-foreground">
          {unavailable ? 'Ask the owner for a new link.' : error.message}
        </p>
      </div>
    )
  }

  if (!data?.share) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Share not found</h1>
        <p className="text-muted-foreground">This share link may have expired.</p>
      </div>
    )
  }

  const share = data.share
  const placesSnapshot = share.placesSnapshot as Array<{
    id: string
    name: string
    lat: number
    lng: number
    address?: string
    rating?: number
    notes?: string
    googleMapsUri?: string
  }>

  return (
    <div className="ui-panel flex h-full flex-col gap-4 overflow-y-auto p-4 sm:p-5">
      <h2 className="text-base font-bold tracking-tight">Places ({placesSnapshot.length})</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {placesSnapshot.map((p) => (
          <div key={p.id} className="rounded-control border bg-surface p-3">
            <p className="font-medium text-sm break-words">{p.name}</p>
            {p.address && <p className="text-xs text-muted-foreground break-words">{p.address}</p>}
            {p.notes && (
              <p className="text-xs text-muted-foreground mt-1 italic whitespace-pre-wrap break-words">
                {p.notes}
              </p>
            )}
            {Number.isFinite(p.lat) && Number.isFinite(p.lng) && (
              <button
                type="button"
                onClick={() => flyTo(p.lat, p.lng)}
                className="mt-2 text-xs font-semibold text-primary hover:underline"
              >
                Show on map
              </button>
            )}
            {p.googleMapsUri && (
              <a
                href={p.googleMapsUri}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 ml-3 inline-block text-xs font-semibold text-primary hover:underline"
              >
                View on Google Maps
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
