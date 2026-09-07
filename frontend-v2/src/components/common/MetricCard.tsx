import { Card } from '@/components/ui/card'
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
    <Card
      className={cn('gap-2 p-4 duration-300 animate-in fade-in slide-in-from-bottom-2', className)}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div className="tnum text-2xl font-semibold tracking-tight">{value}</div>
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Card>
  )
}
