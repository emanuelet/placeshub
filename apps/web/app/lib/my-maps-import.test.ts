import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { parseGeoJson, parseMyMapsFile, parseMyMapsKml } from './my-maps-import'

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

  it('imports a KMZ, ignoring bundled icon images', async () => {
    const archive = new JSZip()
    archive.file('doc.kml', simpleKml)
    archive.file('images/pin.png', new Uint8Array([137, 80, 78, 71]))
    const bytes = await archive.generateAsync({ type: 'uint8array' })
    const file = {
      name: 'weekend.kmz',
      size: bytes.byteLength,
      arrayBuffer: async () => bytes.buffer,
    } as File
    const result = await parseMyMapsFile(file)
    expect(result.title).toBe('Weekend')
    expect(result.places).toHaveLength(2)
    expect(result.skipped).toBe(2)
    expect(
      result.places.every(
        (pin) => pin.name && Number.isFinite(pin.lat) && Number.isFinite(pin.lng),
      ),
    ).toBe(true)
    expect(result.places.filter((pin) => pin.notes)).toHaveLength(1)
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
      'Choose a .kml, .kmz or .geojson',
    )
    await expect(
      parseMyMapsFile({ name: 'map.kmz', size: 11 * 1024 * 1024 } as File),
    ).rejects.toThrow('maximum 10 MB')
  })

  it('imports the provided KML and GeoJSON with identical pins and notes', async () => {
    const kml = readFileSync(resolve(process.cwd(), '../../Bali.kml'), 'utf8')
    const json = readFileSync(resolve(process.cwd(), '../../converted.geojson'), 'utf8')
    const fromKml = parseMyMapsKml(kml)
    const fromJson = await parseMyMapsFile({
      name: 'converted.geojson',
      size: json.length,
      text: async () => json,
    } as File)
    expect(fromKml.places).toHaveLength(42)
    expect(fromJson.places).toEqual(fromKml.places)
    expect(fromJson.skipped).toBe(0)
  })

  it('skips duplicate, invalid and non-point GeoJSON features without swapping coordinates', () => {
    const point = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [115.1, -8.7] },
      properties: { name: 'Cafe', description: 'Coffee' },
    }
    const result = parseGeoJson(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          point,
          point,
          null,
          { ...point, geometry: { type: 'Point', coordinates: [0, 100] } },
          { ...point, geometry: { type: 'LineString', coordinates: [] } },
        ],
      }),
    )
    expect(result.places).toEqual([{ name: 'Cafe', lat: -8.7, lng: 115.1, notes: 'Coffee' }])
    expect(result.skipped).toBe(4)
    expect(() => parseGeoJson('{}')).toThrow('FeatureCollection')
    expect(() => parseGeoJson('{')).toThrow('not valid GeoJSON')
  })
})
