import type { DetectionClass } from '@/lib/types'
import { CLASS_LABEL } from '@/lib/types'
import { cn } from '@/lib/utils'

export const CLASS_COLOR_VAR: Record<DetectionClass, string> = {
  wreck: 'var(--cls-wreck)',
  milco: 'var(--cls-milco)',
  nombo: 'var(--cls-nombo)',
  pipeline: 'var(--cls-pipeline)',
}

export function ClassDot({ cls, className }: { cls: DetectionClass; className?: string }) {
  return (
    <span
      className={cn('inline-block size-2 shrink-0 rounded-full', className)}
      style={{ background: CLASS_COLOR_VAR[cls] }}
    />
  )
}

export function ClassBadge({
  cls,
  showCode,
  className,
}: {
  cls: DetectionClass
  showCode?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
        cls === 'nombo' && 'opacity-70',
        className,
      )}
      style={{ borderColor: `color-mix(in oklch, ${CLASS_COLOR_VAR[cls]} 45%, transparent)` }}
    >
      <ClassDot cls={cls} />
      {CLASS_LABEL[cls]}
      {showCode && <code className="text-[10px] text-muted-foreground">{cls}</code>}
    </span>
  )
}
