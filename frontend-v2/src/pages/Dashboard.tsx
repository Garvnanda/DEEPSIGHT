import { Activity, Crosshair, Database, Layers, Radar, Waves } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { ClassBar } from '@/components/charts/ClassBar'
import { ErrorHistogram } from '@/components/charts/ErrorHistogram'
import { ClassBadge } from '@/components/common/ClassBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { MetricCard } from '@/components/common/MetricCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsync } from '@/hooks/useAsync'
import { getDetections, getStats } from '@/lib/api'
import { areaKm2, km, metres, num, relativeTime } from '@/lib/format'
import type { Detection, DetectionClass } from '@/lib/types'
import { useSurveyStore } from '@/stores/surveyStore'

const CLASS_KEYS: DetectionClass[] = ['wreck', 'milco', 'nombo', 'pipeline']

export function Dashboard() {
  const { surveys, loading, error, refresh } = useSurveyStore()

  useEffect(() => {
    void refresh()
  }, [refresh])

  const completeIds = surveys.filter((s) => s.status === 'complete').map((s) => s.survey_id)

  const agg = useAsync(async () => {
    const statsList = await Promise.all(
      completeIds.slice(0, 16).map((id) => getStats(id).catch(() => null)),
    )
    const detLists = await Promise.all(
      completeIds.slice(0, 8).map((id) => getDetections(id).catch(() => null)),
    )
    const dets: Detection[] = detLists.flatMap((d) => d?.detections ?? [])

    const byClass: Partial<Record<DetectionClass, number>> = {}
    let area = 0
    let line = 0
    for (const s of statsList) {
      if (!s) continue
      area += s.area_surveyed_m2 || 0
      line += s.line_length_km || 0
      for (const c of CLASS_KEYS) byClass[c] = (byClass[c] ?? 0) + (s.targets_by_class[c] ?? 0)
    }
    return { byClass, area, line, dets }
  }, [completeIds.join(',')])

  const totalPings = surveys.reduce((a, s) => a + s.ping_count, 0)
  const totalDetections = surveys.reduce((a, s) => a + s.detection_count, 0)
  const inProgress = surveys.filter((s) =>
    ['uploaded', 'parsing', 'processing'].includes(s.status),
  ).length
  const recent = surveys.slice(0, 6)

  return (
    <PageContainer
      title="Operations Dashboard"
      description="Fleet-wide view of every survey processed by the console  coverage, targets, and how tight the position fixes are."
      actions={
        <Button asChild size="sm">
          <Link to="/surveys">
            <Waves className="size-4" /> Manage surveys
          </Link>
        </Button>
      }
    >
      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MetricCard index={0} label="Surveys" value={num(surveys.length)} icon={<Database className="size-4" />} loading={loading && !surveys.length} />
        <MetricCard index={1} label="Complete" value={num(completeIds.length)} icon={<Activity className="size-4" />} loading={loading && !surveys.length} />
        <MetricCard index={2} label="In progress" value={num(inProgress)} icon={<Radar className="size-4" />} loading={loading && !surveys.length} />
        <MetricCard index={3} label="Pings read" value={num(totalPings)} icon={<Layers className="size-4" />} loading={loading && !surveys.length} />
        <MetricCard index={4} label="Targets" value={num(totalDetections)} icon={<Crosshair className="size-4" />} loading={loading && !surveys.length} />
        <MetricCard
          index={5}
          label="Area surveyed"
          value={agg.loading ? <Skeleton className="h-7 w-20" /> : areaKm2(agg.data?.area)}
          hint={agg.data ? `${km(agg.data.line)} of track` : undefined}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Targets by class</CardTitle>
          </CardHeader>
          <CardContent>
            {agg.loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <ClassBar counts={agg.data?.byClass ?? {}} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Search-radius spread</CardTitle>
          </CardHeader>
          <CardContent>
            {agg.loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <ErrorHistogram detections={agg.data?.dets ?? []} />
            )}
            {agg.data && agg.data.dets.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Median{' '}
                <span className="tnum text-foreground">
                  {metres(median(agg.data.dets.map((d) => d.error_radius_m)))}
                </span>{' '}
                across {agg.data.dets.length} located targets. Every circle is sized from its own
                error budget.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm">Recent surveys</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/surveys">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loading && !surveys.length ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState
              icon={<Waves className="size-8" />}
              title="No surveys yet"
              description="Upload an XTF file or start a demo survey to see it here."
              action={
                <Button asChild size="sm">
                  <Link to="/surveys">Go to Surveys</Link>
                </Button>
              }
            />
          ) : (
            <ul className="divide-y">
              {recent.map((s) => (
                <li key={s.survey_id}>
                  <Link
                    to={`/surveys/${s.survey_id}`}
                    className="flex items-center gap-3 py-2.5 text-sm transition-colors hover:text-accent"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{s.filename}</span>
                    <span className="tnum hidden text-xs text-muted-foreground sm:inline">
                      {num(s.ping_count)} pings
                    </span>
                    <span className="tnum hidden text-xs text-muted-foreground sm:inline">
                      {num(s.detection_count)} targets
                    </span>
                    <span className="text-xs text-muted-foreground">{relativeTime(s.created_at)}</span>
                    <StatusBadge status={s.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {agg.data && Object.values(agg.data.byClass).some((v) => v) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Legend:</span>
          {CLASS_KEYS.map((c) => (
            <ClassBadge key={c} cls={c} />
          ))}
          <span className="ml-1">
            Natural bottom objects are shown, not hidden  calling a rock a rock is part of the
            method.
          </span>
        </div>
      )}
    </PageContainer>
  )
}

function median(xs: number[]): number {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (!v.length) return NaN
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}
