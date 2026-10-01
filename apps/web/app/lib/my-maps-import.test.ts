import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseMyMapsFile, parseMyMapsKml } from './my-maps-import'

const simpleKml = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <name>Weekend</name><Folder><name>Food</name>
    <Placemark><name>Café</name><description>Try the coffee</description><Point><coordinates>115.1,-8.7,0</coordinates></Point></Placemark>
    <Placemark><name>Road</name><LineString><coordinates>115.1,-8.7 115.2,-8.6</coordinates></LineString></Placemark>
  </Folder><Folder><name>Views</name>
    <Placemark><name>Cliff</name><Point><coordinates>115.2,-8.6,0</coordinates></Point></Placemark>
    <Placemark><name>Café</name><Point><coordinates>115.1,-8.7,0</coordinates></Point></Placemark>
  </Folder></Document></kml>`

describe('Google My Maps import', () => {
  it('combines layers, keeps pin descriptions and skips non-points and duplicate pins', () => {
    expect(parseMyMapsKml(simpleKml)).toEqual({
      title: 'Weekend',
      places: [
        { name: 'Café', lat: -8.7, lng: 115.1, notes: 'Try the coffee' },
        { name: 'Cliff', lat: -8.6, lng: 115.2, notes: null },
      ],
      skipped: 2,
    })
  })

  it('accepts a standalone KML file', async () => {
    const file = {
      name: 'weekend.kml',
      size: simpleKml.length,
      text: async () => simpleKml,
    } as File
    expect((await parseMyMapsFile(file)).places).toHaveLength(2)
  })

  it('imports the provided KMZ, ignoring bundled icon images', async () => {
    const bytes = readFileSync(resolve(process.cwd(), '../../Bali.kmz'))
    const file = {
      name: 'Bali.kmz',
      size: bytes.byteLength,
      arrayBuffer: async () => Uint8Array.from(bytes).buffer,
    } as File
    const result = await parseMyMapsFile(file)
    expect(result.title).toBe('Bali')
    expect(result.places).toHaveLength(42)
    expect(result.skipped).toBe(0)
    expect(
      result.places.every(
        (pin) => pin.name && Number.isFinite(pin.lat) && Number.isFinite(pin.lng),
      ),
    ).toBe(true)
    expect(result.places.filter((pin) => pin.notes)).toHaveLength(39)
  })

  it('rejects malformed and empty maps', () => {
    expect(() => parseMyMapsKml('<kml><Document>')).toThrow('not valid KML')
    expect(() => parseMyMapsKml('<kml><Document><name>Empty</name></Document></kml>')).toThrow(
      'No point pins',
    )
    expect(() => parseMyMapsKml('<!DOCTYPE kml><kml/>')).toThrow('document types')
  })

  it('rejects unsupported and oversized uploads before parsing', async () => {
    await expect(parseMyMapsFile({ name: 'map.zip', size: 1 } as File)).rejects.toThrow(
      'Choose a .kml or .kmz',
    )
    await expect(
      parseMyMapsFile({ name: 'map.kmz', size: 11 * 1024 * 1024 } as File),
    ).rejects.toThrow('maximum 10 MB')
  })
})
