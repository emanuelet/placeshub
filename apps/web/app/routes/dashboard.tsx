import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AddPlaceForm } from '@/components/AddPlaceForm'
import { PlaceDetails } from '@/components/PlaceDetails'
import { useSavedPlaces } from '@/hooks/usePlaces'
import { useAuth } from '@/lib/auth'
import { type MapPlace, toMapPlace, useMapManager } from '@/lib/mapContext'

export const Route = createFileRoute('/dashboard')({ component: Dashboard })

function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const { data, isLoading, error } = useSavedPlaces(!!user)
  const { setPlaces, setOnPlaceClick, setSelectedPlaceId, flyTo } = useMapManager()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const savedPlaces = (data?.savedPlaces ?? []).filter(
    (sp) => sp.directlySaved !== false || (sp.syncedCollectionIds?.length ?? 0) > 0,
  )
  const selected = savedPlaces.find((sp) => sp.place.id === selectedId)

  useEffect(() => {
    const mapPlaces: MapPlace[] = (data?.savedPlaces ?? [])
      .filter((sp) => sp.directlySaved !== false || (sp.syncedCollectionIds?.length ?? 0) > 0)
      .flatMap((sp) => {
        const place = toMapPlace(sp.place, sp.notes)
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

  if (authLoading) return <div>Loading...</div>
  if (!user) {
    return (
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-bold">Sign in to view your places</h1>
        <Link to="/auth/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </div>
    )
  }
  if (isLoading) return <div>Loading...</div>
  if (error) return <div className="ui-alert-error">Couldn't load your places: {error.message}</div>

  return (
    <div className={`grid min-h-0 gap-3 lg:h-full ${selected ? 'min-[1280px]:grid-cols-2' : ''}`}>
      <section
        className="ui-panel flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto p-4 sm:p-5"
        aria-label="Saved places"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold tracking-tight">
            Saved Places ({savedPlaces.length})
          </h2>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="ui-button ui-button-quiet shrink-0 gap-1 px-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add place
          </button>
        </div>
        {showAddForm && (
          <AddPlaceForm
            onAdded={(placeId) => {
              setSelectedId(placeId)
              setSelectedPlaceId(placeId)
              setShowAddForm(false)
            }}
            onCancel={() => setShowAddForm(false)}
          />
        )}
        {savedPlaces.length === 0 && !showAddForm && (
          <p className="ui-empty-state">No places saved yet.</p>
        )}
        <div className="space-y-2">
          {savedPlaces.map((sp) => (
            <button
              key={sp.id}
              type="button"
              aria-pressed={selectedId === sp.place.id}
              onClick={() => {
                setSelectedId(sp.place.id)
                setSelectedPlaceId(sp.place.id)
                const place = toMapPlace(sp.place, sp.notes)
                if (place) flyTo(place.lat, place.lng)
              }}
              className={`w-full rounded-control border bg-surface p-3 text-left transition-colors hover:bg-muted ${selectedId === sp.place.id ? 'border-primary bg-muted' : ''}`}
            >
              <span className="block break-words text-sm font-medium">{sp.place.name}</span>
              {sp.place.address && (
                <span className="mt-1 block break-words text-xs text-muted-foreground">
                  {sp.place.address}
                </span>
              )}
              {sp.place.rating != null && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  ★ {sp.place.rating}
                </span>
              )}
              {sp.notes && (
                <span className="mt-1 block break-words text-xs italic text-muted-foreground">
                  {sp.notes}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>
      {selected && (
        <PlaceDetails
          place={selected.place}
          personalNotes={selected.notes}
          savedPlaceId={selected.id}
          onClose={() => {
            setSelectedId(null)
            setSelectedPlaceId(null)
          }}
        />
      )}
    </div>
  )
}
