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
        'relative grid place-items-center overflow-hidden rounded-xl border border-dashed px-6 py-16 text-center',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 grid-field opacity-50" aria-hidden />
      <div className="relative max-w-sm">
        {icon && <div className="mx-auto mb-3 text-accent/70">{icon}</div>}
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  )
}
