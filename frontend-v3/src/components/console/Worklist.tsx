import { ClassDot } from '@/components/common/ClassBadge'
import { metres, num } from '@/lib/format'
import type { Detection } from '@/lib/types'
import { CLASS_LABEL } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  detections: Detection[]
  selectedId: string | null
  onSelect: (d: Detection) => void
}

export function Worklist({ detections, selectedId, onSelect }: Props) {
  const sorted = [...detections].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    return a.error_radius_m - b.error_radius_m
  })

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Worklist · {sorted.length}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="px-3 py-6 text-xs text-muted-foreground">
            No targets yet. Press play to scan, or the survey has none.
          </p>
        ) : (
          <ul>
            {sorted.map((d) => {
              const sel = d.detection_id === selectedId
              return (
                <li key={d.detection_id}>
                  <button
                    onClick={() => onSelect(d)}
                    className={cn(
                      'flex w-full items-center gap-2.5 border-l-2 px-3 py-2 text-left text-sm transition-colors',
                      sel
                        ? 'border-accent bg-accent/10'
                        : 'border-transparent hover:bg-muted/60',
                      d.class === 'nombo' && !sel && 'opacity-60',
                    )}
                  >
                    <ClassDot cls={d.class} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{CLASS_LABEL[d.class]}</div>
                      <div className="tnum text-[11px] text-muted-foreground">
                        score {d.confidence.toFixed(2)} · ± {metres(d.error_radius_m)} · ping{' '}
                        {num(d.ping)}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
