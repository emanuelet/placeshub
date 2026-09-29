import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Place } from './usePlaces'

export interface SavedSearchPlace extends Place {
  notes: string | null
  personalNotes: string | null
  savedPlaceId: string | null
  tags: string[] | null
}

export interface SavedSearchParams {
  q?: string
  collectionId?: string
  locationType?: 'city' | 'address'
  locationValue?: string
  city?: string
  country?: string
  category?: string
  tag?: string
  minRating?: string
  sortBy?: 'name' | 'location'
  sortDir?: 'asc' | 'desc'
}

export interface SavedSearchResponse {
  places: SavedSearchPlace[]
  filters: { cities: string[]; countries: string[]; categories: string[]; tags: string[] }
}

function queryString(params: SavedSearchParams) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  return query.toString()
}

export function useSavedSearch(params: SavedSearchParams, enabled = true) {
  return useQuery({
    queryKey: ['savedSearch', params],
    queryFn: () => api.get<SavedSearchResponse>(`/saved/search?${queryString(params)}`),
    enabled,
  })
}

export function useSavedLocations(query: string, collectionId?: string, enabled = true) {
  return useQuery({
    queryKey: ['savedLocations', query, collectionId],
    queryFn: () =>
      api.get<{ locations: { type: 'city' | 'address'; value: string }[] }>(
        `/saved/locations?${queryString({ q: query, collectionId })}`,
      ),
    enabled: enabled && query.trim().length >= 2,
  })
}
