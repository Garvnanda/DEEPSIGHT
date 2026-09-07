import { useEffect, useState } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getHealth } from '@/lib/api'
import { cn } from '@/lib/utils'

type State = 'ok' | 'down' | 'checking'

export function HealthDot() {
  const [state, setState] = useState<State>('checking')

  useEffect(() => {
    let alive = true
    const ping = async () => {
      try {
        const r = await getHealth()
        if (alive) setState(r.status === 'ok' ? 'ok' : 'down')
      } catch {
        if (alive) setState('down')
      }
    }
    ping()
    const t = setInterval(ping, 10_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  const label =
    state === 'ok' ? 'Backend online' : state === 'down' ? 'Backend unreachable' : 'Checking backend…'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
          <span className="relative flex size-2">
            {state === 'ok' && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60" />
            )}
            <span
              className={cn(
                'relative inline-flex size-2 rounded-full',
                state === 'ok' && 'bg-ok',
                state === 'down' && 'bg-destructive',
                state === 'checking' && 'bg-warn',
              )}
            />
          </span>
          <span className="hidden sm:inline">API</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
