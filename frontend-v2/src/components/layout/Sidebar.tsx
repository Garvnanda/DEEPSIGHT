import { motion } from 'framer-motion'
import { Crosshair, FileText, LayoutDashboard, Settings2, Waves } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/surveys', label: 'Surveys', icon: Waves, end: false },
  { to: '/detections', label: 'Detections', icon: Crosshair, end: false },
  { to: '/reports', label: 'Reports', icon: FileText, end: false },
  { to: '/settings', label: 'Settings', icon: Settings2, end: false },
]

export function SidebarBrand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Waves className="size-5" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight">Deep-Sight</div>
        <div className="text-[11px] text-muted-foreground">Survey Review Console</div>
      </div>
    </div>
  )
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-2">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent"
                  transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                />
              )}
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r bg-sidebar py-5 lg:flex">
      <SidebarBrand />
      <SidebarNav />
      <div className="mt-auto px-4 text-[11px] leading-relaxed text-muted-foreground">
        <p>Side-scan sonar review.</p>
        <p>Honest error radii, per target.</p>
      </div>
    </aside>
  )
}
