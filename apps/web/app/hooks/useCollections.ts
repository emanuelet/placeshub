import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Place } from './usePlaces'

export interface Collection {
  id: string
  userId: string
  title: string
  description: string | null
  slug: string
  createdAt: string
  updatedAt: string
  syncedFromGoogle: boolean
}

export interface CollectionWithPlaces extends Collection {
  places: {
    sortOrder: number
    notes: string | null
    savedPlaceId: string | null
    personalNotes: string | null
    place: {
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
      metadata?: Place['metadata']
    }
  }[]
}

export function useCollections(enabled = true) {
  return useQuery({
    queryKey: ['collections'],
    queryFn: () => api.get<{ collections: Collection[] }>('/collections'),
    enabled,
  })
}

export function useCollection(id: string, enabled = true) {
  return useQuery({
    queryKey: ['collection', id],
    queryFn: () =>
      api.get<{ collection: Collection; places: CollectionWithPlaces['places'] }>(
        `/collections/${id}`,
      ),
    enabled: enabled && !!id,
  })
}

export function useCreateCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { title: string; description?: string }) =>
      api.post<{ collection: Collection }>('/collections', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })
}

export function useUpdateCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; title?: string; description?: string | null }) =>
      api.patch<{ collection: Collection }>(`/collections/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      queryClient.invalidateQueries({ queryKey: ['collection'] })
    },
  })
}

export function useDeleteCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/collections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      queryClient.invalidateQueries({ queryKey: ['collection'] })
    },
  })
}

export function useAddPlaceToCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      collectionId,
      placeId,
      sortOrder,
    }: {
      collectionId: string
      placeId: string
      sortOrder?: number
    }) =>
      api.post<{ collectionPlace: { id: string } }>(`/collections/${collectionId}/places`, {
        placeId,
        sortOrder,
      }),
    onSuccess: (_, { collectionId }) => {
      queryClient.invalidateQueries({ queryKey: ['collection', collectionId] })
    },
  })
}

export function useRemovePlaceFromCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ collectionId, placeId }: { collectionId: string; placeId: string }) =>
      api.delete<{ success: boolean }>(`/collections/${collectionId}/places/${placeId}`),
    onSuccess: (_, { collectionId }) => {
      queryClient.invalidateQueries({ queryKey: ['collection', collectionId] })
    },
  })
}

export function useBulkRemovePlacesFromCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ collectionId, placeIds }: { collectionId: string; placeIds: string[] }) =>
      api.post<{ removedCount: number }>(`/collections/${collectionId}/places/bulk-remove`, {
        placeIds,
      }),
    onSuccess: (_, { collectionId }) => {
      queryClient.invalidateQueries({ queryKey: ['collection', collectionId] })
    },
  })
}
