// Recharts and Leaflet set colours as SVG *attributes*, where CSS var() does not resolve.
// Read the computed values instead, and recompute when the theme flips.

import { useEffect, useState } from 'react'

import type { DetectionClass } from './types'
import { useThemeStore } from './theme'

const VARS = [
  '--cls-wreck',
  '--cls-milco',
  '--cls-nombo',
  '--cls-pipeline',
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--accent',
  '--muted',
  '--muted-foreground',
  '--popover',
  '--popover-foreground',
  '--border',
  '--warn',
  '--wf-grid',
  '--wf-void',
] as const

type VarName = (typeof VARS)[number]
export type ResolvedColors = Record<VarName, string> & {
  cls: Record<DetectionClass, string>
}

function read(): ResolvedColors {
  const s = getComputedStyle(document.documentElement)
  const out = {} as Record<string, string>
  for (const v of VARS) out[v] = s.getPropertyValue(v).trim() || '#888'
  return {
    ...(out as Record<VarName, string>),
    cls: {
      wreck: out['--cls-wreck'],
      milco: out['--cls-milco'],
      nombo: out['--cls-nombo'],
      pipeline: out['--cls-pipeline'],
    },
  }
}

export function useResolvedColors(): ResolvedColors {
  const theme = useThemeStore((s) => s.theme)
  const [colors, setColors] = useState<ResolvedColors>(() => read())
  useEffect(() => {
    // wait a frame so the .dark class + var swap has painted
    const id = requestAnimationFrame(() => setColors(read()))
    return () => cancelAnimationFrame(id)
  }, [theme])
  return colors
}
