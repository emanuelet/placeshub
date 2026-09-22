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
  const { setPlaces, setOnPlaceClick } = useMapManager()

  useEffect(() => {
    if (!data?.share) return
    const placesSnapshot = data.share.placesSnapshot as Array<{
      id: string
      name: string
      lat: number
      lng: number
      address?: string
      rating?: number
      notes?: string
    }>
    const mapPlaces: MapPlace[] = placesSnapshot.map((p) => ({
      id: p.id,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      address: p.address,
      rating: p.rating,
      notes: p.notes,
    }))
    setPlaces(mapPlaces)
    setOnPlaceClick(null)
  }, [data, setPlaces, setOnPlaceClick])

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (error || !data?.share) {
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {placesSnapshot.map((p) => (
          <div key={p.id} className="rounded-control border bg-surface p-3">
            <p className="font-medium text-sm truncate">{p.name}</p>
            {p.address && <p className="text-xs text-muted-foreground truncate">{p.address}</p>}
            {p.notes && (
              <p className="text-xs text-muted-foreground mt-1 italic truncate">{p.notes}</p>
            )}
            {p.googleMapsUri && (
              <a
                href={p.googleMapsUri}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
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
