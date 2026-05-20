import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/collections/')({
  component: Collections,
})

function Collections() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Collections</h1>
      <p className="text-muted-foreground">No collections yet.</p>
    </div>
  )
}
