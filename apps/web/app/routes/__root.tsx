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
      className="p-1.5 rounded hover:bg-muted transition-colors"
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
        <button type="button" onClick={handleSignOut} className="text-sm hover:underline ml-auto">
          Sign out
        </button>
      ) : (
        <Link to="/auth/login" className="text-sm hover:underline ml-auto">
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
    <div className="flex gap-4 h-[calc(100vh-80px)]">
      <div className={`flex-1 transition-all ${showMap ? 'block' : 'hidden'}`}>
        <div ref={containerRef} className="w-full h-full rounded-lg" />
        {!mapLoaded && showMap && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg">
            <p className="text-muted-foreground">Loading map...</p>
          </div>
        )}
      </div>
      <div className={showMap ? 'w-80' : 'w-full'}>
        <Outlet />
      </div>
    </div>
  )
}

function RootLayout() {
  return (
    <>
      <div className="min-h-screen font-sans">
        <nav className="border-b px-4 py-3 flex items-center gap-6">
          <Link to="/" className="font-bold text-lg">
            PlacesHub
          </Link>
          <Link to="/dashboard" className="text-sm hover:underline">
            Dashboard
          </Link>
          <Link to="/collections" className="text-sm hover:underline">
            Collections
          </Link>
          <div className="ml-auto flex items-center gap-4">
            <ThemeToggle />
            <AuthNav />
          </div>
        </nav>
        <main className="p-4">
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
