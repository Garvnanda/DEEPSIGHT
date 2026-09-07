import { ClassBadge } from '@/components/common/ClassBadge'
import { FlagChips } from '@/components/common/FlagChips'
import { TrackMap } from '@/components/console/TrackMap'
import { Cuboid3D } from '@/components/tour/Cuboid3D'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import type { DetectionDetailResponse } from '@/lib/types'
import { coord, metres, num } from '@/lib/format'
import { ErrorBudgetBar } from './ErrorBudgetBar'

export function DetectionDetail({
  detail,
  loading,
}: {
  detail: DetectionDetailResponse | null
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-3 p-1">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  if (!detail) {
    return <p className="p-4 text-sm text-muted-foreground">Select a target to see how its position was derived.</p>
  }

  const { detection: d, error_budget: eb, geometry: g } = detail

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between">
        <ClassBadge cls={d.class} showCode />
        <span className="tnum text-xs text-muted-foreground">ping {num(d.ping)}</span>
      </div>

      <div className="rounded-lg border bg-muted/40 p-3">
        <Row k="Latitude" v={d.lat == null ? 'unavailable' : coord(d.lat)} mono={d.lat != null} />
        <Row k="Longitude" v={d.lon == null ? 'unavailable' : coord(d.lon)} mono={d.lon != null} />
        <Row
          k="Search radius"
          v={<span style={{ color: 'var(--warn)' }}>± {metres(d.error_radius_m)}</span>}
        />
      </div>

      {/* the object, to scale */}
      <div className="rounded-lg border bg-card p-3">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Object — measured dimensions
        </div>
        <Cuboid3D
          widthM={d.bbox_m_width}
          lengthM={d.bbox_m_height}
          heightM={d.object_height_m}
        />
      </div>

      {/* where it is */}
      {d.lat != null && d.lon != null && (
        <div className="overflow-hidden rounded-lg border">
          <div className="h-44">
            <TrackMap
              bounds={mapBounds(d.lat, d.lon, d.error_radius_m)}
              track={null}
              vessel={null}
              detections={[d]}
              selectedId={d.detection_id}
              onSelect={() => {}}
            />
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium uppercase tracking-wide text-muted-foreground">
            Error budget
          </span>
          <span className="tnum">
            {metres(eb.total_m)} · {eb.method.replace(/_/g, ' ')}
          </span>
        </div>
        <ErrorBudgetBar budget={eb} />
        <p className="mt-2 rounded-md bg-muted/60 p-2 text-xs leading-relaxed">{eb.explanation}</p>
      </div>

      <Separator />

      <div>
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Geometry
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <Row k="Slant range" v={metres(g.slant_range_m)} dl />
          <Row k="Ground range" v={metres(g.ground_range_m)} dl />
          <Row k="Altitude" v={metres(g.altitude_m)} dl />
          <Row k="Layback" v={metres(g.layback_m)} dl />
          <Row k="Heading" v={`${num(g.heading_deg, 1)}°`} dl />
          <Row
            k="Fish position"
            v={
              g.fish_lat != null && g.fish_lon != null
                ? `${g.fish_lat.toFixed(4)}, ${g.fish_lon.toFixed(4)}`
                : 'unavailable'
            }
            dl
          />
        </dl>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <Row k="Dimensions" v={`${metres(d.bbox_m_width)} × ${metres(d.bbox_m_height)}`} dl />
        {d.object_height_m > 0 && <Row k="Height" v={metres(d.object_height_m)} dl />}
        <Row k="Detector score" v={d.confidence.toFixed(2)} dl />
        <Row k="Channel" v={d.channel} dl />
        <Row
          k="Altitude source"
          v={d.altitude_source === 'xtf_header' ? 'header' : 'estimated'}
          dl
        />
      </div>

      {d.flags.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Why the circle is this size
          </div>
          <FlagChips flags={d.flags} />
        </div>
      )}
    </div>
  )
}

/** A tight square window around one detection, sized to a few error radii. */
function mapBounds(lat: number, lon: number, radiusM: number) {
  const d = Math.max(radiusM * 4, 40) / 111_320
  return { north: lat + d, south: lat - d, east: lon + d, west: lon - d }
}

function Row({
  k,
  v,
  mono,
  dl,
}: {
  k: string
  v: React.ReactNode
  mono?: boolean
  dl?: boolean
}) {
  if (dl) {
    return (
      <>
        <dt className="text-muted-foreground">{k}</dt>
        <dd className={mono ? 'tnum text-right' : 'text-right'}>{v}</dd>
      </>
    )
  }
  return (
    <div className="flex items-center justify-between py-0.5 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className={mono ? 'tnum' : undefined}>{v}</span>
    </div>
  )
}
