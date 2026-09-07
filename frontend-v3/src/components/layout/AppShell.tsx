import { Outlet, useLocation } from 'react-router-dom'

import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { TopNav } from './TopNav'

export function AppShell() {
  const { pathname } = useLocation()
  const isConsole = /^\/(console|surveys)\/[^/]+/.test(pathname)
  const key = isConsole ? 'console' : pathname

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
        <TopNav />
        <main className="relative flex-1 overflow-y-auto">
          <div
            key={key}
            className={cn('duration-200 animate-in fade-in', isConsole ? 'h-full' : 'min-h-full')}
          >
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}
