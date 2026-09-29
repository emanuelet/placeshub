import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useDebounceValue } from 'usehooks-ts'
import { toSavePlaceInput, useSavedPlaces, useSavePlace, useSearchPlaces } from '@/hooks/usePlaces'
import { useAuth } from '@/lib/auth'
import { type MapPlace, toMapPlace, useMapManager } from '@/lib/mapContext'

export const Route = createFileRoute('/dashboard')({
  component: Dashboard,
})

function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const { data, isLoading, error } = useSavedPlaces(!!user)
  const savePlace = useSavePlace()
  const { setPlaces, setOnPlaceClick, flyTo } = useMapManager()
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebounceValue(searchQuery, 300)
  const [showSaveForm, setShowSaveForm] = useState(false)
  const { data: searchData, isLoading: isSearching } = useSearchPlaces(debouncedQuery)

  const savedPlaces = (data?.savedPlaces ?? []).filter(
    (sp) => sp.directlySaved !== false || (sp.syncedCollectionIds?.length ?? 0) > 0,
  )
  const selectedDetails = savedPlaces.find((sp) => sp.place.id === selectedPlace?.id)?.place
  const searchResults = searchData?.places ?? []

  useEffect(() => {
    const mapPlaces: MapPlace[] = (data?.savedPlaces ?? [])
      .filter((sp) => sp.directlySaved !== false || (sp.syncedCollectionIds?.length ?? 0) > 0)
      .flatMap((sp) => {
        const place = toMapPlace(sp.place, sp.notes)
        return place ? [place] : []
      })
    setPlaces(mapPlaces)
    setOnPlaceClick((place) => {
      setSelectedPlace(place)
      flyTo(place.lat, place.lng)
    })
  }, [data, setPlaces, setOnPlaceClick, flyTo])

  if (authLoading) return <div>Loading...</div>

  if (!user) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Sign in to view your places</h1>
        <Link to="/auth/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </div>
    )
  }

  const handleSelectSearchResult = async (place: (typeof searchResults)[number]) => {
    await savePlace.mutateAsync(toSavePlaceInput(place))
    setSearchQuery('')
    setShowSaveForm(false)
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (error) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Couldn't load your places</h1>
        <p className="text-muted-foreground">{error.message}</p>
      </div>
    )
  }

  return (
    <div className="ui-panel flex h-full flex-col gap-4 overflow-y-auto p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold tracking-tight">Saved Places ({savedPlaces.length})</h2>
        <button
          type="button"
          onClick={() => setShowSaveForm(!showSaveForm)}
          className="ui-button ui-button-quiet min-h-9 px-2"
        >
          {showSaveForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showSaveForm && (
        <div className="space-y-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for a place..."
            className="ui-input"
          />
          {isSearching && <p className="text-xs text-muted-foreground">Searching...</p>}
          {savePlace.isError && <p className="ui-alert-error text-xs">{savePlace.error.message}</p>}
          {searchResults.length > 0 && (
            <div className="max-h-64 divide-y overflow-y-auto rounded-control border bg-surface">
              {searchResults.map((place) => (
                <button
                  key={place.googlePlaceId}
                  type="button"
                  disabled={savePlace.isPending}
                  onClick={() => handleSelectSearchResult(place)}
                  className="w-full p-3 text-left transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <p className="font-medium text-sm">{place.name}</p>
                  {place.address && (
                    <p className="text-xs text-muted-foreground">{place.address}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {savedPlaces.length === 0 && !showSaveForm && (
        <p className="ui-empty-state">No places saved yet.</p>
      )}

      {selectedDetails && (
        <div className="rounded-control border bg-surface p-3 text-sm space-y-1">
          {selectedDetails.phone && <p>Phone: {selectedDetails.phone}</p>}
          {selectedDetails.website && (
            <a
              className="font-semibold text-primary hover:underline"
              href={selectedDetails.website}
              target="_blank"
              rel="noreferrer"
            >
              Website ↗
            </a>
          )}
          {selectedDetails.metadata?.hours?.map((day) => (
            <p key={day.day}>
              {day.day}: {day.hours}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {savedPlaces.map((sp) => (
          <button
            key={sp.id}
            type="button"
            onClick={() => {
              const place = toMapPlace(sp.place, sp.notes)
              if (!place) return
              setSelectedPlace(place)
              flyTo(place.lat, place.lng)
            }}
            className={`w-full rounded-control border bg-surface p-3 text-left transition-colors hover:bg-muted ${
              selectedPlace?.id === sp.place.id ? 'border-primary bg-muted' : ''
            }`}
          >
            <p className="font-medium text-sm">{sp.place.name}</p>
            {sp.place.address && (
              <p className="text-xs text-muted-foreground mt-1">{sp.place.address}</p>
            )}
            {sp.place.rating != null && (
              <p className="text-xs text-muted-foreground mt-1">
                ★ {sp.place.rating}
                {sp.place.metadata?.reviewCount != null
                  ? ` (${sp.place.metadata.reviewCount} reviews)`
                  : ''}
              </p>
            )}
            {sp.notes && <p className="text-xs text-muted-foreground mt-1 italic">{sp.notes}</p>}
          </button>
        ))}
      </div>
    </div>
  )
}
