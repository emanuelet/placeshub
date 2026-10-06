import { Link } from '@tanstack/react-router'
import { Ellipsis, Pencil, Share2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { type Collection, useUpdateCollection } from '@/hooks/useCollections'
import { useCreateShare } from '@/hooks/useShares'
import { formatDate } from '@/lib/date'

export function CollectionListItem({ collection }: { collection: Collection }) {
  const update = useUpdateCollection()
  const share = useCreateShare()
  const menu = useRef<HTMLDetailsElement>(null)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(collection.title)
  const [error, setError] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  return (
    <article className="ui-panel ui-list-item min-w-0 p-4">
      <div className="flex items-start gap-2">
        <Link
          to="/collections/$collectionId"
          params={{ collectionId: collection.id }}
            className="-m-2 mr-0 block min-w-0 flex-1 rounded-control p-2"
        >
          <strong className="break-words">{collection.title}</strong>
          {collection.syncedFromGoogle && <span className="ui-badge ml-2">Google Sync</span>}
          {collection.description && (
            <p className="mt-1 text-sm text-muted-foreground">{collection.description}</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {collection.placeCount ?? 0} saved items · Created {formatDate(collection.createdAt)}
          </p>
        </Link>
        <details
          ref={menu}
          className="relative shrink-0"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && menu.current) {
              menu.current.open = false
              menu.current.querySelector('summary')?.focus()
            }
          }}
        >
          <summary
            aria-label={`Actions for ${collection.title}`}
            className="ui-button ui-button-secondary cursor-pointer list-none px-2 [&::-webkit-details-marker]:hidden"
          >
            <Ellipsis className="h-5 w-5" aria-hidden="true" />
          </summary>
          <div className="ui-panel absolute right-0 z-30 mt-1 min-w-40 p-1">
            {!collection.syncedFromGoogle && (
              <button
                type="button"
                className="ui-button ui-button-quiet w-full justify-start gap-2"
                onClick={() => {
                  if (menu.current) menu.current.open = false
                  setTitle(collection.title)
                  setError('')
                  setEditing(true)
                }}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Rename
              </button>
            )}
            <button
              type="button"
              className="ui-button ui-button-quiet w-full justify-start gap-2"
              disabled={share.isPending}
              onClick={async () => {
                if (menu.current) menu.current.open = false
                setError('')
                try {
                  const result = await share.mutateAsync({ collectionId: collection.id })
                  setShareUrl(`${window.location.origin}/share/${result.share.slug}`)
                } catch (reason) {
                  setError(reason instanceof Error ? reason.message : "Couldn't share collection")
                }
              }}
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share snapshot
            </button>
          </div>
        </details>
      </div>
      {editing && (
        <form
          className="mt-3 space-y-2"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!title.trim()) {
              setError('Enter a collection name.')
              return
            }
            setError('')
            try {
              await update.mutateAsync({ id: collection.id, title: title.trim() })
              setEditing(false)
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : "Couldn't rename collection")
            }
          }}
        >
          <label className="ui-field-label" htmlFor={`rename-${collection.id}`}>
            Collection name
          </label>
          <input
            id={`rename-${collection.id}`}
            className="ui-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            ref={(input) => input?.focus()}
            required
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="ui-button ui-button-primary"
              disabled={update.isPending}
            >
              Save name
            </button>
            <button
              type="button"
              className="ui-button ui-button-secondary"
              onClick={() => {
                setEditing(false)
                setError('')
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="ui-alert-error mt-3">
          {error}
        </p>
      )}
      {shareUrl && (
        <div role="status" className="ui-alert-success mt-3">
          <p>Snapshot created:</p>
          <a href={shareUrl} className="break-all underline">
            {shareUrl}
          </a>
        </div>
      )}
    </article>
  )
}
