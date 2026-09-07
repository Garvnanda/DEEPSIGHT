import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { useResolvedColors } from '@/lib/colors'
import type { Detection } from '@/lib/types'

/** Histogram of per-target error radius. The point of the whole project is that this
 *  varies target to target  showing the spread makes that concrete. */
export function ErrorHistogram({ detections }: { detections: Detection[] }) {
  const c = useResolvedColors()
  const radii = detections.map((d) => d.error_radius_m).filter((r) => Number.isFinite(r))
  if (radii.length === 0) {
    return (
      <div className="grid h-[220px] place-items-center text-sm text-muted-foreground">
        No located targets yet
      </div>
    )
  }

  const max = Math.max(...radii)
  const binCount = Math.min(12, Math.max(4, Math.ceil(Math.sqrt(radii.length))))
  const binWidth = Math.max(1, Math.ceil(max / binCount))
  const bins = Array.from({ length: binCount }, (_, i) => ({
    label: `${i * binWidth}–${(i + 1) * binWidth}`,
    count: 0,
  }))
  for (const r of radii) {
    const idx = Math.min(binCount - 1, Math.floor(r / binWidth))
    bins[idx].count++
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={bins} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10 }}
          stroke={c['--muted-foreground']}
          interval={0}
          angle={-30}
          textAnchor="end"
          height={48}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke={c['--muted-foreground']} width={28} />
        <Tooltip
          cursor={{ fill: c['--muted'] }}
          contentStyle={{
            background: c['--popover'],
            border: `1px solid ${c['--border']}`,
            borderRadius: 8,
            fontSize: 12,
            color: c['--popover-foreground'],
          }}
          formatter={(v) => [`${v as number} targets`, '']}
          labelFormatter={(l) => `${l} m`}
        />
        <Bar dataKey="count" fill={c['--chart-1']} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
