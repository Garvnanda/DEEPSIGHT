import { HelpCircle, Menu, Waves } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { HealthDot } from './HealthDot'
import { ThemeToggle } from './ThemeToggle'

const LINKS = [
  { to: '/surveys', label: 'Surveys', end: false },
  { to: '/detections', label: 'Detections', end: false },
  { to: '/reports', label: 'Reports', end: false },
  { to: '/settings', label: 'Settings', end: false },
]

function Links({ onNavigate, orientation = 'row' }: { onNavigate?: () => void; orientation?: 'row' | 'col' }) {
  return (
    <nav className={cn('flex gap-1', orientation === 'col' && 'flex-col')}>
      {LINKS.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60',
            )
          }
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function TopNav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <NavLink to="/surveys" className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Waves className="size-4" />
        </span>
        <span className="text-sm font-semibold tracking-tight">Deep-Sight</span>
      </NavLink>

      <div className="ml-6 hidden md:block">
        <Links />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <HealthDot />
        <Button asChild variant="ghost" size="icon" aria-label="Walkthrough">
          <NavLink to="/welcome">
            <HelpCircle className="size-4" />
          </NavLink>
        </Button>
        <ThemeToggle />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-60 gap-6 py-6">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Links orientation="col" onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
