// Where the target sits, on a real map of the world. Equirectangular SVG drawn from a
// bundled 110m coastline  no basemap tiles, no network, works fully offline.
//
// Two views of the same projection: the whole world with a crop box, and a regional
// inset cut straight out of it, so you can see the coast the target actually sits off.

import landRaw from '@/assets/land-110m.geo.json'
import { coord } from '@/lib/format'
import { cn } from '@/lib/utils'
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
const GRAT_PATH = GRAT.join(' ')
const AXES_PATH = `M0 ${py(0)} H${W} M${px(0)} 0 V${H}`

/** The land + graticule layers, shared by the world view and the inset. */
function Basemap({ axes = true }: { axes?: boolean }) {
  return (
    <>
      <rect x={0} y={0} width={W} height={H} fill="var(--map-ocean)" />
      <path
        d={GRAT_PATH}
        stroke="var(--map-grat)"
        strokeWidth={1}
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
      {axes && (
        <path
          d={AXES_PATH}
          stroke="var(--map-grat)"
          strokeWidth={1.6}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path
        d={LAND_PATH}
        fill="var(--map-land)"
        stroke="var(--map-coast)"
        strokeWidth={1}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </>
  )
}

function Marker({ x, y, big }: { x: number; y: number; big?: boolean }) {
  const r = big ? 5 : 3.5
  return (
    <g>
      <circle
        className="cuboid-ping"
        cx={x}
        cy={y}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={x} cy={y} r={r} fill="var(--accent)" />
      <circle
        cx={x}
        cy={y}
        r={r + 3}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1}
        opacity={0.6}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  )
}

// The world view drops the empty polar oceans: a band from 72°N to 58°S holds every
// coastline that matters and gives a far better page proportion than the full sheet.
// It is widened when the target sits outside it  Antarctic surveys are real work.
function band(lat: number) {
  const north = Math.min(90, Math.max(72, lat + 10))
  const south = Math.max(-90, Math.min(-58, lat - 10))
  const y = py(north)
  return { y, h: py(south) - y }
}

export function WorldMap({
  lat,
  lon,
  className,
  inset = true,
}: {
  lat: number
  lon: number
  className?: string
  /** show the regional close-up beneath the world view */
  inset?: boolean
}) {
  const x = px(lon)
  const y = py(lat)
  const bd = band(lat)

  // regional crop, clamped inside the sheet: 30° of longitude by 20° of latitude 
  // landscape, so the pair of panels stays a sane height in a narrow column
  const cw = 60
  const ch = 40
  const cx = Math.min(Math.max(x - cw / 2, 0), W - cw)
  const cy = Math.min(Math.max(y - ch / 2, 0), H - ch)

  return (
    <div className={cn('space-y-2', className)}>
      <div className="panel-marks overflow-hidden rounded-lg border">
        <svg
          viewBox={`0 ${bd.y} ${W} ${bd.h}`}
          className="block w-full"
          role="img"
          aria-label={`World map marking ${coord(lat)}, ${coord(lon)}`}
        >
          <Basemap />

          {/* crosshair out to the sheet edges */}
          <path
            d={`M${x} ${bd.y} V${bd.y + bd.h} M0 ${y} H${W}`}
            stroke="var(--accent)"
            strokeWidth={1}
            strokeDasharray="5 5"
            opacity={0.6}
            fill="none"
            vectorEffect="non-scaling-stroke"
          />

          {/* what the inset below is showing */}
          {inset && (
            <rect
              x={cx}
              y={cy}
              width={cw}
              height={ch}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.2}
              opacity={0.85}
              vectorEffect="non-scaling-stroke"
            />
          )}

          <Marker x={x} y={y} big />
        </svg>
      </div>

      {inset && (
        <div className="panel-marks overflow-hidden rounded-lg border">
          <svg
            viewBox={`${cx} ${cy} ${cw} ${ch}`}
            className="block w-full"
            role="img"
            aria-label="Regional close-up"
          >
            <Basemap axes={false} />
            <path
              d={`M${x} ${cy} V${cy + ch} M${cx} ${y} H${cx + cw}`}
              stroke="var(--accent)"
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.7}
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
            <Marker x={x} y={y} />
          </svg>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-3">
        <span className="label-micro">{inset ? '30° × 20° window' : 'WGS 84'}</span>
        <span className="tnum text-xs">
          {coord(lat)}
          <span className="text-muted-foreground">, </span>
          {coord(lon)}
        </span>
      </div>
    </div>
  )
}
