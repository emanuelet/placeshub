import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/share/$slug')({
  component: SharedView,
})

function SharedView() {
  const { slug } = Route.useParams() as { slug: string }
  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-80px)]">
      <div className="flex-1 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
        Shared collection map: {slug}
      </div>
      <aside className="h-48 border rounded-lg p-4 overflow-y-auto">
        <h2 className="font-semibold mb-4">Places</h2>
        <p className="text-sm text-muted-foreground">Place cards with notes and Google Maps links.</p>
      </aside>
    </div>
  )
}
