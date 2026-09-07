// Track map — Leaflet with NO basemap tiles (fully offline). A lat/lon graticule for
// orientation, the survey bounding box, the vessel track, the live position, and one
// metre-accurate circle per detection sized by its error radius.

import 'leaflet/dist/leaflet.css'

import type { LatLngBoundsLiteral, LatLngExpression } from 'leaflet'
import { useEffect, useMemo } from 'react'
import { Circle, CircleMarker, MapContainer, Polyline, Rectangle, useMap } from 'react-leaflet'

import { useResolvedColors } from '@/lib/colors'
import type { Detection, SurveyBounds, TrackFeature } from '@/lib/types'

function niceStep(span: number): number {
  const raw = span / 6
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n = raw / mag
  const step = n >= 5 ? 5 : n >= 2 ? 2 : 1
  return step * mag
}

function Graticule({ bounds, color }: { bounds: SurveyBounds; color: string }) {
  const lines = useMemo(() => {
    const pad = 0.15
    const latSpan = Math.max(bounds.north - bounds.south, 1e-4)
    const lonSpan = Math.max(bounds.east - bounds.west, 1e-4)
    const s = bounds.south - latSpan * pad
    const n = bounds.north + latSpan * pad
    const w = bounds.west - lonSpan * pad
    const e = bounds.east + lonSpan * pad
    const latStep = niceStep(n - s)
    const lonStep = niceStep(e - w)
    const out: LatLngExpression[][] = []
    for (let lat = Math.ceil(s / latStep) * latStep; lat <= n; lat += latStep) {
      out.push([
        [lat, w],
        [lat, e],
      ])
    }
    for (let lon = Math.ceil(w / lonStep) * lonStep; lon <= e; lon += lonStep) {
      out.push([
        [s, lon],
        [n, lon],
      ])
    }
    return out
  }, [bounds])

  return (
    <>
      {lines.map((l, i) => (
        <Polyline
          key={i}
          positions={l}
          pathOptions={{ color, weight: 1, opacity: 0.4, interactive: false }}
        />
      ))}
    </>
  )
}

function FitBounds({ bounds }: { bounds: SurveyBounds }) {
  const map = useMap()
  useEffect(() => {
    // Leaflet renders blank when its container had no size at mount (flex/percentage
    // heights, a hidden tab). Recompute size before fitting.
    map.invalidateSize(false)
    const pad = 0.15
    const latSpan = Math.max(bounds.north - bounds.south, 1e-4)
    const lonSpan = Math.max(bounds.east - bounds.west, 1e-4)
    const b: LatLngBoundsLiteral = [
      [bounds.south - latSpan * pad, bounds.west - lonSpan * pad],
      [bounds.north + latSpan * pad, bounds.east + lonSpan * pad],
    ]
    map.fitBounds(b, { animate: false })
    const t = setTimeout(() => map.invalidateSize(false), 200)
    return () => clearTimeout(t)
  }, [bounds, map])
  return null
}

function PanToSelected({ detections, selectedId }: { detections: Detection[]; selectedId: string | null }) {
  const map = useMap()
  useEffect(() => {
    if (!selectedId) return
    const d = detections.find((x) => x.detection_id === selectedId)
    if (d?.lat != null && d.lon != null) map.panTo([d.lat, d.lon], { animate: true })
  }, [selectedId, detections, map])
  return null
}

interface Props {
  bounds: SurveyBounds
  track: TrackFeature | null
  vessel: [number, number] | null
  detections: Detection[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function TrackMap({ bounds, track, vessel, detections, selectedId, onSelect }: Props) {
  const c = useResolvedColors()
  const trackPositions = useMemo<LatLngExpression[]>(
    () => (track?.geometry.coordinates ?? []).map(([lon, lat]) => [lat, lon]),
    [track],
  )
  const center: LatLngExpression = [
    (bounds.north + bounds.south) / 2,
    (bounds.east + bounds.west) / 2,
  ]

  return (
    <MapContainer
      center={center}
      zoom={13}
      zoomControl={false}
      attributionControl={false}
      className="h-full w-full"
      style={{ background: 'var(--wf-void)' }}
    >
      <FitBounds bounds={bounds} />
      <PanToSelected detections={detections} selectedId={selectedId} />
      <Graticule bounds={bounds} color={c['--wf-grid']} />
      <Rectangle
        bounds={[
          [bounds.south, bounds.west],
          [bounds.north, bounds.east],
        ]}
        pathOptions={{ color: c['--muted-foreground'], weight: 1, dashArray: '4 4', fill: false, interactive: false }}
      />

      {trackPositions.length > 1 && (
        <Polyline positions={trackPositions} pathOptions={{ color: c['--accent'], weight: 2, opacity: 0.85 }} />
      )}

      {vessel && (
        <CircleMarker
          center={vessel}
          radius={4}
          pathOptions={{ color: c['--accent'], fillColor: c['--accent'], fillOpacity: 1, weight: 2 }}
        />
      )}

      {detections
        .filter((d) => d.lat != null && d.lon != null)
        .map((d) => {
          const sel = d.detection_id === selectedId
          const col = c.cls[d.class]
          return (
            <Circle
              key={d.detection_id}
              center={[d.lat as number, d.lon as number]}
              radius={d.error_radius_m}
              pathOptions={{
                color: sel ? '#ffffff' : col,
                fillColor: col,
                fillOpacity: Math.min(0.4, d.confidence * 0.4),
                weight: sel ? 3 : d.class === 'nombo' ? 1 : 2,
              }}
              eventHandlers={{ click: () => onSelect(d.detection_id) }}
            />
          )
        })}
    </MapContainer>
  )
}
