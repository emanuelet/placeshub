import { Logo } from '@repo/ui/logo'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  createRootRoute,
  Link,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Layers3, LayoutDashboard, Menu, Monitor, Moon, Settings2, Sun, X } from 'lucide-react'
import { useEffect, useState } from 'react'
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
      className="ui-button ui-button-secondary min-h-11 min-w-11 px-2 md:min-h-9 md:min-w-0"
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function AuthNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut, loading } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/' })
    onNavigate?.()
  }

  if (loading) return null

  return (
    <>
      {user ? (
        <button
          type="button"
          onClick={handleSignOut}
          className="ui-button ui-button-quiet min-h-11 w-full justify-start px-3 md:min-h-9 md:w-auto"
        >
          Sign out
        </button>
      ) : (
        <Link
          to="/auth/login"
          onClick={onNavigate}
          className="ui-button ui-button-quiet min-h-11 w-full justify-start px-3 md:min-h-9 md:w-auto"
        >
          Sign in
        </Link>
      )}
    </>
  )
}

function MapLayout() {
  const { containerRef, mapLoaded } = useMapManager()
  const location = useLocation()
  const { user, loading } = useAuth()
  const [sidebarSide] = useLocalStorage<'left' | 'right'>('sidebar-side', 'right')

  const publicPage =
    location.pathname === '/' ||
    location.pathname === '/privacy' ||
    location.pathname.startsWith('/auth/') ||
    location.pathname.startsWith('/share/')

  const showMap =
    location.pathname === '/dashboard' ||
    location.pathname.startsWith('/collections/') ||
    location.pathname === '/collections' ||
    location.pathname.startsWith('/share/')

  if (!publicPage && loading) return null
  if (!publicPage && !user) return <Navigate to="/" replace />

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { pathname } = useLocation()
  const { user, loading } = useAuth()
  const showAppNavigation = !loading && !!user

  return (
    <>
      <div className="min-h-screen bg-canvas font-sans">
        <nav aria-label="Main navigation" className="border-b bg-surface">
          <div className="flex items-center gap-2 px-3 py-3 sm:px-5">
            <Link
              to="/"
              aria-label="PlacesHub home"
              onClick={() => setMobileNavOpen(false)}
              className="mr-2 shrink-0 text-lg text-foreground"
            >
              <Logo />
            </Link>
            {showAppNavigation && (
              <div className="hidden items-center gap-2 md:flex">
                <Link to="/dashboard" className="ui-button ui-button-quiet min-h-9 gap-1.5 px-2">
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Dashboard
                </Link>
                <Link to="/collections" className="ui-button ui-button-quiet min-h-9 gap-1.5 px-2">
                  <Layers3 className="h-4 w-4" aria-hidden="true" /> Collections
                </Link>
              </div>
            )}
            <div className="ml-auto flex items-center gap-1">
              {showAppNavigation && (
                <Link
                  to="/settings"
                  search={{ tab: 'google-sync' }}
                  className="ui-button ui-button-quiet hidden min-h-9 gap-1.5 px-2 md:inline-flex"
                >
                  <Settings2 className="h-4 w-4" aria-hidden="true" /> Settings
                </Link>
              )}
              <ThemeToggle />
              <div className={showAppNavigation ? 'hidden md:block' : ''}>
                <AuthNav />
              </div>
              {showAppNavigation && (
                <button
                  type="button"
                  className="ui-button ui-button-secondary min-h-11 min-w-11 px-2 md:hidden"
                  aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
                  aria-expanded={mobileNavOpen}
                  aria-controls="mobile-navigation"
                  onClick={() => setMobileNavOpen((open) => !open)}
                >
                  {mobileNavOpen ? (
                    <X className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Menu className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              )}
            </div>
          </div>
          {showAppNavigation && (
            <div
              id="mobile-navigation"
              hidden={!mobileNavOpen}
              className="border-t px-3 py-2 md:hidden"
            >
              <div className="grid gap-1">
                <Link
                  to="/dashboard"
                  onClick={() => setMobileNavOpen(false)}
                  aria-current={pathname === '/dashboard' ? 'page' : undefined}
                  className="ui-button ui-button-quiet min-h-11 justify-start gap-2 px-3"
                >
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Dashboard
                </Link>
                <Link
                  to="/collections"
                  onClick={() => setMobileNavOpen(false)}
                  aria-current={pathname.startsWith('/collections') ? 'page' : undefined}
                  className="ui-button ui-button-quiet min-h-11 justify-start gap-2 px-3"
                >
                  <Layers3 className="h-4 w-4" aria-hidden="true" /> Collections
                </Link>
                <Link
                  to="/settings"
                  search={{ tab: 'google-sync' }}
                  onClick={() => setMobileNavOpen(false)}
                  aria-current={pathname === '/settings' ? 'page' : undefined}
                  className="ui-button ui-button-quiet min-h-11 justify-start gap-2 px-3"
                >
                  <Settings2 className="h-4 w-4" aria-hidden="true" /> Settings
                </Link>
                <div className="border-t pt-1">
                  <AuthNav onNavigate={() => setMobileNavOpen(false)} />
                </div>
              </div>
            </div>
          )}
        </nav>
        <main className="w-full p-3 sm:p-5">
          <MapProvider>
            <MapLayout />
          </MapProvider>
        </main>
      </div>
      {import.meta.env.DEV && <TanStackRouterDevtools />}
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
