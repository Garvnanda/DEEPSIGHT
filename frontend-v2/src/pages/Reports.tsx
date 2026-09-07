import { Download, FileJson, FileSpreadsheet, ScrollText } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ClassBadge } from '@/components/common/ClassBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { useAsync } from '@/hooks/useAsync'
import { getReportJson, reportCsvUrl } from '@/lib/api'
import { areaKm2, coord, dateTime, duration, km, metres, num, pct } from '@/lib/format'
import { useSurveyStore } from '@/stores/surveyStore'

export function Reports() {
  const { surveys, refresh } = useSurveyStore()
  const [params, setParams] = useSearchParams()
  const selected = params.get('survey') ?? ''

  useEffect(() => {
    void refresh()
  }, [refresh])

  const reportable = useMemo(
    () => surveys.filter((s) => ['ready', 'complete'].includes(s.status)),
    [surveys],
  )

  useEffect(() => {
    if (!selected && reportable.length) setParams({ survey: reportable[0].survey_id }, { replace: true })
  }, [selected, reportable, setParams])

  const { data, loading, error } = useAsync(
    () => (selected ? getReportJson(selected) : Promise.reject(new Error('no survey'))),
    [selected],
  )

  const downloadJson = () => {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selected}_report.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <PageContainer
      title="Reports"
      description="The full record for one survey  coverage, every target, and the method notes that say how each number was produced."
      actions={
        <div className="flex items-center gap-2">
          <Select value={selected} onValueChange={(v) => setParams({ survey: v })}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select a survey" />
            </SelectTrigger>
            <SelectContent>
              {reportable.map((s) => (
                <SelectItem key={s.survey_id} value={s.survey_id}>
                  {s.filename}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={downloadJson} disabled={!data}>
            <FileJson className="size-4" /> JSON
          </Button>
          <Button size="sm" variant="outline" asChild disabled={!selected}>
            <a href={selected ? reportCsvUrl(selected) : undefined}>
              <FileSpreadsheet className="size-4" /> CSV
            </a>
          </Button>
        </div>
      }
    >
      {!selected ? (
        <EmptyState
          icon={<ScrollText className="size-8" />}
          title="No survey selected"
          description="Pick a completed survey to see its report."
        />
      ) : loading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error || !data ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error ?? 'Report unavailable.'}
        </div>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{data.survey.filename}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
              <Field k="Frequency" v={`${num(data.survey.frequency_khz)} kHz`} />
              <Field k="Range" v={metres(data.survey.range_m)} />
              <Field k="Pings" v={num(data.survey.ping_count)} />
              <Field k="Duration" v={duration(data.survey.duration_s)} />
              <Field k="Sound speed" v={`${num(data.survey.sound_speed_ms)} m/s`} />
              <Field
                k="Altitude"
                v={`${metres(data.survey.altitude_mean_m)} · ${
                  data.survey.altitude_source === 'xtf_header' ? 'from header' : 'estimated'
                }`}
              />
              <Field k="Start" v={dateTime(data.survey.start_time)} />
              <Field k="Generated" v={dateTime(data.generated_at)} />
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi k="Area surveyed" v={areaKm2(data.stats.area_surveyed_m2)} />
            <Kpi k="Track length" v={km(data.stats.line_length_km)} />
            <Kpi k="Targets" v={num(data.stats.targets_flagged)} />
            <Kpi k="Mean radius" v={metres(data.stats.mean_error_radius_m)} />
          </div>

          <Card className="border-accent/30 bg-accent/5">
            <CardContent className="py-4 text-sm">{data.stats.headline}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Method notes</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {data.method_notes.map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                    {n}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="overflow-hidden p-0">
            <CardHeader className="p-4">
              <CardTitle className="text-sm">Targets ({data.detections.length})</CardTitle>
            </CardHeader>
            {data.detections.length === 0 ? (
              <div className="px-4 pb-4 text-sm text-muted-foreground">
                No targets in this survey.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead className="text-right">Ping</TableHead>
                    <TableHead className="text-right">Lat</TableHead>
                    <TableHead className="text-right">Lon</TableHead>
                    <TableHead className="text-right">± radius</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.detections.map((d) => (
                    <TableRow key={d.detection_id}>
                      <TableCell>
                        <ClassBadge cls={d.class} showCode />
                      </TableCell>
                      <TableCell className="tnum text-right text-muted-foreground">
                        {num(d.ping)}
                      </TableCell>
                      <TableCell className="tnum text-right text-muted-foreground">
                        {d.lat == null ? '' : coord(d.lat)}
                      </TableCell>
                      <TableCell className="tnum text-right text-muted-foreground">
                        {d.lon == null ? '' : coord(d.lon)}
                      </TableCell>
                      <TableCell className="tnum text-right" style={{ color: 'var(--warn)' }}>
                        {metres(d.error_radius_m)}
                      </TableCell>
                      <TableCell className="tnum text-right text-muted-foreground">
                        {d.confidence.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Download className="size-3" /> Review area is {pct(data.stats.review_area_fraction)} of the
            full swath  the rest does not need a diver.
          </p>
        </div>
      )}
    </PageContainer>
  )
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{k}</div>
      <div className="tnum">{v}</div>
    </div>
  )
}

function Kpi({ k, v }: { k: string; v: string }) {
  return (
    <Card className="gap-1 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{k}</div>
      <div className="tnum text-lg font-semibold">{v}</div>
    </Card>
  )
}
