import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useSavedPlaces, useSavePlace } from '@/hooks/usePlaces'
import { useAuth } from '@/lib/auth'
import { type MapPlace, useMapManager } from '@/lib/mapContext'

export const Route = createFileRoute('/dashboard')({
  component: Dashboard,
})

function Dashboard() {
  const { user } = useAuth()
  const { data, isLoading } = useSavedPlaces()
  const savePlace = useSavePlace()
  const { setPlaces, setOnPlaceClick, flyTo } = useMapManager()
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSaveForm, setShowSaveForm] = useState(false)

  const savedPlaces = data?.savedPlaces ?? []

  useEffect(() => {
    const mapPlaces: MapPlace[] = (data?.savedPlaces ?? []).map((sp) => ({
      id: sp.place.id,
      name: sp.place.name,
      lat: sp.place.lat ?? 0,
      lng: sp.place.lng ?? 0,
      address: sp.place.address ?? undefined,
      rating: sp.place.rating ?? undefined,
      notes: sp.notes ?? undefined,
    }))
    setPlaces(mapPlaces)
    setOnPlaceClick((place) => {
      setSelectedPlace(place)
      flyTo(place.lat, place.lng)
    })
  }, [data, setPlaces, setOnPlaceClick, flyTo])

  if (!user) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Sign in to view your places</h1>
        <a href="/auth/login" className="text-blue-600 hover:underline">
          Sign in
        </a>
      </div>
    )
  }

  const handleSavePlace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery) return

    await savePlace.mutateAsync({
      googlePlaceId: `manual-${Date.now()}`,
      name: searchQuery,
      lat: 51.5074,
      lng: -0.1276,
      address: 'London, UK',
      googleMapsUri: `https://maps.google.com/?q=${encodeURIComponent(searchQuery)}`,
    })
    setSearchQuery('')
    setShowSaveForm(false)
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className="border rounded-lg p-4 overflow-y-auto flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Saved Places ({savedPlaces.length})</h2>
        <button
          onClick={() => setShowSaveForm(!showSaveForm)}
          className="text-sm text-blue-600 hover:underline"
        >
          {showSaveForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showSaveForm && (
        <form onSubmit={handleSavePlace} className="space-y-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Place name..."
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={savePlace.isPending}
            className="w-full bg-blue-600 text-white rounded px-3 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {savePlace.isPending ? 'Saving...' : 'Save place'}
          </button>
        </form>
      )}

      {savedPlaces.length === 0 && !showSaveForm && (
        <p className="text-sm text-muted-foreground">No places saved yet.</p>
      )}

      <div className="space-y-2">
        {savedPlaces.map((sp) => (
          <button
            key={sp.id}
            onClick={() => {
              const place: MapPlace = {
                id: sp.place.id,
                name: sp.place.name,
                lat: sp.place.lat ?? 0,
                lng: sp.place.lng ?? 0,
                address: sp.place.address ?? undefined,
                rating: sp.place.rating ?? undefined,
                notes: sp.notes ?? undefined,
              }
              setSelectedPlace(place)
              flyTo(place.lat, place.lng)
            }}
            className={`w-full text-left border rounded p-3 hover:bg-muted transition-colors ${
              selectedPlace?.id === sp.place.id ? 'bg-muted border-blue-300' : ''
            }`}
          >
            <p className="font-medium text-sm">{sp.place.name}</p>
            {sp.place.address && (
              <p className="text-xs text-muted-foreground mt-1">{sp.place.address}</p>
            )}
            {sp.notes && <p className="text-xs text-muted-foreground mt-1 italic">{sp.notes}</p>}
          </button>
        ))}
      </div>
    </div>
  )
}
