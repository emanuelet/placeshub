import { MapPin, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useDebounceValue } from 'usehooks-ts'
import { useCollections } from '@/hooks/useCollections'
import {
  type SearchPlace,
  toSavePlaceInput,
  useSavePlace,
  useSearchPlaces,
} from '@/hooks/usePlaces'

export function AddPlaceForm({
  collectionId,
  onAdded,
  onCancel,
}: {
  collectionId?: string
  onAdded: (placeId: string) => void
  onCancel: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedCollectionId, setSelectedCollectionId] = useState('')
  const [selectedPlace, setSelectedPlace] = useState<SearchPlace | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [error, setError] = useState('')
  const [debouncedQuery] = useDebounceValue(query.trim(), 300)
  const search = useSearchPlaces(debouncedQuery)
  const collections = useCollections(!collectionId)
  const savePlace = useSavePlace()
  const searching =
    !selectedPlace &&
    query.trim().length >= 2 &&
    (debouncedQuery !== query.trim() || search.isLoading || search.isFetching)
  const results =
    !selectedPlace && !searching && debouncedQuery.length >= 2 ? (search.data?.places ?? []) : []

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open && typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
    searchRef.current?.focus()
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close()
    }
  }, [])

  const choosePlace = (place: SearchPlace) => {
    setSelectedPlace(place)
    setQuery(place.name)
    setActiveIndex(-1)
    setError('')
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={onCancel}
      aria-labelledby="add-place-title"
      className="ui-panel fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto p-5 text-foreground backdrop:bg-black/60"
    >
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!selectedPlace || savePlace.isPending) return
          setError('')
          try {
            const result = await savePlace.mutateAsync({
              ...toSavePlaceInput(selectedPlace),
              ...(notes.trim() ? { notes: notes.trim() } : {}),
              ...(collectionId || selectedCollectionId
                ? { collectionId: collectionId || selectedCollectionId }
                : {}),
            })
            onAdded(result.place.id)
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Couldn't add this place")
          }
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="add-place-title" className="ui-section-title">
            Add a place
          </h2>
          <button
            type="button"
            className="ui-button ui-button-quiet px-2"
            onClick={onCancel}
            aria-label="Close add place dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div>
          <label htmlFor="place-search" className="ui-field-label">
            Search Google Places
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              id="place-search"
              type="search"
              role="combobox"
              aria-autocomplete="list"
              aria-controls="place-suggestions"
              aria-expanded={results.length > 0}
              aria-activedescendant={
                activeIndex >= 0 && results.length ? `place-suggestion-${activeIndex}` : undefined
              }
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setSelectedPlace(null)
                setActiveIndex(-1)
                setError('')
              }}
              onKeyDown={(event) => {
                if (!results.length) return
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  setActiveIndex((index) =>
                    event.key === 'ArrowUp' && index < 0
                      ? results.length - 1
                      : (index + (event.key === 'ArrowDown' ? 1 : results.length - 1)) %
                        results.length,
                  )
                } else if (event.key === 'Enter' && activeIndex >= 0) {
                  event.preventDefault()
                  const place = results[activeIndex]
                  if (place) choosePlace(place)
                }
              }}
              placeholder="Name or address"
              className="ui-input pl-9"
            />
          </div>
          <div
            id="place-suggestions"
            role="listbox"
            aria-label="Place suggestions"
            hidden={!results.length}
            className="max-h-56 divide-y overflow-y-auto rounded-b-control border border-t-0 bg-surface shadow-panel"
          >
            {results.map((place, index) => (
              <button
                key={place.googlePlaceId}
                id={`place-suggestion-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`ui-place-item flex w-full items-start gap-2 p-3 text-left ${index === activeIndex ? 'bg-muted' : ''}`}
                onClick={() => choosePlace(place)}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <span className="block font-medium">{place.name}</span>
                  {place.address && (
                    <span className="block text-xs text-muted-foreground">{place.address}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
          {searching && (
            <p role="status" className="mt-2 text-sm text-muted-foreground">
              Searching…
            </p>
          )}
          {!selectedPlace &&
            query.trim().length >= 2 &&
            !searching &&
            !search.error &&
            !results.length && (
              <p className="mt-2 text-sm text-muted-foreground">No places found.</p>
            )}
          {!selectedPlace && debouncedQuery === query.trim() && search.error && (
            <p role="alert" className="ui-alert-error mt-2">
              Search failed: {search.error.message}
            </p>
          )}
          {selectedPlace && (
            <div className="mt-2 flex items-start justify-between gap-2 rounded-control border bg-muted p-3 text-sm">
              <span>
                <strong className="block">{selectedPlace.name}</strong>
                {selectedPlace.address}
              </span>
              <button
                type="button"
                className="shrink-0 font-semibold text-primary hover:underline"
                onClick={() => {
                  setSelectedPlace(null)
                  setQuery('')
                  searchRef.current?.focus()
                }}
              >
                Change
              </button>
            </div>
          )}
        </div>
        {!collectionId && (
          <div>
            <label htmlFor="place-collection" className="ui-field-label">
              Collection (optional)
            </label>
            <select
              id="place-collection"
              className="ui-input"
              value={selectedCollectionId}
              disabled={collections.isLoading || savePlace.isPending}
              onChange={(event) => setSelectedCollectionId(event.target.value)}
            >
              <option value="">Only save to my places</option>
              {collections.data?.collections
                .filter((collection) => !collection.syncedFromGoogle)
                .map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.title}
                  </option>
                ))}
            </select>
            {collections.error && (
              <p role="alert" className="ui-alert-error mt-2">
                Couldn't load collections: {collections.error.message}
              </p>
            )}
          </div>
        )}
        <div>
          <label htmlFor="new-place-notes" className="ui-field-label">
            Personal notes (optional)
          </label>
          <textarea
            id="new-place-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="ui-input resize-y"
            rows={2}
          />
        </div>
        {error && (
          <p role="alert" className="ui-alert-error">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="ui-button ui-button-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="ui-button ui-button-primary"
            disabled={!selectedPlace || savePlace.isPending}
          >
            {savePlace.isPending ? 'Saving…' : 'Save place'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
