import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { savedPlaces } = vi.hoisted(() => ({
  savedPlaces: { current: [] as Array<Record<string, unknown>> },
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (opts: { component: unknown }) => opts,
  Link: ({
    children,
    params,
  }: {
    children: React.ReactNode
    params?: { collectionId: string }
  }) => <a href={params ? `/collections/${params.collectionId}` : '/auth/login'}>{children}</a>,
}))

vi.mock('usehooks-ts', () => ({
  useDebounceValue: (value: string) => [value],
}))

vi.mock('@/hooks/usePlaces', () => ({
  toSavePlaceInput: vi.fn(),
  useSavedPlaces: () => ({
    data: { savedPlaces: savedPlaces.current },
    isLoading: false,
    error: null,
  }),
  useSavePlace: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
  }),
  useUpdateSavedPlace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSearchPlaces: () => ({ data: { places: [] }, isLoading: false }),
}))

vi.mock('@/hooks/useSavedPlaceSearch', () => ({
  useSavedPlaceSearch: () => ({
    query: '',
    setQuery: vi.fn(),
    selectedLocation: null,
    selectLocation: vi.fn(),
    locations: [],
    filters: { sortBy: 'name', sortDir: 'asc' },
    setFilters: vi.fn(),
    search: {
      data: {
        places: savedPlaces.current
          .filter((sp) => sp.directlySaved || (sp.syncedCollectionIds as string[]).length > 0)
          .map((sp) => ({
            ...(sp.place as object),
            id: (sp.place as { id: string }).id,
            savedPlaceId: sp.id,
            personalNotes: sp.notes,
            notes: sp.notes,
            collections: sp.collections ?? [],
          })),
        filters: { cities: [], countries: [], categories: [], tags: [] },
      },
      isLoading: false,
      error: null,
    },
  }),
}))

vi.mock('@/hooks/useCollections', () => ({
  useCollections: () => ({
    data: { collections: [] },
    isLoading: false,
    error: null,
  }),
}))

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))

vi.mock('@/lib/mapContext', () => ({
  toMapPlace: (place: { id: string; name: string; lat: number; lng: number }) => place,
  useMapManager: () => ({
    setPlaces: vi.fn(),
    setOnPlaceClick: vi.fn(),
    setSelectedPlaceId: vi.fn(),
    flyTo: vi.fn(),
  }),
}))

import { Route } from './dashboard'

function savedPlace(name: string, directlySaved: boolean, syncedCollectionIds: string[]) {
  return {
    id: `save-${name}`,
    notes: null,
    directlySaved,
    syncedCollectionIds,
    place: {
      id: `place-${name}`,
      googlePlaceId: `google-${name}`,
      name,
      lat: 0,
      lng: 0,
      address: null,
    },
  }
}

describe('dashboard after Google-list reconciliation', () => {
  beforeEach(() => {
    savedPlaces.current = []
  })

  it('hides a Google-only place removed from its last collection, but retains a direct save and a place in another synced collection', () => {
    savedPlaces.current = [
      savedPlace('Removed from Google', false, []),
      savedPlace('Still in another list', false, ['list-b']),
      savedPlace('Saved directly', true, []),
    ]

    const Dashboard = (Route as unknown as { component: React.ComponentType }).component
    render(<Dashboard />)

    expect(screen.getByText('Saved Places (2)')).toBeInTheDocument()
    expect(screen.queryByText('Removed from Google')).not.toBeInTheDocument()
    expect(screen.getByText('Still in another list')).toBeInTheDocument()
    expect(screen.getByText('Saved directly')).toBeInTheDocument()
  })

  it('does not hide a place saved directly after it was imported, even after its last Google membership disappears', () => {
    savedPlaces.current = [savedPlace('Imported then saved directly', true, [])]

    const Dashboard = (Route as unknown as { component: React.ComponentType }).component
    render(<Dashboard />)

    expect(screen.getByText('Saved Places (1)')).toBeInTheDocument()
    expect(screen.getByText('Imported then saved directly')).toBeInTheDocument()
  })

  it('opens an add-place dialog instead of expanding an inline form', () => {
    const Dashboard = (Route as unknown as { component: React.ComponentType }).component
    render(<Dashboard />)
    fireEvent.click(screen.getByRole('button', { name: 'Add place' }))
    expect(screen.getByRole('dialog', { name: 'Add a place' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Search Google Places' })).toBeInTheDocument()
  })

  it('shows collection membership and distinguishes collection notes from personal notes', () => {
    savedPlaces.current = [
      {
        ...savedPlace('Cafe', true, []),
        notes: 'Personal note',
        collections: [
          { id: 'trip', title: 'Trip', notes: 'Meet here' },
          { id: 'food', title: 'Food', notes: null },
        ],
      },
      savedPlace('Beach', true, []),
    ]
    const Dashboard = (Route as unknown as { component: React.ComponentType }).component
    render(<Dashboard />)
    expect(screen.getByText('Collection: Trip')).toBeInTheDocument()
    expect(screen.queryByText('Collection note: Meet here')).not.toBeInTheDocument()
    expect(screen.queryByText('No collection notes.')).not.toBeInTheDocument()
    expect(screen.getByText('Not in a collection.')).toBeInTheDocument()
    expect(screen.getByText('Personal note')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Cafe/ }))
    expect(screen.getByText('Collection note:').parentElement).toHaveTextContent('Meet here')
    expect(screen.getByRole('link', { name: 'Trip' })).toHaveAttribute('href', '/collections/trip')
  })
})
