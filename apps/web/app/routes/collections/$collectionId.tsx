import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/collections/$collectionId')({
  component: CollectionDetail,
})

function CollectionDetail() {
  const { collectionId } = Route.useParams() as { collectionId: string }
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Collection: {collectionId}</h1>
      <p className="text-muted-foreground">Collection detail and share options.</p>
    </div>
  )
}
