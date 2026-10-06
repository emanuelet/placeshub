import { useState } from 'react'
import { useCreateShare } from '@/hooks/useShares'

export function SnapshotDialog({ collectionId, onClose }: { collectionId: string; onClose: () => void }) {
  const createShare = useCreateShare()
  const [expirationOption, setExpirationOption] = useState('never')
  const [customExpiration, setCustomExpiration] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [error, setError] = useState('')

  const createSnapshot = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const expiration =
      expirationOption === 'custom'
        ? customExpiration
          ? new Date(customExpiration)
          : null
        : expirationOption === 'never'
          ? null
          : new Date(Date.now() + Number(expirationOption) * 86_400_000)
    if (expirationOption === 'custom' && !customExpiration) {
      setError('Choose a custom expiration.')
      return
    }
    if (expiration && (!Number.isFinite(expiration.getTime()) || expiration <= new Date())) {
      setError('Choose an expiration in the future.')
      return
    }
    try {
      const { share } = await createShare.mutateAsync({
        collectionId,
        expiresAt: expiration?.toISOString() ?? null,
      })
      setShareUrl(`${window.location.origin}/share/${share.slug}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't create snapshot")
    }
  }

  return (
    <dialog
      open
      aria-labelledby="snapshot-dialog-heading"
      className="ui-panel fixed inset-0 m-auto w-[min(32rem,calc(100vw-2rem))] p-5 text-foreground backdrop:bg-black/60"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      {shareUrl ? (
        <div className="space-y-4">
          <div>
            <h2 id="snapshot-dialog-heading" className="ui-section-title">
              Snapshot created
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This snapshot does not update when the collection changes.
            </p>
          </div>
          <a href={shareUrl} className="block break-all text-primary underline">
            {shareUrl}
          </a>
          <div className="flex justify-end">
            <button type="button" className="ui-button ui-button-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={createSnapshot}>
          <div>
            <h2 id="snapshot-dialog-heading" className="ui-section-title">
              Create snapshot
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Anyone with this link can view this collection snapshot.
            </p>
          </div>
          {(error || createShare.error) && (
            <p role="alert" className="ui-alert-error">
              {error || createShare.error?.message}
            </p>
          )}
          <div>
            <label htmlFor="snapshot-expiration" className="ui-field-label">
              Expiration
            </label>
            <select
              id="snapshot-expiration"
              value={expirationOption}
              onChange={(event) => setExpirationOption(event.target.value)}
              className="ui-input"
            >
              <option value="never">No expiration</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="custom">Custom</option>
            </select>
            {expirationOption === 'custom' && (
              <div className="mt-3">
                <label htmlFor="snapshot-custom-expiration" className="ui-field-label">
                  Custom expiration
                </label>
                <input
                  id="snapshot-custom-expiration"
                  type="datetime-local"
                  value={customExpiration}
                  onChange={(event) => setCustomExpiration(event.target.value)}
                  className="ui-input"
                />
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="ui-button ui-button-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="ui-button ui-button-primary" disabled={createShare.isPending}>
              {createShare.isPending ? 'Creating...' : 'Create snapshot'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
