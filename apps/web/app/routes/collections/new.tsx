import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/collections/new')({
  component: NewCollection,
})

function NewCollection() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">New Collection</h1>
      <p className="text-muted-foreground">Form to create a collection.</p>
    </div>
  )
}
