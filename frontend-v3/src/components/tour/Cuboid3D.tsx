// A CSS-only 3D wireframe of the detected object, scaled to its real measured
// dimensions: across-track width and along-track length from the detection box,
// height from the acoustic shadow. Hover to hold the rotation.

import type { CSSProperties } from 'react'
import { useState } from 'react'

import { metres } from '@/lib/format'
import './tour.css'

interface Props {
  widthM: number
  lengthM: number
  heightM: number
  className?: string
}

const EDGE = { w: 'var(--chart-1)', l: 'var(--chart-2)', h: 'var(--chart-4)' }

function face(fw: number, fh: number, transform: string, edge: string): CSSProperties {
  return {
    width: fw,
    height: fh,
    left: '50%',
    top: '50%',
    marginLeft: -fw / 2,
    marginTop: -fh / 2,
    transform,
    '--edge': edge,
  } as CSSProperties
}

export function Cuboid3D({ widthM, lengthM, heightM, className }: Props) {
  const [paused, setPaused] = useState(false)

  const hM = heightM > 0 ? heightM : 0.25
  const maxM = Math.max(widthM, lengthM, hM, 0.1)
  const scale = 150 / maxM
  const w = Math.max(widthM * scale, 10)
  const d = Math.max(lengthM * scale, 10)
  const h = Math.max(hM * scale, 10)

  return (
    <div className={className}>
      <div
        className="cuboid-scene grid place-items-center"
        style={{ height: 250 }}
        data-paused={paused}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="cuboid-box" style={{ width: w, height: h }}>
          <div className="cuboid-face" style={face(w, h, `translateZ(${d / 2}px)`, EDGE.w)} />
          <div className="cuboid-face" style={face(w, h, `rotateY(180deg) translateZ(${d / 2}px)`, EDGE.w)} />
          <div className="cuboid-face" style={face(d, h, `rotateY(90deg) translateZ(${w / 2}px)`, EDGE.l)} />
          <div className="cuboid-face" style={face(d, h, `rotateY(-90deg) translateZ(${w / 2}px)`, EDGE.l)} />
          <div className="cuboid-face" style={face(w, d, `rotateX(90deg) translateZ(${h / 2}px)`, EDGE.h)} />
          <div className="cuboid-face" style={face(w, d, `rotateX(-90deg) translateZ(${h / 2}px)`, EDGE.h)} />
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Dim color={EDGE.w} label="Width" value={metres(widthM)} sub="across-track" />
        <Dim color={EDGE.l} label="Length" value={metres(lengthM)} sub="along-track" />
        <Dim color={EDGE.h} label="Height" value={heightM > 0 ? metres(heightM) : '—'} sub="from shadow" />
      </dl>
    </div>
  )
}

function Dim({ color, label, value, sub }: { color: string; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border bg-card p-2">
      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-2 rounded-sm" style={{ background: color }} /> {label}
      </div>
      <div className="tnum mt-0.5 text-sm font-semibold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  )
}
