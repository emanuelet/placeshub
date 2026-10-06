import { AlertTriangle, Clock3, RefreshCw, SkipForward } from 'lucide-react'
import { useState } from 'react'
import { usePlaceProcessing, usePlaceProcessingAction } from '@/hooks/usePlaceProcessing'

export function PlaceProcessingSettings() {
  const [status, setStatus] = useState<string>()
  const { data, isLoading, error } = usePlaceProcessing(status)
  const action = usePlaceProcessingAction()
  const jobs = data?.jobs ?? []
  const pending = (data?.counts.pending ?? 0) + (data?.counts.resolving ?? 0) + (data?.counts.details ?? 0)
  return (
    <section className="space-y-4" aria-labelledby="place-processing-heading">
      <div className="ui-panel space-y-3 p-5">
        <h2 id="place-processing-heading" className="ui-section-title">Place processing</h2>
        <p className="text-sm text-muted-foreground">Imported pins are matched with Google Places gradually. Automatic processing uses at most 1,000 Google requests each day and targets 900 to leave room for retries and searches.</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-muted-foreground">Today</dt><dd className="font-medium">{data ? `${data.usage.attempts} / ${data.usage.dailyLimit}` : 'Loading...'}</dd></div>
          <div><dt className="text-muted-foreground">Waiting</dt><dd className="font-medium">{pending}</dd></div>
          <div><dt className="text-muted-foreground">Needs review</dt><dd className="font-medium">{data?.counts.ambiguous ?? 0}</dd></div>
        </dl>
        {data?.usage.nextRequestAt && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="h-4 w-4" /> Next automatic request: {new Date(data.usage.nextRequestAt).toLocaleString()}</p>}
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Processing status filter">
        {[[undefined, 'All'], ['ambiguous', 'Needs review'], ['pending', 'Pending'], ['failed', 'Failed'], ['unmatched', 'Unmatched'], ['skipped', 'Skipped']].map(([value, label]) => <button key={label} type="button" className={`ui-button ${status === value ? 'ui-button-primary' : 'ui-button-secondary'}`} onClick={() => setStatus(value)}>{label}</button>)}
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading processing queue...</p> : error ? <p className="text-sm text-destructive">Unable to load place processing.</p> : jobs.length === 0 ? <div className="ui-empty-state">No places in this queue.</div> : <div className="space-y-3">
        {jobs.map((job) => <article key={job.id} className="ui-panel space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-medium">{job.place.name}</h3><p className="text-sm text-muted-foreground">{job.place.address ?? [job.place.lat, job.place.lng].filter((value) => value != null).join(', ') || 'No address'}</p></div><span className="rounded-full bg-muted px-2 py-1 text-xs font-medium capitalize">{job.status}</span></div>
          {job.lastError && <p className="flex gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />{job.lastError}</p>}
          {job.status === 'ambiguous' && <div className="space-y-2 border-t pt-3"><p className="text-sm font-medium">Choose the correct Google Place</p>{job.candidates?.map((candidate) => <div key={candidate.googlePlaceId} className="flex flex-wrap items-center justify-between gap-2 rounded-control border p-3"><div><p className="text-sm font-medium">{candidate.name}</p><p className="text-xs text-muted-foreground">{candidate.address ?? 'No address'}</p></div><button type="button" className="ui-button ui-button-secondary" disabled={action.isPending} onClick={() => action.mutate({ id: job.id, action: 'select-candidate', googlePlaceId: candidate.googlePlaceId })}>Use this place</button></div>)}</div>}
          <div className="flex flex-wrap gap-2"><button type="button" className="ui-button ui-button-secondary" disabled={action.isPending} onClick={() => action.mutate({ id: job.id, action: 'retry' })}><RefreshCw className="mr-1 h-4 w-4" />Retry</button><button type="button" className="ui-button ui-button-secondary" disabled={action.isPending} onClick={() => action.mutate({ id: job.id, action: 'skip' })}><SkipForward className="mr-1 h-4 w-4" />Skip</button></div>
        </article>)}
      </div>}
    </section>
  )
}
