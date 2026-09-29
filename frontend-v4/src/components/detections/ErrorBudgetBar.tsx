import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ErrorBudget } from '@/lib/types'
import { cn } from '@/lib/utils'

const SEG = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--cls-nombo)',
  'var(--accent)',
]

export function ErrorBudgetBar({ budget }: { budget: ErrorBudget }) {
  const terms = budget.terms.filter((t) => t.value_m > 0)
  const sum = terms.reduce((a, t) => a + t.value_m, 0) || 1

  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {terms.map((t, i) => (
          <Tooltip key={t.source}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'h-full min-w-[2px] cursor-help transition-[width] duration-500 ease-out',
                  t.kind === 'systematic' && 'opacity-70',
                )}
                style={{ width: `${(t.value_m / sum) * 100}%`, background: SEG[i % SEG.length] }}
              />
            </TooltipTrigger>
            <TooltipContent>
              {t.label}: {t.value_m.toFixed(1)} m · {t.kind}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {terms.map((t, i) => (
          <li key={t.source} className="flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-sm"
              style={{ background: SEG[i % SEG.length] }}
            />
            <span className="flex-1 truncate text-muted-foreground">{t.label}</span>
            <span className="tnum">{t.value_m.toFixed(1)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
