import { Crosshair, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ClassBadge, ClassDot } from '@/components/common/ClassBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { FlagChips } from '@/components/common/FlagChips'
import { Panel } from '@/components/common/Panel'
import { DetectionDetail } from '@/components/detections/DetectionDetail'
import { PageContainer } from '@/components/PageContainer'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { useAsync } from '@/hooks/useAsync'
import { getDetections } from '@/lib/api'
import { coord, metres, num } from '@/lib/format'
import type { Detection, DetectionClass, DetectionSort } from '@/lib/types'
import { ALL_CLASSES, CLASS_LABEL } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useSelectionStore } from '@/stores/selectionStore'
import { useSurveyStore } from '@/stores/surveyStore'

const ALL = '__all__'

export function Detections() {
  const { surveys, refresh } = useSurveyStore()
  const [params, setParams] = useSearchParams()
  const survey = params.get('survey') ?? ALL

  const [classes, setClasses] = useState<Set<DetectionClass>>(new Set())
  const [minConf, setMinConf] = useState(0)
  const [sort, setSort] = useState<DetectionSort>('error_radius')

  const { selectedId, detail, loading: detailLoading, select, clear } = useSelectionStore()

  useEffect(() => {
    void refresh()
  }, [refresh])

  const complete = useMemo(
    () => surveys.filter((s) => ['ready', 'complete'].includes(s.status)),
    [surveys],
  )

  const targetIds = survey === ALL ? complete.slice(0, 12).map((s) => s.survey_id) : [survey]

  const { data, loading } = useAsync(async () => {
    const lists = await Promise.all(targetIds.map((id) => getDetections(id).catch(() => null)))
    return lists.filter(Boolean).flatMap((l) => l!.detections)
  }, [targetIds.join(',')])

  const rows = useMemo(() => {
    let r = data ?? []
    if (classes.size) r = r.filter((d) => classes.has(d.class))
    if (minConf > 0) r = r.filter((d) => d.confidence >= minConf)
    const cmp: Record<DetectionSort, (a: Detection, b: Detection) => number> = {
      error_radius: (a, b) => a.error_radius_m - b.error_radius_m,
      confidence: (a, b) => b.confidence - a.confidence,
      ping: (a, b) => a.ping - b.ping,
    }
    return [...r].sort(cmp[sort])
  }, [data, classes, minConf, sort])

  const toggleClass = (c: DetectionClass) => {
    setClasses((prev) => {
      const n = new Set(prev)
      n.has(c) ? n.delete(c) : n.add(c)
      return n
    })
  }

  return (
    <PageContainer
      kicker="Worklist"
      title="Detections"
      meta={`${num(rows.length)} shown${data ? ` / ${num(data.length)}` : ''}`}
      description="Every target the detector flagged, across surveys. Sorted tightest-circle first  those are the ones a team can act on."
      actions={
        <Select value={survey} onValueChange={(v) => setParams(v === ALL ? {} : { survey: v })}>
          <SelectTrigger className="w-[260px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All surveys</SelectItem>
            {complete.map((s) => (
              <SelectItem key={s.survey_id} value={s.survey_id}>
                {s.filename}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <Panel
        className="mb-4"
        title={
          <span className="flex items-center gap-1.5">
            <SlidersHorizontal className="size-3" /> Filters
          </span>
        }
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap gap-1.5">
            {ALL_CLASSES.map((c) => (
              <button
                key={c}
                onClick={() => toggleClass(c)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  classes.has(c)
                    ? 'border-accent bg-accent/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <ClassDot cls={c} />
                {CLASS_LABEL[c]}
              </button>
            ))}
          </div>
          <div className="flex min-w-[200px] flex-1 items-center gap-3">
            <span className="text-xs text-muted-foreground">Min score</span>
            <Slider
              value={[minConf]}
              onValueChange={([v]) => setMinConf(v)}
              min={0}
              max={1}
              step={0.05}
              className="max-w-[200px]"
            />
            <span className="tnum w-8 text-xs">{minConf.toFixed(2)}</span>
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as DetectionSort)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="error_radius">Tightest circle</SelectItem>
              <SelectItem value="confidence">Highest score</SelectItem>
              <SelectItem value="ping">Survey order</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Panel>

      <Panel title="Targets" right={<span className="label-micro">click a row for the derivation</span>} flush>
        {loading ? (
          <div className="space-y-px p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            className="rounded-none border-0"
            icon={<Crosshair className="size-8" />}
            title="No detections match"
            description={
              (data?.length ?? 0) === 0
                ? 'The selected survey has no flagged targets.'
                : 'Loosen the filters to see more.'
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Ping</TableHead>
                <TableHead className="text-right">Position</TableHead>
                <TableHead className="text-right">± radius</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => (
                <TableRow
                  key={d.detection_id}
                  className="cursor-pointer border-l-2 border-transparent transition-colors hover:border-accent hover:bg-accent/5"
                  onClick={() => select(d.detection_id)}
                >
                  <TableCell>
                    <ClassBadge cls={d.class} />
                  </TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">
                    {num(d.ping)}
                  </TableCell>
                  <TableCell className="tnum text-right text-xs text-muted-foreground">
                    {d.lat == null ? '' : `${coord(d.lat)}, ${coord(d.lon)}`}
                  </TableCell>
                  <TableCell className="tnum text-right" style={{ color: 'var(--warn)' }}>
                    {metres(d.error_radius_m)}
                  </TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">
                    {d.confidence.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <FlagChips flags={d.flags} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Sheet open={!!selectedId} onOpenChange={(v) => !v && clear()}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Target detail</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            <DetectionDetail detail={detail} loading={detailLoading} />
          </div>
        </SheetContent>
      </Sheet>
    </PageContainer>
  )
}
