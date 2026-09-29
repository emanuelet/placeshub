import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { authState, createCollection } = vi.hoisted(() => ({
  authState: { loggedIn: true, queryFailure: true },
  createCollection: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (opts: { component: unknown }) => opts,
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: authState.loggedIn ? { id: 'user-1' } : null, loading: false }),
}))

vi.mock('@/hooks/useCollections', () => ({
  useCollections: () => ({
    data: authState.queryFailure ? undefined : { collections: [] },
    isLoading: false,
    error: authState.queryFailure ? new Error('Network down') : null,
  }),
  useCreateCollection: () => ({ mutateAsync: createCollection, isPending: false }),
}))

import { Route } from './index'

describe('Collections route', () => {
  beforeEach(() => {
    authState.loggedIn = true
    authState.queryFailure = true
    createCollection.mockReset()
  })

  it('renders an error message instead of hanging when the query fails', () => {
    const Collections = (Route as unknown as { component: React.ComponentType }).component
    render(<Collections />)

    expect(screen.getByText(/couldn't load collections/i)).toBeInTheDocument()
    expect(screen.getByText('Network down')).toBeInTheDocument()
  })

  it('prompts guests to sign in rather than showing a raw unauthorized error', () => {
    authState.loggedIn = false
    const Collections = (Route as unknown as { component: React.ComponentType }).component
    render(<Collections />)

    expect(screen.getByText('Sign in to view your collections')).toBeInTheDocument()
    expect(screen.queryByText('Network down')).not.toBeInTheDocument()
  })

  it('shows collection creation errors without leaving the form', async () => {
    authState.queryFailure = false
    createCollection.mockRejectedValue(new Error('Name already used'))
    const Collections = (Route as unknown as { component: React.ComponentType }).component
    render(<Collections />)

    fireEvent.click(screen.getByRole('button', { name: '+ New Collection' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
      target: { value: 'Coffee' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Name already used')
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Coffee')
  })
})
