import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { DetectionFlag } from '@/lib/types'
import { FLAG_LABEL } from '@/lib/types'

const WHY: Record<DetectionFlag, string> = {
  near_nadir: 'Target sits close to nadir  a small altitude error swings the ground range a long way.',
  on_turn: 'The line was turning here  heading uncertainty is larger, widening the circle.',
  long_layback: 'The towfish was well behind the ship  layback dominates the position error.',
  estimated_altitude: 'Altitude was estimated, not read from the header  every radius on this survey is wider.',
  range_change_nearby: 'The range setting changed near this ping  geometry either side is less certain.',
  illustrative: 'Hard-coded example, not a detection. No ghost-net model or labelled ghost-net sonar data exists yet, so this target has no detector score and its relief is not measured.',
}

export function FlagChips({ flags }: { flags: DetectionFlag[] }) {
  // 'illustrative' is an internal marker (drives the "—" score), not a shown tag
  const shown = flags.filter((f) => f !== 'illustrative')
  if (!shown.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((f) => (
        <Tooltip key={f}>
          <TooltipTrigger asChild>
            <span className="cursor-help rounded-md border border-warn/40 bg-warn/10 px-1.5 py-0.5 text-[11px] font-medium text-warn">
              {FLAG_LABEL[f]}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{WHY[f]}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}
