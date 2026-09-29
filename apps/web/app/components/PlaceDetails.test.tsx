import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { saveNotes } = vi.hoisted(() => ({ saveNotes: vi.fn() }))
vi.mock('@/hooks/usePlaces', () => ({
  useUpdateSavedPlace: () => ({ mutateAsync: saveNotes, isPending: false }),
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
    fireEvent.click(screen.getByRole('button', { name: 'Edit notes' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Personal notes (optional)' }), {
      target: { value: 'A better coffee' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save notes' }))
    await waitFor(() =>
      expect(saveNotes).toHaveBeenCalledWith({ id: 'save-1', notes: 'A better coffee' }),
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
    fireEvent.click(screen.getByRole('button', { name: 'Edit notes' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Personal notes (optional)' }), {
      target: { value: ' ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save notes' }))
    await waitFor(() => expect(saveNotes).toHaveBeenCalledWith({ id: 'save-1', notes: null }))
  })
})
