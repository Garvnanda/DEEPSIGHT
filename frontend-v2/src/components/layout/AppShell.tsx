import { Outlet, useLocation } from 'react-router-dom'

import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell() {
  const { pathname } = useLocation()
  // one key per "screen"  the console keeps a single key across /surveys/:id
  const key = pathname.startsWith('/surveys/') ? 'console' : pathname

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="relative flex-1 overflow-hidden">
            {/* CSS-only enter animation  keyed remount, nothing to wedge */}
            <div
              key={key}
              className="h-full overflow-y-auto duration-200 animate-in fade-in slide-in-from-bottom-2"
            >
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}
