import { Badge } from '@/components/ui/badge'
import type { SurveyStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const MAP: Record<SurveyStatus, { label: string; cls: string; pulse?: boolean }> = {
  uploaded: { label: 'Uploaded', cls: 'text-muted-foreground border-border' },
  parsing: { label: 'Parsing', cls: 'text-info border-info/40 bg-info/10', pulse: true },
  ready: { label: 'Ready', cls: 'text-ok border-ok/40 bg-ok/10' },
  processing: { label: 'Detecting', cls: 'text-warn border-warn/40 bg-warn/10', pulse: true },
  complete: { label: 'Complete', cls: 'text-ok border-ok/40 bg-ok/10' },
  failed: { label: 'Failed', cls: 'text-destructive border-destructive/40 bg-destructive/10' },
}

export function StatusBadge({ status, className }: { status: SurveyStatus; className?: string }) {
  const m = MAP[status]
  return (
    <Badge variant="outline" className={cn('gap-1.5 font-medium', m.cls, className)}>
      {m.pulse && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {m.label}
    </Badge>
  )
}
