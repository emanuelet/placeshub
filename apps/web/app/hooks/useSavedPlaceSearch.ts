import { useState } from 'react'
import { useDebounceValue } from 'usehooks-ts'
import { type SavedSearchParams, useSavedLocations, useSavedSearch } from './useSavedSearch'

export function useSavedPlaceSearch(collectionId?: string, enabled = true) {
  const [query, setQuery] = useState('')
  const [debouncedQuery] = useDebounceValue(query, 300)
  const [selectedLocation, setSelectedLocation] = useState<{
    type: 'city' | 'address'
    value: string
  } | null>(null)
  const [filters, setFilters] = useState<SavedSearchParams>({ sortBy: 'name', sortDir: 'asc' })
  const scope = collectionId ?? filters.collectionId
  const params: SavedSearchParams = {
    ...filters,
    collectionId: scope,
    q: selectedLocation ? undefined : debouncedQuery,
    locationType: selectedLocation?.type,
    locationValue: selectedLocation?.value,
  }

  const search = useSavedSearch(params, enabled)
  const locations = useSavedLocations(debouncedQuery, scope, enabled && !selectedLocation)

  return {
    hasCriteria: !!(
      query ||
      filters.collectionId ||
      filters.city ||
      filters.country ||
      filters.category ||
      filters.tag ||
      filters.minRating
    ),
    query,
    setQuery: (value: string) => {
      setQuery(value)
      setSelectedLocation(null)
    },
    selectedLocation,
    selectLocation: (location: { type: 'city' | 'address'; value: string }) => {
      setQuery(location.value)
      setSelectedLocation(location)
    },
    filters,
    setFilters,
    search,
    locations: locations.data?.locations ?? [],
  }
}
