import mapboxgl from 'mapbox-gl'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useLocalStorage, useMediaQuery } from 'usehooks-ts'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

export interface MapPlace {
  id: string
  name: string
  lat: number
  lng: number
  address?: string
  rating?: number
  notes?: string
}

interface MapManagerValue {
  containerRef: React.RefObject<HTMLDivElement | null>
  mapLoaded: boolean
  setPlaces: (places: MapPlace[]) => void
  setOnPlaceClick: (handler: ((place: MapPlace) => void) | null) => void
  setOnMapClick: (handler: ((lat: number, lng: number) => void) | null) => void
  flyTo: (lat: number, lng: number, zoom?: number) => void
}

const MapManagerContext = createContext<MapManagerValue | null>(null)

export function useMapManager() {
  const ctx = useContext(MapManagerContext)
  if (!ctx) throw new Error('useMapManager must be used within MapProvider')
  return ctx
}

let mapInstance: mapboxgl.Map | null = null
const markers: mapboxgl.Marker[] = []
let onPlaceClickHandler: ((place: MapPlace) => void) | null = null
let currentPlaces: MapPlace[] = []

function renderMarkers() {
  if (!mapInstance) return
  for (const m of markers) {
    m.remove()
  }
  markers.length = 0

  const handler = onPlaceClickHandler

  currentPlaces.forEach((place) => {
    const el = document.createElement('div')
    el.className =
      'w-8 h-8 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center cursor-pointer hover:bg-blue-700 hover:scale-110 transition-all'
    el.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>'

    if (handler) {
      el.addEventListener('click', () => handler(place))
    }

    const marker = new mapboxgl.Marker({ element: el }).setLngLat([place.lng, place.lat]).setPopup(
      new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 4px; min-width: 150px;">
            <strong style="font-size: 14px;">${place.name}</strong>
            ${place.address ? `<p style="font-size: 12px; color: #666; margin: 4px 0;">${place.address}</p>` : ''}
            ${place.rating ? `<p style="font-size: 12px; margin: 4px 0;">Rating: ${place.rating} / 5</p>` : ''}
            ${place.notes ? `<p style="font-size: 12px; margin: 4px 0; font-style: italic;">${place.notes}</p>` : ''}
          </div>
        `),
    )

    if (mapInstance) {
      marker.addTo(mapInstance)
    }
    markers.push(marker)
  })
}

export function MapProvider({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [theme] = useLocalStorage('theme', 'system')
  const systemPrefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemPrefersDark)

  useEffect(() => {
    const container = containerRef.current
    if (!container || mapInstance) return

    const style = isDarkMode
      ? 'mapbox://styles/mapbox/dark-v11'
      : 'mapbox://styles/mapbox/streets-v12'

    mapInstance = new mapboxgl.Map({
      container,
      style,
      center: [153.0251, -27.4698],
      zoom: 12,
    })

    mapInstance.addControl(new mapboxgl.NavigationControl(), 'top-right')
    mapInstance.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: true,
        showUserHeading: true,
      }),
    )
    mapInstance.on('load', () => setMapLoaded(true))

    return () => {
      if (mapInstance) {
        mapInstance.remove()
        mapInstance = null
        markers.length = 0
        setMapLoaded(false)
      }
    }
  }, [isDarkMode])

  const setPlaces = useCallback((places: MapPlace[]) => {
    currentPlaces = places
    renderMarkers()
  }, [])

  const setOnPlaceClick = useCallback((handler: ((place: MapPlace) => void) | null) => {
    onPlaceClickHandler = handler
    renderMarkers()
  }, [])

  const setOnMapClick = useCallback((handler: ((lat: number, lng: number) => void) | null) => {
    if (!mapInstance) return
    if (handler) {
      mapInstance.on('click', (e) => handler(e.lngLat.lat, e.lngLat.lng))
    }
  }, [])

  const flyTo = useCallback((lat: number, lng: number, zoom?: number) => {
    if (!mapInstance) return
    mapInstance.flyTo({ center: [lng, lat], zoom: zoom ?? 15, essential: true })
  }, [])

  return (
    <MapManagerContext.Provider
      value={{ containerRef, mapLoaded, setPlaces, setOnPlaceClick, setOnMapClick, flyTo }}
    >
      {children}
    </MapManagerContext.Provider>
  )
}
