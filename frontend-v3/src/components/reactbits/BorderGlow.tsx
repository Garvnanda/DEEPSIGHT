// React Bits  BorderGlow. Pointer-tracking edge glow + mesh-gradient border on a card.
import { useCallback, useEffect, useRef } from 'react'

import './BorderGlow.css'

interface Props {
  children: React.ReactNode
  className?: string
  edgeSensitivity?: number
  glowColor?: string // "H S L"
  backgroundColor?: string
  borderRadius?: number
  glowRadius?: number
  glowIntensity?: number
  coneSpread?: number
  animated?: boolean
  colors?: string[]
  fillOpacity?: number
}

function parseHSL(s: string) {
  const m = s.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/)
  return m ? { h: +m[1], s: +m[2], l: +m[3] } : { h: 190, s: 60, l: 55 }
}

const GRAD_POS = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%']
const GRAD_KEYS = [
  '--gradient-one', '--gradient-two', '--gradient-three', '--gradient-four',
  '--gradient-five', '--gradient-six', '--gradient-seven',
]
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1]

export function BorderGlow({
  children,
  className = '',
  edgeSensitivity = 28,
  glowColor = '190 70 55',
  backgroundColor = 'var(--card)',
  borderRadius = 18,
  glowRadius = 34,
  glowIntensity = 1,
  coneSpread = 25,
  animated = false,
  colors = ['#39b7c9', '#5ad1e0', '#2b8fa0'],
  fillOpacity = 0.4,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  const onMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const cx = r.width / 2
    const cy = r.height / 2
    const dx = x - cx
    const dy = y - cy
    let kx = Infinity
    let ky = Infinity
    if (dx !== 0) kx = cx / Math.abs(dx)
    if (dy !== 0) ky = cy / Math.abs(dy)
    const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1)
    let deg = Math.atan2(dy, dx) * (180 / Math.PI) + 90
    if (deg < 0) deg += 360
    el.style.setProperty('--edge-proximity', (edge * 100).toFixed(3))
    el.style.setProperty('--cursor-angle', `${deg.toFixed(3)}deg`)
  }, [])

  useEffect(() => {
    if (!animated || !ref.current) return
    const el = ref.current
    el.classList.add('sweep-active')
    el.style.setProperty('--cursor-angle', '110deg')
    const t0 = performance.now()
    let raf = 0
    const run = (now: number) => {
      const p = Math.min((now - t0) / 1400, 1)
      el.style.setProperty('--edge-proximity', String(60 + 40 * Math.sin(p * Math.PI)))
      el.style.setProperty('--cursor-angle', `${110 + 320 * p}deg`)
      if (p < 1) raf = requestAnimationFrame(run)
      else el.classList.remove('sweep-active')
    }
    raf = requestAnimationFrame(run)
    return () => cancelAnimationFrame(raf)
  }, [animated])

  const { h, s, l } = parseHSL(glowColor)
  const base = `${h}deg ${s}% ${l}%`
  const glowVars: Record<string, string> = {}
  const ops = [100, 60, 50, 40, 30, 20, 10]
  const keys = ['', '-60', '-50', '-40', '-30', '-20', '-10']
  ops.forEach((o, i) => {
    glowVars[`--glow-color${keys[i]}`] = `hsl(${base} / ${Math.min(o * glowIntensity, 100)}%)`
  })
  const gradVars: Record<string, string> = {}
  for (let i = 0; i < 7; i++) {
    const c = colors[Math.min(COLOR_MAP[i], colors.length - 1)]
    gradVars[GRAD_KEYS[i]] = `radial-gradient(at ${GRAD_POS[i]}, ${c} 0px, transparent 50%)`
  }
  gradVars['--gradient-base'] = `linear-gradient(${colors[0]} 0 100%)`

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      className={`border-glow-card ${className}`}
      style={
        {
          '--card-bg': backgroundColor,
          '--edge-sensitivity': edgeSensitivity,
          '--border-radius': `${borderRadius}px`,
          '--glow-padding': `${glowRadius}px`,
          '--cone-spread': coneSpread,
          '--fill-opacity': fillOpacity,
          ...glowVars,
          ...gradVars,
        } as React.CSSProperties
      }
    >
      <span className="edge-light" />
      <div className="border-glow-inner">{children}</div>
    </div>
  )
}
