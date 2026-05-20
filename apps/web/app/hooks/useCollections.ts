import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Collection {
  id: string
  userId: string
  title: string
  description: string | null
  slug: string
  createdAt: string
  updatedAt: string
}

export interface CollectionWithPlaces extends Collection {
  places: {
    sortOrder: number
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
    }
  }[]
}

export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: () => api.get<{ collections: Collection[] }>('/collections'),
  })
}

export function useCollection(id: string) {
  return useQuery({
    queryKey: ['collection', id],
    queryFn: () =>
      api.get<{ collection: Collection; places: CollectionWithPlaces['places'] }>(
        `/collections/${id}`,
      ),
    enabled: !!id,
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
    mutationFn: ({ id, ...body }: { id: string; title?: string; description?: string }) =>
      api.patch<{ collection: Collection }>(`/collections/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })
}

export function useDeleteCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/collections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
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
