import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useCollections, useCreateCollection } from '@/hooks/useCollections'

export const Route = createFileRoute('/collections/')({
  component: Collections,
})

function Collections() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useCollections()
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

  if (error) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Couldn't load collections</h1>
        <p className="text-muted-foreground">{error.message}</p>
      </div>
    )
  }

  const collections = data?.collections ?? []

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="ui-page-title">Collections</h1>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="ui-button ui-button-primary"
        >
          {showForm ? 'Cancel' : '+ New Collection'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="ui-panel mb-6 space-y-4 p-4 sm:p-5">
          <div>
            <label htmlFor="collection-title" className="ui-field-label">
              Title
            </label>
            <input
              id="collection-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="ui-input"
              required
            />
          </div>
          <div>
            <label htmlFor="collection-description" className="ui-field-label">
              Description
            </label>
            <textarea
              id="collection-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="ui-input resize-y"
              rows={2}
            />
          </div>
          <button
            type="submit"
            disabled={createCollection.isPending}
            className="ui-button ui-button-primary"
          >
            {createCollection.isPending ? 'Creating...' : 'Create'}
          </button>
        </form>
      )}

      {collections.length === 0 && !showForm && (
        <p className="ui-empty-state">No collections yet. Create one to get started.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {collections.map((collection) => (
          <button
            key={collection.id}
            type="button"
            onClick={() =>
              navigate({
                to: '/collections/$collectionId',
                params: { collectionId: collection.id },
              })
            }
            className="ui-panel w-full p-4 text-left transition-colors hover:bg-muted"
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
