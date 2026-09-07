import { Menu } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { HealthDot } from './HealthDot'
import { SidebarBrand, SidebarNav } from './Sidebar'
import { ThemeToggle } from './ThemeToggle'

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/surveys': 'Surveys',
  '/detections': 'Detections',
  '/reports': 'Reports',
  '/settings': 'Settings',
}

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname]
  if (pathname.startsWith('/surveys/')) return 'Survey Console'
  return 'Deep-Sight'
}

export function Topbar() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
            <Menu className="size-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 gap-6 py-5">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBrand />
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <h1 className="text-sm font-semibold tracking-tight">{titleFor(pathname)}</h1>

      <div className="ml-auto flex items-center gap-2">
        <HealthDot />
        <ThemeToggle />
      </div>
    </header>
  )
}
