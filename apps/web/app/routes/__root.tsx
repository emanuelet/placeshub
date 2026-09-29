import { Logo } from '@repo/ui/logo'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Layers3, LayoutDashboard, Monitor, Moon, Settings2, Sun } from 'lucide-react'
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
  const [sidebarSide] = useLocalStorage<'left' | 'right'>('sidebar-side', 'right')

  const showMap =
    location.pathname === '/dashboard' ||
    location.pathname.startsWith('/collections/') ||
    location.pathname === '/collections' ||
    location.pathname.startsWith('/share/')

  return (
    <div
      className={
        showMap
          ? `flex flex-col gap-4 lg:grid lg:h-[calc(100dvh-92px)] lg:min-h-[32rem] ${
              sidebarSide === 'left'
                ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]'
                : 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]'
            }`
          : ''
      }
    >
      <div
        className={`relative h-[38vh] min-h-72 overflow-hidden rounded-panel sm:h-[48vh] lg:h-full ${showMap ? (sidebarSide === 'left' ? 'lg:order-2' : 'lg:order-1') : 'hidden'}`}
      >
        <div ref={containerRef} className="h-full min-h-72 w-full" />
        {!mapLoaded && showMap && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <p className="text-muted-foreground">Loading map...</p>
          </div>
        )}
      </div>
      <div
        className={
          showMap
            ? `min-w-0 lg:min-h-0 ${sidebarSide === 'left' ? 'lg:order-1' : 'lg:order-2'}`
            : 'mx-auto w-full max-w-5xl'
        }
      >
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
          <Link to="/" aria-label="PlacesHub home" className="mr-2 text-lg text-foreground">
            <Logo />
          </Link>
          <Link to="/dashboard" className="ui-button ui-button-quiet min-h-9 gap-1.5 px-2">
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Dashboard
          </Link>
          <Link to="/collections" className="ui-button ui-button-quiet min-h-9 gap-1.5 px-2">
            <Layers3 className="h-4 w-4" aria-hidden="true" /> Collections
          </Link>
          <Link
            to="/settings"
            search={{ tab: 'google-sync' }}
            className="ui-button ui-button-quiet min-h-9 gap-1.5 px-2"
          >
            <Settings2 className="h-4 w-4" aria-hidden="true" /> Settings
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <AuthNav />
          </div>
        </nav>
        <main className="w-full p-3 sm:p-5">
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
