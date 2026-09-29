import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AddPlaceForm } from '@/components/AddPlaceForm'
import { PlaceDetails } from '@/components/PlaceDetails'
import { SavedSearchControls } from '@/components/SavedSearchControls'
import { useCollections } from '@/hooks/useCollections'
import { useSavedPlaceSearch } from '@/hooks/useSavedPlaceSearch'
import { useAuth } from '@/lib/auth'
import { type MapPlace, toMapPlace, useMapManager } from '@/lib/mapContext'

export const Route = createFileRoute('/dashboard')({ component: Dashboard })

function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const savedSearch = useSavedPlaceSearch(undefined, !!user)
  const { data, isLoading, error } = savedSearch.search
  const { data: collectionsData } = useCollections(!!user)
  const { setPlaces, setOnPlaceClick, setSelectedPlaceId, flyTo } = useMapManager()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const savedPlaces = data?.places ?? []
  const selected = savedPlaces.find((sp) => sp.id === selectedId)

  useEffect(() => {
    const mapPlaces: MapPlace[] = (data?.places ?? []).flatMap((sp) => {
      const place = toMapPlace(sp, sp.notes)
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

  useEffect(() => {
    if (data && selectedId && !data.places.some((place) => place.id === selectedId)) {
      setSelectedId(null)
    }
  }, [data, selectedId])

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
        <SavedSearchControls
          query={savedSearch.query}
          onQueryChange={savedSearch.setQuery}
          onLocationSelect={savedSearch.selectLocation}
          selectedLocation={savedSearch.selectedLocation}
          locations={savedSearch.locations}
          filters={savedSearch.filters}
          onFiltersChange={savedSearch.setFilters}
          options={data?.filters}
          collections={collectionsData?.collections ?? []}
        />
        {isLoading && (
          <p role="status" className="text-xs text-muted-foreground">
            Searching saved places...
          </p>
        )}
        {!isLoading && savedSearch.search.isFetching && (
          <p role="status" className="text-xs text-muted-foreground">
            Updating results...
          </p>
        )}
        {error && (
          <p role="alert" className="ui-alert-error">
            Couldn't search saved places: {error.message}
          </p>
        )}
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
        {savedPlaces.length === 0 && !showAddForm && !isLoading && !error && (
          <p className="ui-empty-state">
            {savedSearch.hasCriteria
              ? 'No saved places match your search or filters.'
              : 'No places saved yet.'}
          </p>
        )}
        <div className="space-y-2">
          {savedPlaces.map((sp) => (
            <button
              key={sp.id}
              type="button"
              aria-pressed={selectedId === sp.id}
              onClick={() => {
                setSelectedId(sp.id)
                setSelectedPlaceId(sp.id)
                const place = toMapPlace(sp, sp.notes)
                if (place) flyTo(place.lat, place.lng)
              }}
              className={`w-full rounded-control border bg-surface p-3 text-left transition-colors hover:bg-muted ${selectedId === sp.id ? 'border-primary bg-muted' : ''}`}
            >
              <span className="block break-words text-sm font-medium">{sp.name}</span>
              {sp.address && (
                <span className="mt-1 block break-words text-xs text-muted-foreground">
                  {sp.address}
                </span>
              )}
              {sp.rating != null && (
                <span className="mt-1 block text-xs text-muted-foreground">★ {sp.rating}</span>
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
          place={selected}
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
