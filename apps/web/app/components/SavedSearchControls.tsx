import { ChevronDown, Filter, MapPin, Search, X } from 'lucide-react'
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

function FilterSelect({
  label,
  value,
  onChange,
  choices,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  choices: { value: string; label: string }[]
}) {
  return (
    <label className="block min-w-0 space-y-1 text-xs font-semibold text-muted-foreground">
      <span className="block">{label}</span>
      <select
        aria-label={label}
        className={`ui-input min-h-10 cursor-pointer bg-surface ${value ? 'border-primary/50 text-primary' : ''}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </label>
  )
}

const choices = (allLabel: string, values: string[] = []) => [
  { value: '', label: allLabel },
  ...values.map((value) => ({ value, label: value })),
]

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
  const [showFilters, setShowFilters] = useState(false)
  const update = (key: keyof SavedSearchParams, value: string) =>
    onFiltersChange({ ...filters, [key]: value || undefined })

  const activeFilters = [
    query && {
      key: 'search',
      label: selectedLocation ? `Location: ${selectedLocation.value}` : `Search: ${query}`,
      clear: () => onQueryChange(''),
    },
    filters.collectionId && {
      key: 'collection',
      label: `Collection: ${collections?.find((item) => item.id === filters.collectionId)?.title ?? filters.collectionId}`,
      clear: () => update('collectionId', ''),
    },
    filters.city && {
      key: 'city',
      label: `City: ${filters.city}`,
      clear: () => update('city', ''),
    },
    filters.country && {
      key: 'country',
      label: `Country: ${filters.country}`,
      clear: () => update('country', ''),
    },
    filters.category && {
      key: 'category',
      label: `Category: ${filters.category}`,
      clear: () => update('category', ''),
    },
    filters.tag && { key: 'tag', label: `Tag: ${filters.tag}`, clear: () => update('tag', '') },
    filters.minRating && {
      key: 'rating',
      label: `Rating: ${filters.minRating}+`,
      clear: () => update('minRating', ''),
    },
  ].filter((filter): filter is { key: string; label: string; clear: () => void } => !!filter)

  return (
    <section
      aria-label="Find saved places"
      className="space-y-3 rounded-panel border bg-muted/40 p-3 shadow-sm sm:p-4"
    >
      <div>
        <label
          htmlFor="saved-search"
          className="mb-1.5 block text-xs font-semibold text-foreground"
        >
          Search saved places
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
            <Search className="h-4 w-4" aria-hidden="true" />
          </span>
          <input
            id="saved-search"
            type="search"
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value)
              setShowSuggestions(true)
            }}
            placeholder="Name, city or address"
            className="ui-input pl-10"
            autoComplete="off"
          />
          {showSuggestions && !selectedLocation && locations.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-control border bg-surface p-1 shadow-panel">
              {locations.map((location) => (
                <button
                  type="button"
                  key={`${location.type}:${location.value}`}
                  onClick={() => {
                    onLocationSelect(location)
                    setShowSuggestions(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-control p-2 text-left text-sm hover:bg-muted"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{location.value}</span>
                  <span className="text-xs text-muted-foreground">({location.type})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <button
          type="button"
          aria-expanded={showFilters}
          onClick={() => setShowFilters((shown) => !shown)}
          className="flex min-h-9 items-center gap-2 rounded-control px-1 text-sm font-semibold text-foreground hover:text-primary"
        >
          <Filter className="h-4 w-4 text-primary" aria-hidden="true" />
          Filters
          {activeFilters.length > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {activeFilters.length}
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        {activeFilters.length > 0 && (
          <button
            type="button"
            className="text-xs font-semibold text-primary hover:underline"
            onClick={() => {
              onQueryChange('')
              onFiltersChange({ sortBy: filters.sortBy, sortDir: filters.sortDir })
              setShowSuggestions(false)
            }}
          >
            Clear all
          </button>
        )}
      </div>

      {activeFilters.length > 0 && (
        <fieldset aria-label="Active filters" className="flex flex-wrap gap-1.5">
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              aria-label={`Remove ${filter.key} filter`}
              onClick={filter.clear}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/30 bg-surface px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-brand-50 dark:hover:bg-muted"
            >
              <span className="truncate">{filter.label}</span>
              <X className="h-3 w-3 shrink-0" aria-hidden="true" />
            </button>
          ))}
        </fieldset>
      )}

      {showFilters && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {collections && (
              <FilterSelect
                label="Collection"
                value={filters.collectionId ?? ''}
                onChange={(value) => update('collectionId', value)}
                choices={[
                  { value: '', label: 'All places' },
                  ...collections.map((collection) => ({
                    value: collection.id,
                    label: collection.title,
                  })),
                ]}
              />
            )}
            <FilterSelect
              label="City"
              value={filters.city ?? ''}
              onChange={(value) => update('city', value)}
              choices={choices('All cities', options?.cities)}
            />
            <FilterSelect
              label="Country"
              value={filters.country ?? ''}
              onChange={(value) => update('country', value)}
              choices={choices('All countries', options?.countries)}
            />
            <FilterSelect
              label="Category"
              value={filters.category ?? ''}
              onChange={(value) => update('category', value)}
              choices={choices('All categories', options?.categories)}
            />
            <FilterSelect
              label="Tag"
              value={filters.tag ?? ''}
              onChange={(value) => update('tag', value)}
              choices={choices('All tags', options?.tags)}
            />
            <FilterSelect
              label="Minimum rating"
              value={filters.minRating ?? ''}
              onChange={(value) => update('minRating', value)}
              choices={[
                { value: '', label: 'Any rating' },
                ...[1, 2, 3, 4, 5].map((value) => ({
                  value: String(value),
                  label: `${value}+ stars`,
                })),
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 border-t pt-3 sm:gap-3">
            <FilterSelect
              label="Sort by"
              value={filters.sortBy ?? 'name'}
              onChange={(value) => update('sortBy', value)}
              choices={[
                { value: 'name', label: 'Name' },
                { value: 'location', label: 'Location' },
              ]}
            />
            <FilterSelect
              label="Order"
              value={filters.sortDir ?? 'asc'}
              onChange={(value) => update('sortDir', value)}
              choices={[
                { value: 'asc', label: 'Ascending' },
                { value: 'desc', label: 'Descending' },
              ]}
            />
          </div>
        </div>
      )}
    </section>
  )
}
