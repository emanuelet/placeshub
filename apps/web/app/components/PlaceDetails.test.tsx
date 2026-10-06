import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { saveNotes } = vi.hoisted(() => ({ saveNotes: vi.fn() }))
vi.mock('@/hooks/usePlaces', () => ({
  useUpdateSavedPlace: () => ({ mutateAsync: saveNotes, isPending: false }),
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params }: { children: React.ReactNode; params: { collectionId: string } }) => (
    <a href={`/collections/${params.collectionId}`}>{children}</a>
  ),
}))

import { PlaceDetails } from './PlaceDetails'

describe('place details', () => {
  beforeEach(() => {
    saveNotes.mockReset().mockResolvedValue({})
  })

  it('shows known details and edits personal notes without replacing imported notes', async () => {
    render(
      <PlaceDetails
        place={{
          id: 'place-1',
          name: 'Cafe',
          googlePlaceId: 'ChIJexample',
          address: 'Main St',
          rating: 4.7,
          metadata: { imageUrl: 'https://example.com/cafe.jpg' },
        }}
        personalNotes="My first note"
        importedNotes="Google list note"
        savedPlaceId="save-1"
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Google list note:').parentElement).toHaveTextContent(
      'Google list note: Google list note',
    )
    expect(screen.getByText('My first note')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View on Google Maps/ })).toHaveAttribute(
      'href',
      expect.stringContaining('query_place_id=ChIJexample'),
    )
    expect(screen.getByRole('img', { name: 'Cafe' }).nextElementSibling).toBe(
      screen.getByRole('link', { name: /View on Google Maps/ }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Personal notes (optional)' }), {
      target: { value: 'A better coffee' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save notes' }))
    await waitFor(() =>
      expect(saveNotes).toHaveBeenCalledWith({
        id: 'save-1',
        notes: 'A better coffee',
      }),
    )
  })

  it('clears optional notes without deleting the place', async () => {
    render(
      <PlaceDetails
        place={{ id: 'place-1', name: 'Cafe' }}
        personalNotes="Remove this note"
        savedPlaceId="save-1"
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Personal notes (optional)' }), {
      target: { value: ' ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save notes' }))
    await waitFor(() => expect(saveNotes).toHaveBeenCalledWith({ id: 'save-1', notes: null }))
  })

  it('links imported My Maps pins by coordinates instead of treating synthetic IDs as Google Place IDs', () => {
    render(
      <PlaceDetails
        place={{
          id: 'pin-1',
          name: 'Beach',
          googlePlaceId: 'mymaps:abc',
          lat: -8.7,
          lng: 115.1,
        }}
        importedNotes="Sunset"
        importedNotesLabel="Collection note"
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Collection note:').parentElement).toHaveTextContent('Sunset')
    const href = screen.getByRole('link', { name: /View on Google Maps/ }).getAttribute('href')
    expect(href).toContain('query=-8.7%2C115.1')
    expect(href).not.toContain('query_place_id')
  })

  it('combines categories and types and keeps coordinates in a collapsed bottom section', () => {
    render(
      <PlaceDetails
        place={{
          id: 'place-1',
          name: 'Cafe',
          lat: 0,
          lng: 115.1,
          types: ['cafe', 'point_of_interest'],
          metadata: {
            category: ['Cafe', 'cafe'],
            dateAdded: '2026-10-01T12:00:00Z',
            dateUpdated: '2026-10-02T12:00:00Z',
          },
        }}
        collections={[{ id: 'trip', title: 'Trip', notes: 'Meet here' }]}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Cafe · point of interest')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Collections' })).toHaveTextContent(
      'Collection note: Meet here',
    )
    expect(screen.getByRole('link', { name: 'Trip' })).toHaveAttribute('href', '/collections/trip')
    const accordion = screen.getByText('Coordinates').closest('details')
    expect(accordion).not.toHaveAttribute('open')
    expect(accordion).toHaveTextContent('Latitude0Longitude115.1')
    const footer = screen.getByRole('complementary', { name: 'Place details' }).lastElementChild
    expect(footer?.lastElementChild).toBe(accordion)
    expect(footer).toHaveTextContent('Added: 01/10/2026Updated: 02/10/2026')
    expect(footer).toHaveClass('mt-auto')
  })
})
