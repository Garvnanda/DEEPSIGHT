// React Bits  OptionWheel. Curved, scrollable option wheel. Scroll / drag / arrows.
import { useCallback, useEffect, useRef, useState } from 'react'

import './OptionWheel.css'

interface Props {
  items: string[]
  defaultSelected?: number
  onChange?: (index: number, item: string) => void
  side?: 'left' | 'right'
  fontSize?: number
  spacing?: number
  curve?: number
  tilt?: number
  blur?: number
  fade?: number
  minOpacity?: number
  smoothing?: number
  inset?: number
  loop?: boolean
  className?: string
}

export function OptionWheel({
  items,
  defaultSelected = 0,
  onChange,
  side = 'left',
  fontSize = 1.6,
  spacing = 1.5,
  curve = 1,
  tilt = 7,
  blur = 1.5,
  fade = 0.28,
  minOpacity = 0.06,
  smoothing = 200,
  inset = 24,
  loop = false,
  className = '',
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const posRef = useRef(defaultSelected)
  const targetRef = useRef(defaultSelected)
  const rafRef = useRef<number | null>(null)
  const lastRef = useRef(0)
  const selectedRef = useRef(defaultSelected)
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragRef = useRef<{ y: number; start: number; id: number } | null>(null)
  const dragMoved = useRef(false)
  const [selectedIndex, setSelectedIndex] = useState(defaultSelected)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const remPx =
    typeof window !== 'undefined'
      ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      : 16
  const cfg = {
    count: items.length,
    rowH: Math.max(fontSize * spacing * remPx, 1),
    curve,
    tilt,
    blur,
    fade,
    minOpacity,
    side,
    loop,
    smoothing,
  }
  const cfgRef = useRef(cfg)
  cfgRef.current = cfg

  const runFrame = useCallback((now: number) => {
    const dt = Math.min((now - lastRef.current) / 1000, 0.05)
    lastRef.current = now
    const c = cfgRef.current
    const k = 1 - Math.exp(-dt / (Math.max(c.smoothing, 1) / 1000))
    const cur = posRef.current
    let next = cur + (targetRef.current - cur) * k
    const settled = Math.abs(targetRef.current - next) < 0.001
    if (settled) next = targetRef.current
    posRef.current = next
    const mirror = c.side === 'right' ? -1 : 1
    const tiltRad = (c.tilt * Math.PI) / 180
    const R = tiltRad > 0.0005 ? c.rowH / tiltRad : 0
    for (let i = 0; i < c.count; i++) {
      const el = itemRefs.current[i]
      if (!el) continue
      let d = i - next
      if (c.loop && c.count > 1) {
        d = ((d % c.count) + c.count) % c.count
        if (d > c.count / 2) d -= c.count
      }
      const dist = Math.abs(d)
      let x = 0
      let y = d * c.rowH
      let rot = 0
      if (R > 0) {
        const ang = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d * tiltRad))
        y = R * Math.sin(ang)
        x = -mirror * R * (1 - Math.cos(ang)) * c.curve
        rot = (mirror * ang * 180) / Math.PI
      }
      el.style.transform = `translate(${x.toFixed(2)}px, calc(${y.toFixed(2)}px - 50%)) rotate(${rot.toFixed(3)}deg)`
      el.style.opacity = String(Math.max(c.minOpacity, 1 - dist * c.fade))
      el.style.filter = c.blur > 0 ? `blur(${(dist * c.blur).toFixed(2)}px)` : 'none'
      el.style.setProperty('--ow-p', Math.max(0, 1 - Math.min(dist, 1)).toFixed(4))
    }
    rafRef.current = settled ? null : requestAnimationFrame(runFrame)
  }, [])

  const startLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    lastRef.current = performance.now()
    rafRef.current = requestAnimationFrame(runFrame)
  }, [runFrame])

  const applyTarget = useCallback(
    (value: number, snap: boolean) => {
      const c = cfgRef.current
      let v = value
      if (!c.loop) v = Math.min(Math.max(v, 0), Math.max(c.count - 1, 0))
      if (snap) v = Math.round(v)
      targetRef.current = v
      const idx = ((Math.round(v) % c.count) + c.count) % c.count
      if (idx !== selectedRef.current) {
        selectedRef.current = idx
        setSelectedIndex(idx)
        onChangeRef.current?.(idx, items[idx])
      }
      startLoop()
    },
    [items, startLoop],
  )

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const c = cfgRef.current
      const delta = e.deltaMode === 1 ? e.deltaY * 24 : e.deltaY
      const stepDelta = Math.max(-1, Math.min(1, delta / c.rowH))
      applyTarget(targetRef.current + stepDelta, false)
      if (wheelTimer.current) clearTimeout(wheelTimer.current)
      wheelTimer.current = setTimeout(() => applyTarget(targetRef.current, true), 140)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      if (wheelTimer.current) clearTimeout(wheelTimer.current)
    }
  }, [applyTarget])

  useEffect(() => {
    applyTarget(targetRef.current, false)
  }, [items, applyTarget])

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  return (
    <div
      ref={rootRef}
      role="listbox"
      tabIndex={0}
      aria-label="Options"
      className={`option-wheel${side === 'right' ? ' option-wheel--right' : ''} ${className}`}
      style={{ ['--ow-inset' as string]: `${inset}px`, ['--ow-font-size' as string]: `${fontSize}rem` }}
      onPointerDown={(e) => {
        dragRef.current = { y: e.clientY, start: targetRef.current, id: e.pointerId }
        dragMoved.current = false
      }}
      onPointerMove={(e) => {
        const drag = dragRef.current
        if (!drag) return
        const dy = e.clientY - drag.y
        if (!dragMoved.current && Math.abs(dy) > 4) {
          dragMoved.current = true
          rootRef.current?.setPointerCapture(drag.id)
        }
        if (dragMoved.current) applyTarget(drag.start - dy / cfgRef.current.rowH, false)
      }}
      onPointerUp={() => {
        if (!dragRef.current) return
        dragRef.current = null
        if (dragMoved.current) applyTarget(targetRef.current, true)
      }}
      onKeyDown={(e) => {
        let delta: number | null = null
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') delta = -1
        else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') delta = 1
        if (delta == null) return
        e.preventDefault()
        applyTarget(Math.round(targetRef.current) + delta, true)
      }}
    >
      {items.map((label, index) => (
        <div
          key={`${label}-${index}`}
          ref={(el) => {
            itemRefs.current[index] = el
          }}
          role="option"
          aria-selected={selectedIndex === index}
          className={`option-wheel__item${selectedIndex === index ? ' option-wheel__item--selected' : ''}`}
          onClick={() => {
            if (dragMoved.current) return
            applyTarget(index, true)
          }}
        >
          {label}
        </div>
      ))}
    </div>
  )
}
