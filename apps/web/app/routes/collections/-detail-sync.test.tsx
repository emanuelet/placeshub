import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { synced, bulkRemove, rename, deleteCollection } = vi.hoisted(() => ({
  synced: { current: true },
  bulkRemove: vi.fn(),
  rename: vi.fn(),
  deleteCollection: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: { component: unknown }) => ({
    ...options,
    useParams: () => ({ collectionId: 'collection-1' }),
  }),
  useNavigate: () => vi.fn(),
}))

vi.mock('@/hooks/useCollections', () => ({
  useCollections: () => ({ data: { collections: [] }, isLoading: false, error: null }),
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
  useBulkRemovePlacesFromCollection: () => ({ mutateAsync: bulkRemove, isPending: false }),
  useUpdateCollection: () => ({ mutateAsync: rename, isPending: false }),
  useDeleteCollection: () => ({ mutateAsync: deleteCollection, isPending: false }),
}))

vi.mock('@/hooks/usePlaces', () => ({
  useSearchPlaces: () => ({ data: { places: [] }, isLoading: false, error: null }),
  useSavePlace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  toSavePlaceInput: vi.fn(),
}))

vi.mock('@/hooks/useShares', () => ({
  useCreateShare: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
}))

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, loading: false }),
}))

vi.mock('@/lib/mapContext', () => ({
  toMapPlace: (place: object) => place,
  useMapManager: () => ({
    setPlaces: vi.fn(),
    setOnPlaceClick: vi.fn(),
    setSelectedPlaceId: vi.fn(),
    flyTo: vi.fn(),
  }),
}))

import { Route } from './$collectionId'

describe('collection interactions', () => {
  beforeEach(() => {
    synced.current = true
    bulkRemove.mockReset().mockResolvedValue({ removedCount: 1 })
    rename.mockReset().mockResolvedValue({ collection: { title: 'Changed' } })
    deleteCollection.mockReset().mockResolvedValue({ success: true })
  })

  it('directs removals to Google on synced collections and labels sharing as a snapshot', () => {
    const Detail = (Route as unknown as { component: React.ComponentType }).component
    render(<Detail />)

    expect(screen.getByText(/remove places there/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add place' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete collection' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Share snapshot' })).toBeInTheDocument()
  })

  it('keeps manual removal available in a PlacesHub collection', () => {
    synced.current = false
    const Detail = (Route as unknown as { component: React.ComponentType }).component
    render(<Detail />)

    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add place' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument()
  })

  it('opens a preselected add-place dialog for manual collections', () => {
    synced.current = false
    const Detail = (Route as unknown as { component: React.ComponentType }).component
    render(<Detail />)
    fireEvent.click(screen.getByRole('button', { name: 'Add place' }))
    expect(screen.getByRole('dialog', { name: 'Add a place' })).toBeInTheDocument()
    expect(
      screen.queryByRole('combobox', { name: 'Collection (optional)' }),
    ).not.toBeInTheDocument()
  })

  it('renames and confirms deletion of manual collections', async () => {
    synced.current = false
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    const Detail = (Route as unknown as { component: React.ComponentType }).component
    render(<Detail />)
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Collection title' }), {
      target: { value: 'Changed' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save title' }))
    await waitFor(() =>
      expect(rename).toHaveBeenCalledWith({ id: 'collection-1', title: 'Changed' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete collection' }))
    await waitFor(() => expect(deleteCollection).toHaveBeenCalledWith('collection-1'))
    vi.unstubAllGlobals()
  })

  it('removes selected memberships in bulk from manual collections only', async () => {
    synced.current = false
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    const Detail = (Route as unknown as { component: React.ComponentType }).component
    render(<Detail />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Cafe' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove selected (1)' }))
    await waitFor(() =>
      expect(bulkRemove).toHaveBeenCalledWith({
        collectionId: 'collection-1',
        placeIds: ['place-1'],
      }),
    )
    vi.unstubAllGlobals()
  })
})
