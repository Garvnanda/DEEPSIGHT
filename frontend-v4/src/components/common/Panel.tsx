// The panel every screen is built from: registration marks at the corners, a mono
// small-caps title, and a ruled filler out to whatever sits on the right. Same chrome
// as the walkthrough, so the console and the walkthrough read as one instrument.

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function Panel({
  title,
  right,
  children,
  className,
  bodyClassName,
  flush,
}: {
  title?: ReactNode
  right?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  /** no padding on the body  for tables that run edge to edge */
  flush?: boolean
}) {
  return (
    <div className={cn('panel-marks overflow-hidden rounded-xl border bg-card', className)}>
      {(title || right) && (
        <div className="flex items-center gap-3 border-b px-4 py-2.5">
          {title && <span className="label-micro shrink-0">{title}</span>}
          <div className="tick-rule hidden min-w-6 flex-1 sm:block" aria-hidden />
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </div>
      )}
      <div className={cn(flush ? '' : 'p-4', bodyClassName)}>{children}</div>
    </div>
  )
}
