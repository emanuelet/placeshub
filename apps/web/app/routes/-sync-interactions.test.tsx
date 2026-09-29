import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { auth, get, post, copy } = vi.hoisted(() => ({
  auth: { signedIn: true, loading: false },
  get: vi.fn(),
  post: vi.fn(),
  copy: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: { component: unknown }) => options,
  Link: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: auth.signedIn ? { id: 'user-1' } : null, loading: auth.loading }),
}))

vi.mock('@/lib/api', () => ({ api: { get, post, delete: vi.fn() } }))

import { Route } from './sync'

describe('sync page interactions', () => {
  beforeEach(() => {
    auth.signedIn = true
    auth.loading = false
    get.mockReset().mockResolvedValue({ connections: [], lists: [] })
    post.mockReset().mockResolvedValue({ token: 'phs_example' })
    copy.mockReset().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: copy },
      configurable: true,
    })
  })

  it('lets a signed-in user create and copy an extension key, then refresh status', async () => {
    const Sync = (Route as unknown as { component: React.ComponentType }).component
    render(<Sync />)
    await waitFor(() => expect(get).toHaveBeenCalledWith('/sync/connections'))
    fireEvent.click(screen.getByRole('button', { name: 'Create extension key' }))
    expect(await screen.findByRole('textbox', { name: 'Extension key' })).toHaveValue('phs_example')
    fireEvent.click(screen.getByRole('button', { name: 'Copy key' }))
    await waitFor(() => expect(copy).toHaveBeenCalledWith('phs_example'))
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }))
    await waitFor(() => expect(get).toHaveBeenCalledTimes(3))
  })

  it('asks guests to sign in before offering key creation', () => {
    auth.signedIn = false
    const Sync = (Route as unknown as { component: React.ComponentType }).component
    render(<Sync />)
    expect(screen.getByText(/sign in to/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create extension key' })).not.toBeInTheDocument()
    expect(get).not.toHaveBeenCalled()
  })
})
