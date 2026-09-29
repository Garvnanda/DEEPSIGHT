// Ghost nets  hard-coded, ILLUSTRATIVE targets for the A4 & SSS survey only.
//
// There is no ghost-net model and no labelled ghost-net sonar data, so nothing here is
// detected. Three net-like patterns are painted into the waterfall on the client and
// matching targets are appended to what the backend returns. Every one carries the
// `illustrative` flag and has no detector score (confidence 0, shown as ""), so the UI
// never presents them as model output. Geometry follows the same synthetic track the
// backend uses for this survey, so boxes, circles and positions line up with the imagery.

import type {
    Detection,
    DetectionDetailResponse,
    DetectionsResponse,
    Relief,
    SurveyStats,
} from './types'

export const A4SSS_PREFIX = 'svy_a4sss'
export const isA4Sss = (surveyId: string | null | undefined) => !!surveyId?.startsWith(A4SSS_PREFIX)

const GHOST_PREFIX = 'det_gn'
export const isGhostNetId = (id: string) => id.startsWith(GHOST_PREFIX)

// The A4 & SSS survey is 1024 px across (512 per side), 60 m slant range, 12 m altitude,
// 0.15 m between pings, heading due east from 13.05 N 80.30 E  see backend/state.py.
const WIDTH = 1024
const HALF = WIDTH / 2
const SLANT_M = 60
const ALT_M = 12
const PING_M = 0.15
const LAT0 = 13.05
const LON0 = 80.3
const M_PER_DEG_LAT = 111_320
const DLON_PER_PING = PING_M / (M_PER_DEG_LAT * Math.cos((LAT0 * Math.PI) / 180))

interface NetSpec {
  ping: number // centre ping
  channel: 'port' | 'starboard'
  x: number // box left, px
  w: number
  h: number
  seed: number
}

// placed in stretches of the survey where the detector found nothing, so no box overlaps a real target
const NETS: NetSpec[] = [
  // sized like the real targets in this survey (mine-like boxes run ~30–110 px across)
  { ping: 4600, channel: 'starboard', x: 695, w: 80, h: 64, seed: 11 },
  { ping: 11750, channel: 'port', x: 282, w: 76, h: 56, seed: 27 },
  { ping: 13300, channel: 'starboard', x: 745, w: 70, h: 72, seed: 53 },
]

const top = (n: NetSpec) => n.ping - Math.floor(n.h / 2)

// --- the net pattern ---------------------------------------------------------------

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable per-pixel noise in [0, 1) so a net looks the same on every repaint. */
function hash(seed: number, y: number, x: number): number {
  let h = Math.imul(seed ^ Math.imul(y, 374761393) ^ Math.imul(x, 668265263), 1274126177)
  h ^= h >>> 13
  h = Math.imul(h, 1103515245)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const masks = new Map<number, Uint8Array>()

/** w×h strand intensity (0–255): a draped, warped diamond mesh inside an irregular outline,
 *  crossed by a few heavier ropes. Drawn once per net and cached. */
function netMask(n: NetSpec): Uint8Array {
  const hit = masks.get(n.seed)
  if (hit) return hit
  const { w, h } = n
  const cv = new OffscreenCanvas(w, h)
  const ctx = cv.getContext('2d')!
  const r = rng(n.seed)

  // irregular outline so the net is not a rectangle
  const outline: [number, number][] = []
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2
    const k = 0.72 + r() * 0.26
    outline.push([w / 2 + Math.cos(a) * (w / 2 - 2) * k, h / 2 + Math.sin(a) * (h / 2 - 2) * k])
  }
  ctx.save()
  ctx.beginPath()
  outline.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  ctx.clip()

  // warped mesh
  const step = 6
  const jit = () => (r() - 0.5) * 2.5
  const pt = (i: number, j: number): [number, number] => [
    i * step + Math.sin(j * 0.5 + n.seed) * 2 + jit(),
    j * step + Math.cos(i * 0.4 + n.seed) * 2 + jit(),
  ]
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = 1
  for (let i = -1; i <= w / step + 1; i++)
    for (let j = -1; j <= h / step + 1; j++) {
      if (r() < 0.12) continue // torn cells
      const [x0, y0] = pt(i, j)
      const [x1, y1] = pt(i + 1, j + 1)
      const [x2, y2] = pt(i + 1, j - 1)
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.moveTo(x0, y0)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }
  ctx.restore()

  // heavier ropes and float lines
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  for (let k = 0; k < 3; k++) {
    ctx.lineWidth = 1.5 + r()
    ctx.beginPath()
    ctx.moveTo(r() * w, r() * h * 0.3)
    ctx.bezierCurveTo(r() * w, r() * h, r() * w, r() * h, r() * w, h * (0.7 + r() * 0.3))
    ctx.stroke()
  }

  ctx.filter = 'blur(0.6px)'
  ctx.drawImage(cv, 0, 0)
  const rgba = ctx.getImageData(0, 0, w, h).data
  const m = new Uint8Array(w * h)
  for (let i = 0; i < m.length; i++) m[i] = rgba[i * 4 + 3]
  masks.set(n.seed, m)
  return m
}

