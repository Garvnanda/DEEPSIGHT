import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { useState } from 'react'

import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getApiBase, getHealth, setApiBase } from '@/lib/api'
import { useThemeStore } from '@/lib/theme'
import { cn } from '@/lib/utils'

const METHOD_NOTES = [
  'Positions are WGS-84. The error radius is a 1-sigma search radius — the circle you would actually have to sweep to find the object.',
  'Every radius is built from its own error budget: GPS fix, layback, heading, altitude, sound speed and the target’s own size. It varies target to target by design.',
  'Confidence is a raw detector score. It is not a calibrated probability.',
  'Natural bottom objects (rocks that look like targets) are detected and labelled, not hidden.',
]

export function Settings() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const [base, setBase] = useState(getApiBase())
  const [test, setTest] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  const save = () => {
    setApiBase(base.trim())
    setTest('idle')
  }
  const check = async () => {
    setApiBase(base.trim())
    setTest('testing')
    try {
      const r = await getHealth()
      setTest(r.status === 'ok' ? 'ok' : 'fail')
    } catch {
      setTest('fail')
    }
  }

  return (
    <PageContainer
      title="Settings"
      description="Connection, appearance, and how to read the numbers this console produces."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Backend connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="api-base">API base URL</Label>
              <Input
                id="api-base"
                placeholder="leave blank to use this origin (dev proxy)"
                value={base}
                onChange={(e) => setBase(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Blank routes <code>/api</code> and <code>/ws</code> through the dev server to
                <code> localhost:8000</code>. Set an absolute URL to point at a remote backend.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={save}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={check} disabled={test === 'testing'}>
                {test === 'testing' && <Loader2 className="size-4 animate-spin" />}
                Test connection
              </Button>
              {test === 'ok' && (
                <span className="flex items-center gap-1 text-xs text-ok">
                  <CheckCircle2 className="size-4" /> Reachable
                </span>
              )}
              {test === 'fail' && (
                <span className="flex items-center gap-1 text-xs text-destructive">
                  <XCircle className="size-4" /> Unreachable
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Appearance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label>Theme</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['light', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={cn(
                    'rounded-md border px-3 py-6 text-sm font-medium capitalize transition-colors',
                    theme === t
                      ? 'border-accent bg-accent/10 text-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'mx-auto mb-2 block size-8 rounded-full border',
                      t === 'light' ? 'bg-white' : 'bg-slate-900',
                    )}
                  />
                  {t}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Default is light. Your choice is saved to this browser.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm">How to read the output</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {METHOD_NOTES.map((n, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />
                {n}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Deep-Sight — side-scan sonar review console. XTF ingest, waterfall rendering, YOLO
            detection, geodetic target location with a per-target error budget.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  )
}
