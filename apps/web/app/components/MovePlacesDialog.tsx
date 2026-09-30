import { ArrowRightLeft, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useCollections, useMovePlacesToCollection } from '@/hooks/useCollections'

export function MovePlacesDialog({
  collectionId,
  placeIds,
  onMoved,
  onCancel,
}: {
  collectionId: string
  placeIds: string[]
  onMoved: () => void
  onCancel: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [targetCollectionId, setTargetCollectionId] = useState('')
  const [error, setError] = useState('')
  const { data, isLoading, error: collectionsError } = useCollections()
  const move = useMovePlacesToCollection()
  const destinations = (data?.collections ?? []).filter(
    (collection) => collection.id !== collectionId && !collection.syncedFromGoogle,
  )

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open && typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      onCancel={onCancel}
      aria-labelledby="move-places-title"
      className="ui-panel fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(30rem,calc(100vw-2rem))] overflow-y-auto p-5 text-foreground backdrop:bg-black/60"
    >
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!targetCollectionId || move.isPending) return
          setError('')
          try {
            await move.mutateAsync({ collectionId, targetCollectionId, placeIds })
            onMoved()
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Couldn't move places")
          }
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="move-places-title" className="ui-section-title">
            Move {placeIds.length === 1 ? 'place' : `${placeIds.length} places`}
          </h2>
          <button
            type="button"
            className="ui-button ui-button-quiet px-2"
            onClick={onCancel}
            aria-label="Close move places dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div>
          <label htmlFor="move-destination" className="ui-field-label">
            Destination collection
          </label>
          <select
            id="move-destination"
            className="ui-input"
            value={targetCollectionId}
            disabled={isLoading || move.isPending}
            onChange={(event) => {
              setTargetCollectionId(event.target.value)
              setError('')
            }}
          >
            <option value="">Select a manual collection</option>
            {destinations.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.title}
              </option>
            ))}
          </select>
          {!isLoading && !collectionsError && destinations.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Create another manual collection before moving places.
            </p>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          These places leave this collection. Personal notes and saved places remain available. If a
          place is already in the destination, its existing collection note stays.
        </p>
        {collectionsError && (
          <p role="alert" className="ui-alert-error">
            Couldn't load collections: {collectionsError.message}
          </p>
        )}
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
            className="ui-button ui-button-primary gap-2"
            disabled={!targetCollectionId || move.isPending}
          >
            <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
            {move.isPending ? 'Moving…' : placeIds.length === 1 ? 'Move place' : 'Move places'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