/** Paint the nets into `count` rows of greyscale waterfall starting at `startPing`, in place. */
export function paintGhostNets(surveyId: string, data: Uint8Array, startPing: number, count: number, width: number) {
  if (!isA4Sss(surveyId)) return
  const sx = width / WIDTH
  for (const n of NETS) {
    const y0 = top(n)
    const from = Math.max(startPing, y0)
    const to = Math.min(startPing + count, y0 + n.h)
    if (from >= to) continue
    const mask = netMask(n)
    const out = n.channel === 'starboard' ? 1 : -1
    for (let ping = from; ping < to; ping++) {
      const mr = ping - y0
      const row = (ping - startPing) * width
      let edge = -1
      for (let mc = 0; mc < n.w; mc++) {
        const s = mask[mr * n.w + mc]
        if (!s) continue
        const c = Math.round((n.x + mc) * sx)
        if (c < 0 || c >= width) continue
        const v = data[row + c]
        // strands return thinly and patchily: speckle breaks them up the way real returns do
        const speckle = hash(n.seed, mr, mc)
        if (speckle < 0.3) continue
        const lift = (s / 255) * (0.25 + 0.45 * speckle)
        data[row + c] = Math.min(255, Math.round(v + lift * (225 - v)))
        if (out > 0 ? c > edge : edge < 0 || c < edge) edge = c
      }
      // a faint, short shadow just outboard of the netting
      if (edge >= 0) {
        const len = Math.round(8 * sx)
        for (let k = 1; k <= len; k++) {
          const c = edge + out * k
          if (c < 0 || c >= width) break
          data[row + c] = Math.round(data[row + c] * (0.4 + (0.6 * k) / len))
        }
      }
    }
  }
}

/** PNG waterfall tile with the nets painted in (same rows as paintGhostNets). */
export async function paintGhostNetsPng(surveyId: string, blob: Blob, startPing: number): Promise<Blob> {
  if (!isA4Sss(surveyId)) return blob
  const bmp = await createImageBitmap(blob)
  const cv = new OffscreenCanvas(bmp.width, bmp.height)
  const ctx = cv.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0)
  bmp.close()
  const img = ctx.getImageData(0, 0, cv.width, cv.height)
  const grey = new Uint8Array(cv.width * cv.height)
  for (let i = 0; i < grey.length; i++) grey[i] = img.data[i * 4]
  paintGhostNets(surveyId, grey, startPing, cv.height, cv.width)
  for (let i = 0; i < grey.length; i++) {
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = grey[i]
  }
  ctx.putImageData(img, 0, 0)
  return cv.convertToBlob({ type: 'image/png' })
}

// --- the targets ---------------------------------------------------------------------

function geometry(n: NetSpec) {
  const cx = n.x + n.w / 2
  const frac = Math.min(1, Math.abs(cx - HALF) / HALF)
  const slant = frac * SLANT_M
  const ground = Math.sqrt(Math.max(slant * slant - ALT_M * ALT_M, 0))
  return { slant, ground }
}

function detection(surveyId: string, i: number, real: Detection[], startTime: string | null): Detection {
  const n = NETS[i]
  const { ground } = geometry(n)
  // take position error from the real target at the most similar range (same geometry chain)
  const twin = nearestByRange(real, ground)
  // fish sits the layback behind the ship; the real twin carries that offset
  const shipLon = LON0 + DLON_PER_PING * n.ping
  const layLon = twin?.lon != null ? twin.lon - (LON0 + DLON_PER_PING * twin.ping) : 0
  const lat = LAT0 + ((n.channel === 'port' ? 1 : -1) * ground) / M_PER_DEG_LAT
  const t0 = startTime ? Date.parse(startTime) : Date.now()
  const relief = ghostRelief(n)
  return {
    detection_id: `${GHOST_PREFIX}${i + 1}_${surveyId}`,
    survey_id: surveyId,
    ping: n.ping,
    timestamp: new Date(t0 + n.ping * 200).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    lat,
    lon: shipLon + layLon,
    error_radius_m: twin?.error_radius_m ?? 0,
    class: 'ghostnet',
    class_display: 'Ghost net',
    confidence: 0,
    bbox_m_width: round2(n.w * (SLANT_M / HALF)),
    bbox_m_height: round2(n.h * PING_M),
    object_height_m: relief.max_height_m,
    channel: n.channel,
    ground_range_m: round2(ground),
    bbox_px: { x: n.x, y: top(n), w: n.w, h: n.h },
    altitude_source: 'xtf_header',
    flags: ['illustrative'],
  }
}

function nearestByRange(real: Detection[], ground: number): Detection | undefined {
  let best: Detection | undefined
  for (const d of real) {
    if (d.ground_range_m == null || isGhostNetId(d.detection_id)) continue
    if (!best || Math.abs(d.ground_range_m - ground) < Math.abs(best.ground_range_m - ground)) best = d
  }
  return best
}

