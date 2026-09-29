// React Bits  ClickSpark. Spark burst on click, drawn on a canvas overlay.
import { useCallback, useEffect, useRef } from 'react'

interface Spark {
  x: number
  y: number
  angle: number
  startTime: number
}

interface Props {
  sparkColor?: string
  sparkSize?: number
  sparkRadius?: number
  sparkCount?: number
  duration?: number
  easing?: 'linear' | 'ease-in' | 'ease-in-out' | 'ease-out'
  extraScale?: number
  children?: React.ReactNode
}

export function ClickSpark({
  sparkColor = 'currentColor',
  sparkSize = 10,
  sparkRadius = 15,
  sparkCount = 8,
  duration = 400,
  easing = 'ease-out',
  extraScale = 1,
  children,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sparksRef = useRef<Spark[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return
    let t: ReturnType<typeof setTimeout>
    const resize = () => {
      const { width, height } = parent.getBoundingClientRect()
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
    }
    const ro = new ResizeObserver(() => {
      clearTimeout(t)
      t = setTimeout(resize, 100)
    })
    ro.observe(parent)
    resize()
    return () => {
      ro.disconnect()
      clearTimeout(t)
    }
  }, [])

  const ease = useCallback(
    (x: number) => {
      switch (easing) {
        case 'linear':
          return x
        case 'ease-in':
          return x * x
        case 'ease-in-out':
          return x < 0.5 ? 2 * x * x : -1 + (4 - 2 * x) * x
        default:
          return x * (2 - x)
      }
    },
    [easing],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let raf = 0
    const draw = (ts: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      sparksRef.current = sparksRef.current.filter((s) => {
        const el = ts - s.startTime
        if (el >= duration) return false
        const p = ease(el / duration)
        const dist = p * sparkRadius * extraScale
        const len = sparkSize * (1 - p)
        const x1 = s.x + dist * Math.cos(s.angle)
        const y1 = s.y + dist * Math.sin(s.angle)
        const x2 = s.x + (dist + len) * Math.cos(s.angle)
        const y2 = s.y + (dist + len) * Math.sin(s.angle)
        ctx.strokeStyle = sparkColor
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
        return true
      })
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [sparkColor, sparkSize, sparkRadius, duration, ease, extraScale])

  const onClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const r = canvas.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const now = performance.now()
    for (let i = 0; i < sparkCount; i++) {
      sparksRef.current.push({ x, y, angle: (2 * Math.PI * i) / sparkCount, startTime: now })
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }} onClick={onClick}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 40 }}
      />
      {children}
    </div>
  )
}
