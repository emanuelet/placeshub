import { Clock3, ExternalLink, Globe2, MapPin, Pencil, Phone, Star, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { type Place, useUpdateSavedPlace } from '@/hooks/usePlaces'

type DetailedPlace = Pick<Place, 'id' | 'name'> & Partial<Place>

function externalUrl(value: string | null | undefined) {
  if (!value) return null
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

function googleMapsLink(place: DetailedPlace) {
  const known = externalUrl(place.googleMapsUri)
  if (known) return known
  const query =
    place.lat != null && place.lng != null
      ? `${place.lat},${place.lng}`
      : [place.name, place.address].filter(Boolean).join(', ')
  const url = new URL('https://www.google.com/maps/search/')
  url.searchParams.set('api', '1')
  url.searchParams.set('query', query)
  if (place.googlePlaceId && !place.googlePlaceId.startsWith('maps:')) {
    url.searchParams.set('query_place_id', place.googlePlaceId)
  }
  return url.href
}

export function PlaceDetails({
  place,
  personalNotes,
  importedNotes,
  savedPlaceId,
  onClose,
}: {
  place: DetailedPlace
  personalNotes?: string | null
  importedNotes?: string | null
  savedPlaceId?: string | null
  onClose: () => void
}) {
  const meta = place.metadata
  return (
    <aside
      className="ui-panel min-w-0 space-y-4 overflow-y-auto p-4 sm:p-5"
      aria-label="Place details"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-bold break-words">{place.name}</h2>
        <button
          type="button"
          className="ui-button ui-button-quiet shrink-0 px-2"
          onClick={onClose}
          aria-label="Close place details"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      {meta?.imageUrl && externalUrl(meta.imageUrl) && (
        <img
          src={meta.imageUrl}
          alt={place.name}
          className="h-40 w-full rounded-control object-cover"
        />
      )}
      <a
        href={googleMapsLink(place)}
        target="_blank"
        rel="noopener noreferrer"
        className="ui-button ui-button-secondary w-full gap-2"
      >
        <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
        View on Google Maps
        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
      </a>
      <div className="space-y-2 text-sm break-words">
        {place.address && (
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {place.address}
          </p>
        )}
        {place.rating != null && (
          <p className="flex items-center gap-2">
            <Star className="h-4 w-4 shrink-0 fill-accent text-accent" aria-hidden="true" />
            {place.rating}
            {meta?.reviewCount != null ? ` (${meta.reviewCount} reviews)` : ''}
          </p>
        )}
        {meta?.category?.length ? <p>{meta.category.join(' · ')}</p> : null}
        {place.types?.length ? <p>{place.types.join(' · ')}</p> : null}
        {meta?.businessStatus && <p>Status: {meta.businessStatus.replaceAll('_', ' ')}</p>}
        {meta?.priceLevel && <p>Price: {meta.priceLevel.replaceAll('_', ' ')}</p>}
        {place.phone && (
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <a href={`tel:${place.phone}`} className="text-primary underline">
              {place.phone}
            </a>
          </p>
        )}
        {place.website && externalUrl(place.website) && (
          <p className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <a
              href={externalUrl(place.website) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Website
            </a>
          </p>
        )}
        {meta?.hours?.length ? (
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <Clock3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Opening hours
            </h3>
            {meta.hours.map(({ day, hours }) => (
              <p key={day}>
                {day}: {hours}
              </p>
            ))}
          </div>
        ) : null}
        {meta?.plusCode && <p>Plus code: {meta.plusCode}</p>}
        {meta?.city && <p>City: {meta.city}</p>}
        {meta?.state && <p>State: {meta.state}</p>}
        {meta?.postalCode && <p>Postal code: {meta.postalCode}</p>}
        {meta?.country && <p>Country: {meta.country}</p>}
        {meta?.dateAdded && <p>Added: {new Date(meta.dateAdded).toLocaleDateString()}</p>}
        {meta?.dateUpdated && <p>Updated: {new Date(meta.dateUpdated).toLocaleDateString()}</p>}
      </div>
      {(savedPlaceId || personalNotes || importedNotes) && (
        <div className="space-y-2 border-t pt-3 text-sm">
          {importedNotes && (
            <p>
              <strong>Google list note:</strong> {importedNotes}
            </p>
          )}
          {savedPlaceId ? (
            <EditablePersonalNotes
              key={place.id}
              savedPlaceId={savedPlaceId}
              notes={personalNotes}
            />
          ) : personalNotes ? (
            <p className="whitespace-pre-wrap break-words text-muted-foreground">{personalNotes}</p>
          ) : null}
        </div>
      )}
    </aside>
  )
}

function EditablePersonalNotes({
  savedPlaceId,
  notes,
}: {
  savedPlaceId: string
  notes?: string | null
}) {
  const updateNotes = useUpdateSavedPlace()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(notes ?? '')
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(notes ?? '')
  }, [notes])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Personal notes</h3>
        {!editing && (
          <button
            type="button"
            className="ui-button ui-button-quiet"
            onClick={() => setEditing(true)}
          >
            <Pencil className="mr-1 inline h-4 w-4" aria-hidden="true" /> Edit notes
          </button>
        )}
      </div>
      {editing ? (
        <form
          className="space-y-2"
          onSubmit={async (event) => {
            event.preventDefault()
            setError('')
            try {
              await updateNotes.mutateAsync({ id: savedPlaceId, notes: draft.trim() || null })
              setEditing(false)
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : "Couldn't save notes")
            }
          }}
        >
          <label htmlFor="personal-notes" className="ui-field-label">
            Personal notes (optional)
          </label>
          <textarea
            id="personal-notes"
            className="ui-input"
            rows={4}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          {error && (
            <p role="alert" className="ui-alert-error">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={updateNotes.isPending}
              className="ui-button ui-button-primary"
            >
              Save notes
            </button>
            <button
              type="button"
              className="ui-button ui-button-secondary"
              onClick={() => {
                setDraft(notes ?? '')
                setEditing(false)
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="whitespace-pre-wrap break-words text-muted-foreground">
          {notes || 'No personal notes yet.'}
        </p>
      )}
    </div>
  )
}
