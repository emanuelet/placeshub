import { describe, expect, it } from 'vitest'
import { buildPopupContent, toMapPlace } from '@/lib/mapContext'

describe('buildPopupContent', () => {
  it('renders place fields as text, not HTML', () => {
    const el = buildPopupContent({
      id: '1',
      name: '<img src=x onerror=alert(1)>',
      lat: 0,
      lng: 0,
      address: '<script>alert(2)</script>',
      notes: '<b>bold</b>',
    })

    expect(el.querySelector('img')).toBeNull()
    expect(el.querySelector('script')).toBeNull()
    expect(el.querySelector('b')).toBeNull()
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>')
    expect(el.textContent).toContain('<script>alert(2)</script>')
  })

  it('omits optional fields that are not present', () => {
    const el = buildPopupContent({ id: '1', name: 'Cafe', lat: 0, lng: 0 })
    expect(el.querySelectorAll('p').length).toBe(0)
  })
})

describe('toMapPlace', () => {
  it('skips places without coordinates', () => {
    const result = toMapPlace({
      id: '1',
      name: 'Cafe',
      lat: null,
      lng: null,
      address: null,
      rating: null,
    })
    expect(result).toBeNull()
  })

  it('passes through real values and notes', () => {
    const result = toMapPlace(
      { id: '1', name: 'Cafe', lat: 1.5, lng: 2.5, address: '123 St', rating: 4 },
      'great coffee',
    )
    expect(result).toEqual({
      id: '1',
      name: 'Cafe',
      lat: 1.5,
      lng: 2.5,
      address: '123 St',
      rating: 4,
      notes: 'great coffee',
    })
  })
})
