import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { useResolvedColors } from '@/lib/colors'
import type { DetectionClass } from '@/lib/types'
import { ALL_CLASSES, CLASS_LABEL } from '@/lib/types'

export function ClassBar({ counts }: { counts: Partial<Record<DetectionClass, number>> }) {
  const c = useResolvedColors()
  const data = ALL_CLASSES.map((cls) => ({ cls, label: CLASS_LABEL[cls], count: counts[cls] ?? 0 }))
  const total = data.reduce((a, d) => a + d.count, 0)

  if (total === 0) {
    return (
      <div className="grid h-[220px] place-items-center text-sm text-muted-foreground">
        No detections yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke={c['--muted-foreground']} />
        <YAxis
          type="category"
          dataKey="label"
          width={128}
          tick={{ fontSize: 11 }}
          stroke={c['--muted-foreground']}
        />
        <Tooltip
          cursor={{ fill: c['--muted'] }}
          contentStyle={{
            background: c['--popover'],
            border: `1px solid ${c['--border']}`,
            borderRadius: 8,
            fontSize: 12,
            color: c['--popover-foreground'],
          }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={22}>
          {data.map((d) => (
            <Cell key={d.cls} fill={c.cls[d.cls]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
