import { ArrowLeft, FileText, Loader2, Trash2, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { StatusBadge } from '@/components/common/StatusBadge'
import { WarningBanner } from '@/components/common/WarningBanner'
import { TrackMap } from '@/components/console/TrackMap'
import { TransportBar } from '@/components/console/TransportBar'
import { Worklist } from '@/components/console/Worklist'
import { DetectionDetail } from '@/components/detections/DetectionDetail'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { WaterfallCanvas } from '@/waterfall/WaterfallCanvas'
import { useAsync } from '@/hooks/useAsync'
import { ApiError, deleteSurvey, getDetections, getSurvey, getSurveyStatus, getTrack } from '@/lib/api'
import { metres, num } from '@/lib/format'
import type { Detection } from '@/lib/types'
import { usePlaybackStore } from '@/stores/playbackStore'
import { useSelectionStore } from '@/stores/selectionStore'

export function SurveyConsole() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const survey = useAsync(() => getSurvey(id), [id])

  const status = survey.data?.status
  const ready = status === 'ready' || status === 'complete' || status === 'processing'

  const [confirmDel, setConfirmDel] = useState(false)
  const [delBusy, setDelBusy] = useState(false)

  const onDelete = async () => {
    setDelBusy(true)
    try {
      await deleteSurvey(id)
      toast.success('Survey deleted.')
      navigate('/surveys')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not delete that survey.')
      setDelBusy(false)
    }
  }

  // poll while parsing
  const [parseProg, setParseProg] = useState<{ progress: number; pings: number } | null>(null)
  useEffect(() => {
    if (status !== 'uploaded' && status !== 'parsing') return
    const t = setInterval(async () => {
      try {
        const s = await getSurveyStatus(id)
        setParseProg({ progress: s.progress, pings: s.pings_processed })
        if (s.status === 'ready' || s.status === 'complete' || s.status === 'failed') survey.reload()
      } catch {
        /* ignore */
      }
    }, 1500)
    return () => clearInterval(t)
  }, [status, id, survey])

  const track = useAsync(() => (ready ? getTrack(id) : Promise.resolve(null)), [id, ready])
  const restDets = useAsync(
    () => (ready ? getDetections(id).then((r) => r.detections) : Promise.resolve<Detection[]>([])),
    [id, ready],
  )

  const liveDets = usePlaybackStore((s) => s.detections)
  const currentPing = usePlaybackStore((s) => s.currentPing)
  const playbackState = usePlaybackStore((s) => s.state)
  const reset = usePlaybackStore((s) => s.reset)
  const { selectedId, detail, loading: detailLoading, select, clear } = useSelectionStore()

  // reset playback + selection when the survey changes / on unmount
  useEffect(() => {
    reset()
    clear()
    return () => {
      reset()
      clear()
    }
  }, [id, reset, clear])

  const detections = useMemo(() => {
    const map = new Map<string, Detection>()
    for (const d of restDets.data ?? []) map.set(d.detection_id, d)
    for (const d of liveDets) map.set(d.detection_id, d)
    return [...map.values()]
  }, [restDets.data, liveDets])

  const total = survey.data?.ping_count ?? 0

  // approximate vessel position: walk the decimated track by playback progress
  const vessel = useMemo<[number, number] | null>(() => {
    const coords = track.data?.geometry.coordinates
    if (!coords?.length || total === 0) return null
    const idx = Math.min(coords.length - 1, Math.floor((currentPing / total) * coords.length))
    const [lon, lat] = coords[idx]
    return [lat, lon]
  }, [track.data, currentPing, total])

  const onPick = (d: Detection) => {
    select(d.detection_id)
    usePlaybackStore.getState().seek(d.ping)
  }

  if (survey.loading) {
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (survey.error || !survey.data) {
    return (
      <PageContainer title="Survey" bleed>
        <div className="grid h-full place-items-center px-6 text-center">
          <div>
            <TriangleAlert className="mx-auto mb-3 size-8 text-destructive" />
            <p className="text-sm">{survey.error ?? 'That survey no longer exists.'}</p>
            <Button asChild className="mt-4" variant="outline">
              <Link to="/surveys">Back to surveys</Link>
            </Button>
          </div>
        </div>
      </PageContainer>
    )
  }

  const s = survey.data

  if (!ready) {
    return (
      <div className="grid h-full place-items-center px-6">
        <div className="w-full max-w-sm text-center">
          <Loader2 className="mx-auto mb-4 size-6 animate-spin text-muted-foreground" />
          <p className="text-sm font-medium">
            {status === 'failed' ? 'Parsing failed' : 'Parsing survey…'}
          </p>
          {status === 'failed' ? (
            <p className="mt-1 text-sm text-destructive">{s.warnings[0] ?? 'The file could not be read.'}</p>
          ) : (
            <>
              <Progress className="mt-4" value={(parseProg?.progress ?? 0) * 100} />
              <p className="tnum mt-2 text-xs text-muted-foreground">
                {num(parseProg?.pings ?? 0)} pings read
              </p>
            </>
          )}
          <Button asChild variant="ghost" size="sm" className="mt-4">
            <Link to="/surveys">
              <ArrowLeft className="size-4" /> Surveys
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => navigate('/surveys')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{s.filename}</div>
          <div className="tnum text-xs text-muted-foreground">
            {num(s.frequency_khz)} kHz · range {metres(s.range_m)} · {num(s.ping_count)} pings
          </div>
        </div>
        <StatusBadge status={s.status} />
        <div className="ml-auto flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to={`/reports?survey=${id}`}>
              <FileText className="size-4" /> Report
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmDel(true)}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        </div>
      </div>

      {/* 3-zone body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_1fr_380px]">
        {/* left: worklist */}
        <div className="hidden min-h-0 border-r lg:block">
          <Worklist detections={detections} selectedId={selectedId} onSelect={onPick} />
        </div>

        {/* center: waterfall */}
        <div className="relative flex min-h-0 min-w-0 flex-col">
          <div className="px-3 pt-2">
            <WarningBanner warnings={s.warnings} />
          </div>
          <div className="relative min-h-0 flex-1">
            <WaterfallCanvas rangeM={s.range_m} />
            {playbackState === 'idle' && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-xs text-white/80 backdrop-blur-sm">
                  Press play to replay the survey
                </div>
              </div>
            )}
            <div className="tnum pointer-events-none absolute bottom-2 left-3 text-[11px] text-muted-foreground [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">
              ping {num(currentPing)}
            </div>
          </div>
          <TransportBar surveyId={id} totalPings={total} />
        </div>

        {/* right: map + detail */}
        <div className="hidden min-h-0 flex-col border-l lg:flex">
          <div className="h-[44%] min-h-[200px] border-b">
            <TrackMap
              bounds={s.bounds}
              track={track.data}
              vessel={vessel}
              detections={detections}
              selectedId={selectedId}
              onSelect={select}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <div key={selectedId ?? 'none'} className="duration-200 animate-in fade-in">
              <DetectionDetail detail={detail} loading={detailLoading} />
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDel}
        onOpenChange={(v) => !delBusy && setConfirmDel(v)}
        title="Delete this survey?"
        description={
          <>
            <span className="font-medium text-foreground">{s.filename}</span> and every detection,
            image and report derived from it will be removed. This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        destructive
        busy={delBusy}
        onConfirm={onDelete}
      />
    </div>
  )
}
