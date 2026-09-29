import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSavedPlaceSearch } from '@/hooks/useSavedPlaceSearch'
import { SavedSearchControls } from './SavedSearchControls'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get } }))
vi.mock('usehooks-ts', () => ({ useDebounceValue: (value: string) => [value] }))

function Search() {
  const state = useSavedPlaceSearch()
  return (
    <SavedSearchControls
      query={state.query}
      onQueryChange={state.setQuery}
      onLocationSelect={state.selectLocation}
      selectedLocation={state.selectedLocation}
      locations={state.locations}
      filters={state.filters}
      onFiltersChange={state.setFilters}
      options={state.search.data?.filters}
      collections={[
        {
          id: 'collection-1',
          title: 'Trip',
          userId: 'user-1',
          slug: 'trip',
          description: null,
          createdAt: '',
          updatedAt: '',
          syncedFromGoogle: false,
        },
      ]}
    />
  )
}

function renderSearch() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <Search />
    </QueryClientProvider>,
  )
}

const requested = (prefix: string) =>
  get.mock.calls.map((args: unknown[]) => args[0] as string).filter((url) => url.startsWith(prefix))

describe('saved place search controls', () => {
  beforeEach(() => {
    get.mockReset().mockImplementation(async (url: string) =>
      url.startsWith('/saved/locations')
        ? { locations: [{ type: 'city', value: 'Sydney' }] }
        : {
            places: [],
            filters: {
              cities: ['Sydney'],
              countries: ['Australia'],
              categories: ['Cafe'],
              tags: ['Favorite'],
            },
          },
    )
  })

  it('searches city text, then switches to structured location when a suggestion is selected', async () => {
    renderSearch()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search saved places' }), {
      target: { value: 'Sydney' },
    })
    await waitFor(() =>
      expect(
        requested('/saved/search?').some(
          (url: string) => new URL(url, 'https://test').searchParams.get('q') === 'Sydney',
        ),
      ).toBe(true),
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Sydney (city)' }))
    await waitFor(() => {
      expect(
        requested('/saved/search?').some((url: string) => {
          const params = new URL(url, 'https://test').searchParams
          return (
            params.get('locationType') === 'city' &&
            params.get('locationValue') === 'Sydney' &&
            !params.has('q')
          )
        }),
      ).toBe(true)
    })
  })

  it('filters and sorts without a text query, scoped to a collection', async () => {
    renderSearch()
    await screen.findByRole('option', { name: 'Favorite' })
    fireEvent.change(screen.getByRole('combobox', { name: 'Collection' }), {
      target: { value: 'collection-1' },
    })
    await waitFor(() =>
      expect(
        requested('/saved/search?').some(
          (url) => new URL(url, 'https://test').searchParams.get('collectionId') === 'collection-1',
        ),
      ).toBe(true),
    )
    await screen.findByRole('option', { name: 'Favorite' })
    fireEvent.change(screen.getByRole('combobox', { name: 'Tag' }), {
      target: { value: 'Favorite' },
    })
    await waitFor(() =>
      expect(
        requested('/saved/search?').some(
          (url) => new URL(url, 'https://test').searchParams.get('tag') === 'Favorite',
        ),
      ).toBe(true),
    )
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), {
      target: { value: 'location' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Order' }), { target: { value: 'desc' } })
    await waitFor(() => {
      expect(
        requested('/saved/search?').some((url: string) => {
          const params = new URL(url, 'https://test').searchParams
          return (
            params.get('collectionId') === 'collection-1' &&
            params.get('tag') === 'Favorite' &&
            params.get('sortBy') === 'location' &&
            params.get('sortDir') === 'desc' &&
            !params.has('q')
          )
        }),
      ).toBe(true)
    })
  })
})
