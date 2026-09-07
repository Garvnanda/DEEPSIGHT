import { cn } from '@/lib/utils'

interface Props {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div
      className={cn(
        'grid place-items-center rounded-lg border border-dashed px-6 py-14 text-center',
        className,
      )}
    >
      <div className="max-w-sm">
        {icon && <div className="mx-auto mb-3 text-muted-foreground">{icon}</div>}
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  )
}
