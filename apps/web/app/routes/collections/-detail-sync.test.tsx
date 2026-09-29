import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { synced } = vi.hoisted(() => ({ synced: { current: true } }))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: { component: unknown }) => ({
    ...options,
    useParams: () => ({ collectionId: 'collection-1' }),
  }),
}))

vi.mock('@/hooks/useCollections', () => ({
  useCollection: () => ({
    data: {
      collection: { id: 'collection-1', title: 'Want to go', syncedFromGoogle: synced.current },
      places: [
        {
          place: {
            id: 'place-1',
            name: 'Cafe',
            lat: 1,
            lng: 2,
            address: null,
            rating: null,
            phone: null,
            website: null,
          },
          notes: null,
        },
      ],
    },
    isLoading: false,
    error: null,
  }),
  useRemovePlaceFromCollection: () => ({ mutate: vi.fn(), isError: false }),
}))

vi.mock('@/hooks/useShares', () => ({
  useCreateShare: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
}))

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, loading: false }),
}))

vi.mock('@/lib/mapContext', () => ({
  toMapPlace: (place: object) => place,
  useMapManager: () => ({ setPlaces: vi.fn(), setOnPlaceClick: vi.fn(), flyTo: vi.fn() }),
}))

import { Route } from './$collectionId'

describe('collection interactions', () => {
  beforeEach(() => {
    synced.current = true
  })

  it('directs removals to Google on synced collections and labels sharing as a snapshot', () => {
    const Detail = (Route as unknown as { component: React.ComponentType }).component
    render(<Detail />)

    expect(screen.getByText(/remove places there/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Share snapshot' })).toBeInTheDocument()
  })

  it('keeps manual removal available in a PlacesHub collection', () => {
    synced.current = false
    const Detail = (Route as unknown as { component: React.ComponentType }).component
    render(<Detail />)

    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })
})
