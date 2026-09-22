import { QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect } from 'react'
import { useLocalStorage, useMediaQuery } from 'usehooks-ts'
import { AuthProvider, useAuth } from '@/lib/auth'
import { MapProvider, useMapManager } from '@/lib/mapContext'
import { queryClient } from '@/lib/query'

function ThemeToggle() {
  const [isDark, setIsDark] = useLocalStorage('theme', 'system')
  const systemPrefersDark = useMediaQuery('(prefers-color-scheme: dark)')

  const isDarkMode = isDark === 'dark' || (isDark === 'system' && systemPrefersDark)

  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return
    root.classList.toggle('dark', isDarkMode)
  }, [isDarkMode])

  const toggle = () => {
    setIsDark((prev) => {
      if (prev === 'system') return systemPrefersDark ? 'light' : 'dark'
      return prev === 'dark' ? 'light' : 'dark'
    })
  }

  const Icon = isDark === 'system' ? Monitor : isDarkMode ? Moon : Sun

  return (
    <button
      type="button"
      onClick={toggle}
      className="ui-button ui-button-secondary min-h-9 px-2"
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function AuthNav() {
  const { user, signOut, loading } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/auth/login' })
  }

  if (loading) return null

  return (
    <>
      {user ? (
        <button
          type="button"
          onClick={handleSignOut}
          className="ui-button ui-button-quiet min-h-9 px-2"
        >
          Sign out
        </button>
      ) : (
        <Link to="/auth/login" className="ui-button ui-button-quiet min-h-9 px-2">
          Sign in
        </Link>
      )}
    </>
  )
}

function MapLayout() {
  const { containerRef, mapLoaded } = useMapManager()
  const location = useLocation()

  const showMap =
    location.pathname === '/dashboard' ||
    location.pathname.startsWith('/collections/') ||
    location.pathname === '/collections' ||
    location.pathname.startsWith('/share/')

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-92px)] lg:flex-row">
      <div
        className={`relative min-h-72 overflow-hidden rounded-panel lg:flex-1 ${showMap ? 'block' : 'hidden'}`}
      >
        <div ref={containerRef} className="h-full min-h-72 w-full" />
        {!mapLoaded && showMap && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <p className="text-muted-foreground">Loading map...</p>
          </div>
        )}
      </div>
      <div className={showMap ? 'w-full lg:w-[23rem] lg:shrink-0' : 'mx-auto w-full max-w-5xl'}>
        <Outlet />
      </div>
    </div>
  )
}

function RootLayout() {
  return (
    <>
      <div className="min-h-screen bg-canvas font-sans">
        <nav className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b bg-surface px-3 py-3 sm:px-5">
          <Link to="/" className="mr-2 text-lg font-bold tracking-tight text-foreground">
            PlacesHub
          </Link>
          <Link to="/dashboard" className="ui-button ui-button-quiet min-h-9 px-2">
            Dashboard
          </Link>
          <Link to="/collections" className="ui-button ui-button-quiet min-h-9 px-2">
            Collections
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <AuthNav />
          </div>
        </nav>
        <main className="mx-auto max-w-[1600px] p-3 sm:p-5">
          <MapProvider>
            <MapLayout />
          </MapProvider>
        </main>
      </div>
      <TanStackRouterDevtools />
    </>
  )
}

export const Route = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootLayout />
      </AuthProvider>
    </QueryClientProvider>
  ),
})