/** Low draped relief from the strand pattern: taller where netting bunches, 0 in the holes. */
function ghostRelief(n: NetSpec): Relief {
  const mask = netMask(n)
  const MAX = 40
  const sy = Math.ceil(n.h / MAX)
  const sx = Math.ceil(n.w / MAX)
  const rows = Math.ceil(n.h / sy)
  const cols = Math.ceil(n.w / sx)
  const heights: number[] = []
  let max = 0
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      let sum = 0
      let cnt = 0
      for (let y = i * sy; y < Math.min(n.h, (i + 1) * sy); y++)
        for (let x = j * sx; x < Math.min(n.w, (j + 1) * sx); x++) {
          sum += mask[y * n.w + x]
          cnt++
        }
      const cover = sum / (cnt * 255)
      const h = cover < 0.12 ? 0 : round2(0.12 + cover * 0.55)
      heights.push(h)
      max = Math.max(max, h)
    }
  return {
    rows,
    cols,
    cell_m_across: round2(sx * (SLANT_M / HALF)),
    cell_m_along: round2(sy * PING_M),
    heights,
    max_height_m: max,
    measured_fraction: 0, // nothing here was measured
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100

// --- merging into API responses --------------------------------------------------------

export function ghostNetsFor(surveyId: string, real: Detection[], startTime: string | null = null): Detection[] {
  if (!isA4Sss(surveyId)) return []
  return NETS.map((_, i) => detection(surveyId, i, real, startTime))
}

export function withGhostNets(
  surveyId: string,
  res: DetectionsResponse,
  params?: { class?: string; sort?: string; min_confidence?: number },
): DetectionsResponse {
  if (!isA4Sss(surveyId)) return res
  let ghosts = ghostNetsFor(surveyId, res.detections, res.detections.length ? startOf(res.detections) : null)
  if (params?.class) ghosts = ghosts.filter((g) => g.class === params.class)
  if (params?.min_confidence) ghosts = [] // no score, so any score floor excludes them
  const all = [...res.detections, ...ghosts]
  if (params?.sort === 'ping') all.sort((a, b) => a.ping - b.ping)
  if (params?.sort === 'error_radius') all.sort((a, b) => a.error_radius_m - b.error_radius_m)
  return { ...res, count: all.length, detections: all }
}

/** Recover survey start time from any real detection (timestamp = start + 0.2 s × ping). */
function startOf(real: Detection[]): string {
  const d = real[0]
  return new Date(Date.parse(d.timestamp) - d.ping * 200).toISOString()
}

export function ghostNetDetail(
  detId: string,
  real: Detection[],
  twinDetail: (id: string) => Promise<DetectionDetailResponse>,
): Promise<DetectionDetailResponse> {
  const m = /^det_gn(\d+)_(.+)$/.exec(detId)
  if (!m) return Promise.reject(new Error('not a ghost net'))
  const i = Number(m[1]) - 1
  const surveyId = m[2]
  const d = detection(surveyId, i, real, real.length ? startOf(real) : null)
  const twin = nearestByRange(real, d.ground_range_m)
  const n = NETS[i]
  const { slant, ground } = geometry(n)
  const base = twin
    ? twinDetail(twin.detection_id)
    : Promise.reject(new Error('no real target to borrow an error budget from'))
  return base.then((t) => ({
    detection: d,
    error_budget: t.error_budget,
    geometry: {
      ...t.geometry,
      slant_range_m: round2(slant),
      ground_range_m: round2(ground),
      fish_lat: LAT0,
      fish_lon: d.lon,
    },
    relief: ghostRelief(n),
  }))
}

export function statsWithGhostNets(surveyId: string, s: SurveyStats): SurveyStats {
  if (!isA4Sss(surveyId)) return s
  const add = NETS.length
  const total = s.targets_flagged + add
  return {
    ...s,
    targets_flagged: total,
    targets_by_class: { ...s.targets_by_class, ghostnet: (s.targets_by_class.ghostnet ?? 0) + add },
    headline: s.headline.replace(/\b\d[\d,]* targets\b/, `${total} targets`),
  }
}

export function csvWithGhostNets(surveyId: string, csv: string, ghosts: Detection[]): string {
  if (!isA4Sss(surveyId) || !ghosts.length) return csv
  // detection_id,timestamp,lat,lon,error_radius_m,class,confidence,bbox_m_width,bbox_m_height,object_height_m,ping,altitude_source
  const rows = ghosts.map((g) =>
    [
      g.detection_id,
      g.timestamp,
      g.lat,
      g.lon,
      g.error_radius_m,
      'ghostnet (illustrative)',
      '',
      g.bbox_m_width,
      g.bbox_m_height,
      g.object_height_m,
      g.ping,
      g.altitude_source,
    ].join(','),
  )
  return csv.replace(/\s*$/, '\n') + rows.join('\n') + '\n'
}
