import { Outlet, useLocation } from 'react-router-dom'

import { BlobCursor } from '@/components/reactbits/BlobCursor'
import { ClickSpark } from '@/components/reactbits/ClickSpark'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useResolvedColors } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { TopNav } from './TopNav'

export function AppShell() {
  const { pathname } = useLocation()
  const colors = useResolvedColors()
  // the console is an instrument: no cursor toys, no sparks, motion only where data moves
  const isConsole = /^\/(console|surveys)\/[^/]+/.test(pathname)
  const key = isConsole ? 'console' : pathname

  const page = (
    <div
      key={key}
      className={cn('duration-200 animate-in fade-in', isConsole ? 'h-full' : 'min-h-full')}
    >
      <Outlet />
    </div>
  )

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
        <TopNav />
        <main className="relative flex-1 overflow-y-auto">
          {isConsole ? (
            page
          ) : (
            <>
              <BlobCursor
                zIndex={5}
                fillColor={colors['--accent']}
                trailCount={3}
                sizes={[46, 90, 50]}
                innerSizes={[16, 28, 18]}
              />
              <ClickSpark
                sparkColor={colors['--accent']}
                sparkCount={8}
                sparkRadius={20}
                sparkSize={9}
                duration={420}
              >
                {page}
              </ClickSpark>
            </>
          )}
        </main>
      </div>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}
