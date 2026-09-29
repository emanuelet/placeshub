import { useState } from 'react'
import type { Collection } from '@/hooks/useCollections'
import type { SavedSearchParams, SavedSearchResponse } from '@/hooks/useSavedSearch'

interface Props {
  query: string
  onQueryChange: (value: string) => void
  onLocationSelect: (location: { type: 'city' | 'address'; value: string }) => void
  selectedLocation: { type: 'city' | 'address'; value: string } | null
  locations: { type: 'city' | 'address'; value: string }[]
  filters: SavedSearchParams
  onFiltersChange: (filters: SavedSearchParams) => void
  options?: SavedSearchResponse['filters']
  collections?: Collection[]
}

export function SavedSearchControls({
  query,
  onQueryChange,
  onLocationSelect,
  selectedLocation,
  locations,
  filters,
  onFiltersChange,
  options,
  collections,
}: Props) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const update = (key: keyof SavedSearchParams, value: string) =>
    onFiltersChange({ ...filters, [key]: value || undefined })
  const hasFilters =
    !!query ||
    !!filters.collectionId ||
    !!filters.city ||
    !!filters.country ||
    !!filters.category ||
    !!filters.tag ||
    !!filters.minRating

  return (
    <div className="space-y-2">
      <div className="relative">
        <label htmlFor="saved-search" className="text-xs font-medium">
          Search saved places
        </label>
        <input
          id="saved-search"
          type="search"
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value)
            setShowSuggestions(true)
          }}
          placeholder="Name, city or address"
          className="ui-input"
          autoComplete="off"
        />
        {selectedLocation && (
          <p className="text-xs text-muted-foreground">Location: {selectedLocation.value}</p>
        )}
        {showSuggestions && !selectedLocation && locations.length > 0 && (
          <div className="absolute z-10 max-h-48 w-full overflow-y-auto rounded-control border bg-surface shadow-lg">
            {locations.map((location) => (
              <button
                type="button"
                key={`${location.type}:${location.value}`}
                onClick={() => {
                  onLocationSelect(location)
                  setShowSuggestions(false)
                }}
                className="block w-full p-2 text-left text-sm hover:bg-muted"
              >
                {location.value}{' '}
                <span className="text-xs text-muted-foreground">({location.type})</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {collections && (
          <label className="text-xs">
            Collection
            <select
              aria-label="Collection"
              className="ui-input"
              value={filters.collectionId ?? ''}
              onChange={(e) => update('collectionId', e.target.value)}
            >
              <option value="">All places</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-xs">
          City
          <select
            aria-label="City"
            className="ui-input"
            value={filters.city ?? ''}
            onChange={(e) => update('city', e.target.value)}
          >
            <option value="">All cities</option>
            {options?.cities.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Country
          <select
            aria-label="Country"
            className="ui-input"
            value={filters.country ?? ''}
            onChange={(e) => update('country', e.target.value)}
          >
            <option value="">All countries</option>
            {options?.countries.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Category
          <select
            aria-label="Category"
            className="ui-input"
            value={filters.category ?? ''}
            onChange={(e) => update('category', e.target.value)}
          >
            <option value="">All categories</option>
            {options?.categories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Tag
          <select
            aria-label="Tag"
            className="ui-input"
            value={filters.tag ?? ''}
            onChange={(e) => update('tag', e.target.value)}
          >
            <option value="">All tags</option>
            {options?.tags.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Minimum rating
          <select
            aria-label="Minimum rating"
            className="ui-input"
            value={filters.minRating ?? ''}
            onChange={(e) => update('minRating', e.target.value)}
          >
            <option value="">Any rating</option>
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>
                {value}+
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Sort by
          <select
            aria-label="Sort by"
            className="ui-input"
            value={filters.sortBy ?? 'name'}
            onChange={(e) => update('sortBy', e.target.value)}
          >
            <option value="name">Name</option>
            <option value="location">Location</option>
          </select>
        </label>
        <label className="text-xs">
          Order
          <select
            aria-label="Order"
            className="ui-input"
            value={filters.sortDir ?? 'asc'}
            onChange={(e) => update('sortDir', e.target.value)}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
      </div>
      {hasFilters && (
        <button
          type="button"
          className="ui-button ui-button-quiet text-xs"
          onClick={() => {
            onQueryChange('')
            onFiltersChange({ sortBy: filters.sortBy, sortDir: filters.sortDir })
            setShowSuggestions(false)
          }}
        >
          Clear search and filters
        </button>
      )}
    </div>
  )
}
