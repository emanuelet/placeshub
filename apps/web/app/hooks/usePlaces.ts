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
}

export interface SavedPlace {
  id: string
  notes: string | null
  tags: string[] | null
  createdAt: string
  place: Place
}

export function useSavedPlaces() {
  return useQuery({
    queryKey: ['savedPlaces'],
    queryFn: () => api.get<{ savedPlaces: SavedPlace[] }>('/places'),
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
