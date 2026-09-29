import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Place {
  id: string
  googlePlaceId: string
  name: string
  lat: number | null
  lng: number | null
  address: string | null
  googleMapsUri: string | null
  types: string[] | null
  phone: string | null
  website: string | null
  rating: number | null
  metadata?: {
    reviewCount?: number | null
    category?: string[]
    hours?: { day: string; hours: string }[] | null
    imageUrl?: string | null
    plusCode?: string | null
    city?: string | null
    country?: string | null
  } | null
}

export interface SavedPlace {
  id: string
  notes: string | null
  directlySaved: boolean
  syncedCollectionIds: string[]
  tags: string[] | null
  createdAt: string
  place: Place
}

export function toSavePlaceInput(place: Place) {
  return {
    googlePlaceId: place.googlePlaceId,
    name: place.name,
    lat: place.lat ?? undefined,
    lng: place.lng ?? undefined,
    address: place.address ?? undefined,
    googleMapsUri: place.googleMapsUri ?? undefined,
    types: place.types ?? undefined,
    phone: place.phone ?? undefined,
    website: place.website ?? undefined,
    rating: place.rating ?? undefined,
  }
}

export function useSavedPlaces(enabled = true) {
  return useQuery({
    queryKey: ['savedPlaces'],
    queryFn: () => api.get<{ savedPlaces: SavedPlace[] }>('/places'),
    enabled,
  })
}

export function useSearchPlaces(query: string) {
  return useQuery({
    queryKey: ['searchPlaces', query],
    queryFn: () => api.get<{ places: Place[] }>(`/places/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
  })
}

export function useSavePlace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      googlePlaceId: string
      name: string
      lat?: number
      lng?: number
      address?: string
      googleMapsUri?: string
      types?: string[]
      phone?: string
      website?: string
      rating?: number
      notes?: string
      tags?: string[]
    }) => api.post<{ savedPlace: SavedPlace }>('/places', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedPlaces'] })
    },
  })
}

export function useUpdateSavedPlace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; notes?: string; tags?: string[] }) =>
      api.patch<{ savedPlace: SavedPlace }>(`/places/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedPlaces'] })
    },
  })
}

export function useDeleteSavedPlace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/places/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedPlaces'] })
    },
  })
}
