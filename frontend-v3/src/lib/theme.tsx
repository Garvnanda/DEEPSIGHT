// Theme: light (default) / dark, persisted to localStorage, applied as `.dark` on <html>.
// No next-themes — one tiny store instead.

import { useEffect } from 'react'
import { create } from 'zustand'

export type Theme = 'light' | 'dark'
const KEY = 'deepsight.theme'

function initial(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* ignore */
  }
  return 'light' // explicit default per product spec
}

interface ThemeState {
  theme: Theme
  setTheme: (t: Theme) => void
  toggle: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initial(),
  setTheme: (t) => {
    try {
      localStorage.setItem(KEY, t)
    } catch {
      /* ignore */
    }
    set({ theme: t })
  },
  toggle: () => get().setTheme(get().theme === 'light' ? 'dark' : 'light'),
}))

/** Applies the current theme class to <html>. Mount once near the root. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme)
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
  }, [theme])
  return <>{children}</>
}
