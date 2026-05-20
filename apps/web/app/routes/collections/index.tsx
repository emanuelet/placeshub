import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useCollections, useCreateCollection } from '@/hooks/useCollections'

export const Route = createFileRoute('/collections/')({
  component: Collections,
})

function Collections() {
  const navigate = useNavigate()
  const { data, isLoading } = useCollections()
  const createCollection = useCreateCollection()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title) return
    const { collection } = await createCollection.mutateAsync({
      title,
      description: description || undefined,
    })
    navigate({ to: '/collections/$collectionId', params: { collectionId: collection.id } })
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-[calc(100vh-80px)]">Loading...</div>
  }

  const collections = data?.collections ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Collections</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ New Collection'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 border rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              rows={2}
            />
          </div>
          <button
            type="submit"
            disabled={createCollection.isPending}
            className="bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {createCollection.isPending ? 'Creating...' : 'Create'}
          </button>
        </form>
      )}

      {collections.length === 0 && !showForm && (
        <p className="text-muted-foreground">No collections yet. Create one to get started.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {collections.map((collection) => (
          <button
            key={collection.id}
            onClick={() =>
              navigate({
                to: '/collections/$collectionId',
                params: { collectionId: collection.id },
              })
            }
            className="border rounded-lg p-4 hover:bg-muted transition-colors text-left block w-full"
          >
            <h3 className="font-semibold">{collection.title}</h3>
            {collection.description && (
              <p className="text-sm text-muted-foreground mt-1">{collection.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Created {new Date(collection.createdAt).toLocaleDateString()}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
