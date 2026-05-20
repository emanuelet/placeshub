import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export const Route = createRootRoute({
  component: () => (
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
        </nav>
        <main className="p-4">
          <Outlet />
        </main>
      </div>
      <TanStackRouterDevtools />
    </>
  ),
})
