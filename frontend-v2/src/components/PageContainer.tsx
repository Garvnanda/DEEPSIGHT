import { cn } from '@/lib/utils'

interface Props {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** full-bleed pages (the console) opt out of the max-width + padding */
  bleed?: boolean
}

export function PageContainer({ title, description, actions, children, className, bleed }: Props) {
  if (bleed) return <div className={cn('h-full', className)}>{children}</div>
  return (
    <div className={cn('mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8', className)}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight duration-200 animate-in fade-in slide-in-from-left-2">
            {title}
          </h2>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}
