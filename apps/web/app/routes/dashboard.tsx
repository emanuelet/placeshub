import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard')({
  component: Dashboard,
})

function Dashboard() {
  return (
    <div className="flex gap-4 h-[calc(100vh-80px)]">
      <div className="flex-1 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
        Mapbox map will render here
      </div>
      <aside className="w-80 border rounded-lg p-4 overflow-y-auto">
        <h2 className="font-semibold mb-4">Saved Places</h2>
        <p className="text-sm text-muted-foreground">No places saved yet.</p>
      </aside>
    </div>
  )
}
