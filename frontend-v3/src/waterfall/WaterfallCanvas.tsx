// The waterfall. Draws sonar rows from the playback ring buffer with instrument chrome
// and detection boxes. Smooth scroll via a RAF drain loop. Letterboxed, never stretched.

import { useEffect, useRef } from 'react'

import { CLASS_COLOR_VAR } from '@/components/common/ClassBadge'
import type { Detection } from '@/lib/types'
import { usePlaybackStore } from '@/stores/playbackStore'
import { useSelectionStore } from '@/stores/selectionStore'
import { RingBuffer } from './RingBuffer'
import { amberLUT, iceLUT } from './colourRamp'

const ROWS_PER_FRAME = 4

interface Palette {
  void: string
  grid: string
  label: string
  cls: Record<string, string>
}

function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement)
  const v = (name: string) => s.getPropertyValue(name).trim()
  return {
    void: v('--wf-void') || '#0e1a1e',
    grid: v('--wf-grid') || 'rgba(120,140,150,0.3)',
    label: v('--muted-foreground') || '#7e9aa3',
    cls: {
      wreck: v('--cls-wreck'),
      milco: v('--cls-milco'),
      nombo: v('--cls-nombo'),
      pipeline: v('--cls-pipeline'),
    },
  }
}

export function WaterfallCanvas({ rangeM }: { rangeM: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rbRef = useRef(new RingBuffer())
  const rafRef = useRef(0)
  const rowInBatch = useRef(0)
  const scrollRows = useRef(0)
  const paletteRef = useRef<Palette | null>(null)

  const theme = document.documentElement.classList.contains('dark')

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })!
    const rb = rbRef.current
    paletteRef.current = readPalette()

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const r = container.getBoundingClientRect()
      canvas.width = r.width * dpr
      canvas.height = r.height * dpr
      canvas.style.width = `${r.width}px`
      canvas.style.height = `${r.height}px`
      paletteRef.current = readPalette()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const render = () => {
      const st = usePlaybackStore.getState()
      const pal = paletteRef.current!
      const dpr = window.devicePixelRatio || 1
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = pal.void
      ctx.fillRect(0, 0, w, h)

      const lut = st.correctedView ? iceLUT : amberLUT
      const playing = st.state === 'playing'
      // drain while playing/complete, or whenever a batch is pending (tile scrub while paused)
      const shouldDrain = playing || st.state === 'complete' || st.rowQueue.length > 0

      // drain from the FRONT of the queue; consumed batches are shifted off
      if (shouldDrain && !reduced) {
        let drawn = 0
        const q = st.rowQueue
        while (drawn < ROWS_PER_FRAME && q.length > 0) {
          const b = q[0]
          const left = b.count - rowInBatch.current
          const take = Math.min(left, ROWS_PER_FRAME - drawn)
          const off = rowInBatch.current * b.width
          rb.writeRows(b.data.subarray(off, off + take * b.width), take, b.width, lut)
          rowInBatch.current += take
          drawn += take
          scrollRows.current += take
          if (rowInBatch.current >= b.count) {
            q.shift()
            rowInBatch.current = 0
          }
        }
      }

      const wfW = rb.bufferWidth || st.waterfallWidth
      if (wfW > 0) {
        // fit the swath to the pane width (these lines are 13k+ px wide)
        const scale = Math.min(1, w / wfW)
        const drawW = wfW * scale
        const xOff = Math.floor((w - drawW) / 2)
        ctx.save()
        ctx.translate(xOff, 0)
        ctx.scale(scale, 1)
        rb.drawTo(ctx, 0, Math.floor(h))
        ctx.restore()

        drawChrome(ctx, xOff, drawW, h, rangeM, pal)
        drawDetections(
          ctx,
          xOff,
          drawW,
          wfW,
          h,
          scrollRows.current,
          usePlaybackStore.getState().detections,
          useSelectionStore.getState().selectedId,
          pal,
        )
      }
      rafRef.current = requestAnimationFrame(render)
    }
    rafRef.current = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [rangeM, theme])

  return (
    <div ref={containerRef} className="relative h-full w-full bg-wf-void">
      <canvas ref={canvasRef} className="block" />
    </div>
  )
}

function drawChrome(
  ctx: CanvasRenderingContext2D,
  xOff: number,
  wfW: number,
  h: number,
  rangeM: number,
  pal: Palette,
) {
  const nadir = xOff + wfW / 2
  ctx.strokeStyle = pal.grid
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(nadir + 0.5, 0)
  ctx.lineTo(nadir + 0.5, h)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.font = '11px "JetBrains Mono", monospace'
  ctx.fillStyle = pal.label
  ctx.textAlign = 'center'
  ctx.fillText('PORT', xOff + wfW * 0.25, 16)
  ctx.fillText('STBD', xOff + wfW * 0.75, 16)

  if (rangeM > 0) {
    ctx.font = '10px "JetBrains Mono", monospace'
    const ticks = 4
    const half = wfW / 2
    for (let i = 1; i <= ticks; i++) {
      const frac = i / ticks
      const val = Math.round(rangeM * frac)
      const xL = xOff + half * (1 - frac)
      const xR = xOff + half + half * frac
      ctx.strokeStyle = pal.grid
      ctx.beginPath()
      ctx.moveTo(xL, 0)
      ctx.lineTo(xL, 6)
      ctx.moveTo(xR, 0)
      ctx.lineTo(xR, 6)
      ctx.stroke()
      ctx.fillStyle = pal.label
      ctx.textAlign = 'center'
      ctx.fillText(`${val}m`, xL, 18)
      ctx.fillText(`${val}m`, xR, 18)
    }
  }
}

function drawDetections(
  ctx: CanvasRenderingContext2D,
  xOff: number,
  drawW: number,
  wfW: number,
  h: number,
  scrollRows: number,
  detections: Detection[],
  selectedId: string | null,
  pal: Palette,
) {
  const sx = drawW / wfW
  for (const d of detections) {
    const y = h - (scrollRows - d.bbox_px.y)
    const bx = xOff + d.bbox_px.x * sx
    const bw = d.bbox_px.w * sx
    const bh = d.bbox_px.h
    if (y + bh < 0 || y > h) continue
    const sel = d.detection_id === selectedId
    const color = pal.cls[d.class] || CLASS_COLOR_VAR[d.class]
    ctx.strokeStyle = sel ? '#ffffff' : color
    ctx.lineWidth = sel ? 2 : 1.25
    ctx.strokeRect(bx, y, Math.max(bw, 3), Math.max(bh, 3))
    if (sel || bw > 24) {
      ctx.font = '10px Inter, sans-serif'
      ctx.fillStyle = color
      ctx.textAlign = 'left'
      ctx.fillText(d.class_display, bx, y - 4)
    }
  }
}
