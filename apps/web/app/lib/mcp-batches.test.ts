import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getDb, end, insert } = vi.hoisted(() => ({ getDb: vi.fn(), end: vi.fn(), insert: vi.fn() }))
vi.mock('../../../api/src/lib/db', () => ({ getDb }))

import {
  changeMembership,
  deleteSavedPlaces,
  savePlaces,
  updatePlace,
  updateSavedPlaces,
} from '../../../api/src/lib/mcp-places'

const first = '10000000-0000-4000-8000-000000000001'
const missing = '20000000-0000-4000-8000-000000000002'

describe('MCP batch transactions', () => {
  let saved: string[]
  let memberships: string[]

  beforeEach(() => {
    saved = [first]
    memberships = [first]
    end.mockReset()
    insert.mockReset()
    getDb.mockReset().mockImplementation(() => ({
      client: { end },
      db: {
        transaction: async (work: (tx: object) => Promise<unknown>) => {
          const savedBefore = [...saved]
          const membersBefore = [...memberships]
          try {
            return await work({
              update: () => ({
                set: () => ({
                  where: () => ({
                    returning: async () => {
                      return saved.splice(0, 1).map((id) => ({ id }))
                    },
                  }),
                }),
              }),
              delete: () => ({
                where: () => ({
                  returning: async () => {
                    const removed = [...saved]
                    saved = []
                    return removed.map((id) => ({ id }))
                  },
                }),
              }),
              select: () => ({
                from: () => ({
                  where: () => ({
                    for: async () => [{ id: 'collection' }],
                    limit: async () => [],
                    // biome-ignore lint/suspicious/noThenProperty: Drizzle query builders are intentionally awaitable.
                    then: (resolve: (value: { placeId: string }[]) => void) =>
                      resolve([{ placeId: first }]),
                  }),
                }),
              }),
              insert,
            })
          } catch (error) {
            saved = savedBefore
            memberships = membersBefore
            throw error
          }
        },
      },
    }))
  })

  it('rolls back updates when a later saved place is missing', async () => {
    await expect(
      updateSavedPlaces('unused', 'user-1', [
        { savedPlaceId: first, notes: 'changed' },
        { savedPlaceId: missing, notes: 'changed' },
      ]),
    ).rejects.toThrow('saved place not found')
    expect(saved).toEqual([first])
    expect(end).toHaveBeenCalledOnce()
  })

  it('rolls back deletes when an ID is unowned or missing', async () => {
    await expect(deleteSavedPlaces('unused', 'user-1', [first, missing])).rejects.toThrow(
      'saved place not found',
    )
    expect(saved).toEqual([first])
  })

  it('rejects duplicate IDs before starting a transaction', async () => {
    await expect(deleteSavedPlaces('unused', 'user-1', [first, first])).rejects.toThrow(
      'duplicate items',
    )
    expect(getDb).not.toHaveBeenCalled()
  })

  it('does not add memberships if any saved place is unowned', async () => {
    await expect(
      changeMembership('unused', 'user-1', first, [first, missing], 'add'),
    ).rejects.toThrow('saved place not found')
    expect(memberships).toEqual([first])
    expect(insert).not.toHaveBeenCalled()
  })

  it('rolls back an earlier save if a later place cannot be saved', async () => {
    const persisted: string[] = []
    getDb.mockReturnValueOnce({
      client: { end },
      db: {
        transaction: async (work: (tx: object) => Promise<unknown>) => {
          const before = [...persisted]
          try {
            return await work({
              insert: () => ({
                values: (value: { googlePlaceId?: string }) => ({
                  onConflictDoNothing: () => ({
                    returning: async () => {
                      if (value.googlePlaceId === 'missing') return []
                      if (value.googlePlaceId) persisted.push(value.googlePlaceId)
                      return [{ id: first }]
                    },
                  }),
                  onConflictDoUpdate: () => ({ returning: async () => [{ id: first }] }),
                }),
              }),
              update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
              select: () => ({
                from: () => ({
                  where: () => ({ for: () => ({ limit: async () => [] }) }),
                }),
              }),
            })
          } catch (error) {
            persisted.splice(0, persisted.length, ...before)
            throw error
          }
        },
      },
    })
    await expect(
      savePlaces('unused', 'user-1', [
        { googlePlaceId: 'first', name: 'First' },
        { googlePlaceId: 'missing', name: 'Missing' },
      ]),
    ).rejects.toThrow('place could not be saved')
    expect(persisted).toEqual([])
  })

  it('links an existing place without overwriting its shared fields', async () => {
    const update = vi.fn()
    getDb.mockReturnValueOnce({
      client: { end },
      db: {
        transaction: async (work: (tx: object) => Promise<unknown>) =>
          work({
            insert: () => ({
              values: (value: { googlePlaceId?: string }) =>
                value.googlePlaceId
                  ? { onConflictDoNothing: () => ({ returning: async () => [] }) }
                  : { onConflictDoUpdate: () => ({ returning: async () => [{ id: 'saved-place' }] }) },
            }),
            select: () => ({
              from: () => ({
                where: () => ({ for: () => ({ limit: async () => [{ id: first, name: 'Existing' }] }) }),
              }),
            }),
            update,
          }),
      },
    })

    const [result] = await savePlaces('unused', 'user-1', [
      { googlePlaceId: 'existing', name: 'Untrusted replacement' },
    ])

    expect(result?.place).toEqual({ id: first, name: 'Existing' })
    expect(update).not.toHaveBeenCalled()
  })

  it('only fills missing shared fields when updating a place', async () => {
    const set = vi.fn()
    getDb.mockReturnValueOnce({
      client: { end },
      db: {
        transaction: async (work: (tx: object) => Promise<unknown>) =>
          work({
            select: () => ({
              from: () => ({
                innerJoin: () => ({
                  where: () => ({
                    for: () => ({
                      limit: async () => [
                        {
                          id: first,
                          lat: null,
                          lng: 2,
                          address: 'Existing address',
                          googleMapsUri: null,
                          types: null,
                          phone: null,
                          website: null,
                          rating: null,
                          metadata: null,
                        },
                      ],
                    }),
                  }),
                }),
              }),
            }),
            update: () => ({
              set: (value: object) => {
                set(value)
                return { where: () => ({ returning: async () => [{ id: first, lat: 1 }] }) }
              },
            }),
          }),
      },
    })

    const result = await updatePlace('unused', 'user-1', {
      placeId: first,
      lat: 1,
      address: 'Untrusted replacement',
    })

    expect(set).toHaveBeenCalledWith({ lat: 1, cachedAt: expect.any(Date) })
    expect(result.updatedFields).toEqual(['lat'])
  })
})
