import { useEffect, useRef, useState } from 'react'
import { useImportCollection } from '@/hooks/useCollections'
import { type MyMapsImport, parseMyMapsFile } from '@/lib/my-maps-import'

export function ImportMyMapsDialog({
  onCancel,
  onImported,
}: {
  onCancel: () => void
  onImported: (id: string) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const readId = useRef(0)
  const [preview, setPreview] = useState<MyMapsImport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const importCollection = useImportCollection()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="import-mymaps-heading"
      onCancel={(event) => {
        if (importCollection.isPending) event.preventDefault()
        else onCancel()
      }}
      className="ui-panel fixed inset-0 m-auto w-[min(36rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 text-foreground backdrop:bg-black/60"
    >
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!preview || importCollection.isPending) return
          setError('')
          try {
            const result = await importCollection.mutateAsync({
              title: preview.title,
              places: preview.places,
            })
            onImported(result.collection.id)
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Couldn't import this map")
          }
        }}
      >
        <h2 id="import-mymaps-heading" className="ui-section-title">
          Import a map
        </h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>
            Open your map in{' '}
            <a
              href="https://www.google.com/maps/d/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Google My Maps
            </a>
            .
          </li>
          <li>Click the three-dot menu next to the map title and choose “Export to KML/KMZ”.</li>
          <li>Select “Entire map”, download the file, then choose it below.</li>
        </ol>
        <p className="text-sm text-muted-foreground">
          You can also choose a GeoJSON FeatureCollection with Point geometries. Place names and
          notes are read from the name and description properties.
        </p>
        <p className="text-sm text-muted-foreground">
          All point pins from every layer become one editable collection. Lines, polygons, and icon
          images are skipped. Imports do not sync with My Maps.
        </p>
        <div>
          <label htmlFor="mymaps-file" className="ui-field-label">
            KML, KMZ or GeoJSON file
          </label>
          <input
            id="mymaps-file"
            type="file"
            accept=".kml,.kmz,.geojson"
            className="ui-input"
            disabled={importCollection.isPending}
            onChange={async (event) => {
              const file = event.target.files?.[0]
              const currentRead = ++readId.current
              setPreview(null)
              setError('')
              if (!file) return
              setLoading(true)
              try {
                const result = await parseMyMapsFile(file)
                if (currentRead === readId.current) setPreview(result)
              } catch (reason) {
                if (currentRead === readId.current) {
                  setError(reason instanceof Error ? reason.message : "Couldn't read this file")
                }
              } finally {
                if (currentRead === readId.current) setLoading(false)
              }
            }}
          />
        </div>
        {loading && <p role="status">Reading map...</p>}
        {preview && (
          <p role="status" className="ui-alert-success">
            {preview.title}: {preview.places.length} point pins ready to import.
            {preview.skipped > 0
              ? ` ${preview.skipped} unsupported or duplicate items skipped.`
              : ''}
          </p>
        )}
        {error && (
          <p role="alert" className="ui-alert-error">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="ui-button ui-button-secondary"
            disabled={importCollection.isPending}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="ui-button ui-button-primary"
            disabled={!preview || loading || importCollection.isPending}
          >
            {importCollection.isPending ? 'Importing...' : 'Import collection'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
