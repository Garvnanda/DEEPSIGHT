import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface Props {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** mono small-caps word on the header rail; defaults to the title */
  kicker?: string
  /** right end of the header rail  a count, a status, a timestamp */
  meta?: ReactNode
  /** full-bleed pages (the console) opt out of the max-width + padding */
  bleed?: boolean
}

export function PageContainer({
  title,
  description,
  actions,
  children,
  className,
  kicker,
  meta,
  bleed,
}: Props) {
  if (bleed) return <div className={cn('h-full', className)}>{children}</div>
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden grid-field" aria-hidden />
      <div
        className={cn('relative mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8', className)}
      >
        {/* header rail  the same one the walkthrough runs across the top */}
        <div className="flex items-center gap-4">
          <span className="label-micro shrink-0">{kicker ?? title}</span>
          <div className="tick-rule hidden flex-1 sm:block" aria-hidden />
          {meta && <span className="tnum shrink-0 text-xs text-muted-foreground">{meta}</span>}
        </div>

        <div className="mb-6 mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight duration-200 animate-in fade-in slide-in-from-left-2">
              {title}
            </h2>
            {description && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>

        {children}
      </div>
    </div>
  )
}
