import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: React.ReactNode
  hint?: string
  icon?: React.ReactNode
  loading?: boolean
  className?: string
  index?: number
}

export function MetricCard({ label, value, hint, icon, loading, className, index = 0 }: Props) {
  return (
    <div
      className={cn(
        'panel-marks rounded-xl border bg-card p-4 duration-300 animate-in fade-in slide-in-from-bottom-2',
        className,
      )}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="label-micro">{label}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : (
        <div className="tnum mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      )}
      <div
        className="mt-2 h-px w-8"
        style={{ background: 'var(--accent)', opacity: 0.7 }}
        aria-hidden
      />
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
