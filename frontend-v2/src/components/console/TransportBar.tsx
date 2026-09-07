import { Pause, Play, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { num } from '@/lib/format'
import { cn } from '@/lib/utils'
import { usePlaybackStore } from '@/stores/playbackStore'

const SPEEDS = [1, 2, 4, 8]

export function TransportBar({ surveyId, totalPings }: { surveyId: string; totalPings: number }) {
  const state = usePlaybackStore((s) => s.state)
  const cur = usePlaybackStore((s) => s.currentPing)
  const speed = usePlaybackStore((s) => s.speed)
  const corrected = usePlaybackStore((s) => s.correctedView)

  const start = usePlaybackStore((s) => s.start)
  const pause = usePlaybackStore((s) => s.pause)
  const resume = usePlaybackStore((s) => s.resume)
  const seek = usePlaybackStore((s) => s.seek)
  const setSpeed = usePlaybackStore((s) => s.setSpeed)
  const toggleCorrected = usePlaybackStore((s) => s.toggleCorrected)

  const playing = state === 'playing'

  const onPlayPause = () => {
    if (state === 'idle' || state === 'complete' || state === 'error') {
      start(surveyId, totalPings)
    } else if (playing) pause()
    else resume()
  }

  return (
    <div className="flex items-center gap-3 border-t bg-card px-3 py-2">
      <Button size="icon" variant="secondary" onClick={onPlayPause} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>
      {(state === 'complete' || state === 'error') && (
        <Button size="icon" variant="ghost" onClick={() => start(surveyId, totalPings)} aria-label="Restart">
          <RotateCcw className="size-4" />
        </Button>
      )}

      <Slider
        value={[Math.min(cur, totalPings)]}
        onValueChange={([v]) => seek(v)}
        min={0}
        max={totalPings || 1}
        step={1}
        className="flex-1"
        aria-label="Playback timeline"
      />

      <span className="tnum shrink-0 text-xs text-muted-foreground">
        {num(cur)} / {num(totalPings)}
      </span>

      <div className="flex shrink-0 items-center gap-0.5 rounded-md border p-0.5">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={cn(
              'rounded px-2 py-1 text-xs font-medium tabular-nums transition-colors',
              speed === s ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {s}×
          </button>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 rounded-md border p-0.5">
        <button
          onClick={() => corrected && toggleCorrected()}
          className={cn('rounded px-2 py-1 text-xs font-medium transition-colors', !corrected ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground')}
        >
          raw
        </button>
        <button
          onClick={() => !corrected && toggleCorrected()}
          className={cn('rounded px-2 py-1 text-xs font-medium transition-colors', corrected ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground')}
        >
          geo
        </button>
      </div>
    </div>
  )
}
