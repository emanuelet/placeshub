import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (opts: { component: unknown }) => opts,
  useNavigate: () => vi.fn(),
}))

vi.mock('@/hooks/useCollections', () => ({
  useCollections: () => ({
    data: undefined,
    isLoading: false,
    error: new Error('Network down'),
  }),
  useCreateCollection: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

import { Route } from './index'

describe('Collections route', () => {
  it('renders an error message instead of hanging when the query fails', () => {
    const Collections = (Route as unknown as { component: React.ComponentType }).component
    render(<Collections />)

    expect(screen.getByText(/couldn't load collections/i)).toBeInTheDocument()
    expect(screen.getByText('Network down')).toBeInTheDocument()
  })
})
