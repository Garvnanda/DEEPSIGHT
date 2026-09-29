// A real slice of the survey's waterfall, fetched as a PNG from the tile endpoint, with
// an optional detection box drawn on top. Used by the walkthrough so the pictures on
// screen are the same pictures the console shows.

import { useEffect, useState } from 'react'

import { CLASS_COLOR_VAR } from '@/components/common/ClassBadge'
import { getWaterfallTile } from '@/lib/api'
import type { DetectionClass } from '@/lib/types'
import { cn } from '@/lib/utils'

export interface StripBox {
  x: number
  y: number
  w: number
  h: number
  cls: DetectionClass
  label: string
}

export function WaterfallStrip({
  surveyId,
  startPing,
  count,
  box,
  className,
}: {
  surveyId: string
  startPing: number
  count: number
  box?: StripBox
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    let dead = false
    let objUrl = ''
    setUrl(null)
    setErr(false)
    getWaterfallTile(surveyId, startPing, count, false)
      .then((b) => {
        if (dead) return
        objUrl = URL.createObjectURL(b)
        setUrl(objUrl)
      })
      .catch(() => {
        if (!dead) setErr(true)
      })
    return () => {
      dead = true
      if (objUrl) URL.revokeObjectURL(objUrl)
    }
  }, [surveyId, startPing, count])

  return (
    <div
      className={cn('panel-marks relative overflow-hidden rounded-lg border', className)}
      style={{ background: 'var(--wf-void)', minHeight: 140 }}
    >
      {url ? (
        <img
          src={url}
          alt="sonar waterfall strip"
          className="block w-full"
          style={{ imageRendering: 'pixelated' }}
          onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        />
      ) : (
        <div className="label-micro grid h-36 place-items-center">
          {err ? 'strip unavailable' : 'reading pings…'}
        </div>
      )}

      {/* Nothing is drawn over the sonar itself except the detection box  the picture
          is the evidence, and chrome stamped on top only gets in its way. */}
      {box && nat && (
        <div
          className="pointer-events-none absolute border-2"
          style={{
            left: `${(box.x / nat.w) * 100}%`,
            width: `${(box.w / nat.w) * 100}%`,
            top: `${((box.y - startPing) / count) * 100}%`,
            height: `${(box.h / count) * 100}%`,
            borderColor: CLASS_COLOR_VAR[box.cls],
          }}
        >
          <span
            className="absolute -top-5 left-0 whitespace-nowrap rounded px-1 text-[10px] font-medium text-black"
            style={{ background: CLASS_COLOR_VAR[box.cls] }}
          >
            {box.label}
          </span>
        </div>
      )}
    </div>
  )
}
