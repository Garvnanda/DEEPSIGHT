// Where the target sits, on a real map of the world. Equirectangular SVG drawn from a
// bundled 110m land outline — no basemap tiles, no network, works fully offline.

import landRaw from '@/assets/land-110m.geo.json'
import { coord } from '@/lib/format'
import './tour.css'

interface LandFC {
  features: { geometry: { coordinates: number[][][] } }[]
}
const land = landRaw as unknown as LandFC

const W = 720
const H = 360
const px = (lon: number) => ((lon + 180) / 360) * W
const py = (lat: number) => ((90 - lat) / 180) * H

const LAND_PATH = land.features
  .map((f) =>
    f.geometry.coordinates
      .map(
        (ring) =>
          'M' + ring.map(([lo, la]) => `${px(lo).toFixed(1)} ${py(la).toFixed(1)}`).join(' L') + ' Z',
      )
      .join(' '),
  )
  .join(' ')

const GRAT: string[] = []
for (let lon = -150; lon <= 150; lon += 30) GRAT.push(`M${px(lon).toFixed(1)} 0 V${H}`)
for (let lat = -60; lat <= 60; lat += 30) GRAT.push(`M0 ${py(lat).toFixed(1)} H${W}`)

export function WorldMap({ lat, lon, className }: { lat: number; lon: number; className?: string }) {
  const x = px(lon)
  const y = py(lat)
  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-lg border"
        style={{ background: 'var(--wf-void)' }}
        role="img"
        aria-label={`World map marking ${coord(lat)}, ${coord(lon)}`}
      >
        <path d={GRAT.join(' ')} stroke="var(--wf-grid)" strokeWidth={0.5} fill="none" opacity={0.6} />
        <path d={LAND_PATH} fill="var(--muted)" stroke="var(--border)" strokeWidth={0.5} />
        <line x1={x} y1={0} x2={x} y2={H} stroke="var(--accent)" strokeWidth={0.6} strokeDasharray="4 4" opacity={0.55} />
        <line x1={0} y1={y} x2={W} y2={y} stroke="var(--accent)" strokeWidth={0.6} strokeDasharray="4 4" opacity={0.55} />
        <circle className="cuboid-ping" cx={x} cy={y} r={4} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
        <circle cx={x} cy={y} r={4} fill="var(--accent)" />
      </svg>
      <div className="mt-2 flex justify-center gap-5 text-xs">
        <span className="text-muted-foreground">
          Lat <span className="tnum font-medium text-foreground">{coord(lat)}</span>
        </span>
        <span className="text-muted-foreground">
          Lon <span className="tnum font-medium text-foreground">{coord(lon)}</span>
        </span>
      </div>
    </div>
  )
}
