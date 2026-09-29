import { ArrowRight, Compass } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Panel } from '@/components/common/Panel'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useThemeStore } from '@/lib/theme'
import { cn } from '@/lib/utils'

// Every claim on this page traces to docs/idea.md. Nothing here is invented copy.

const IDENTITY = [
  ['Problem statement', 'PS 26057'],
  ['Event', 'SIH 2026'],
  ['Owner', 'Ministry of Earth Sciences / NIOT'],
  ['Category', 'Software · Disaster management'],
  ['Sensor', 'Side-scan sonar · raw XTF'],
  ['Output', 'Coordinate report · JSON / CSV'],
]

const METHOD_NOTES = [
  'Positions are WGS-84. The error radius is a 1-sigma search radius  the circle you would actually have to sweep to find the object.',
  'Every radius is built from its own error budget: GPS fix, layback, heading, altitude, sound speed and the target’s own size. It varies target to target by design.',
  'Confidence is a raw detector score. It is not a calibrated probability.',
  'Natural bottom objects (rocks that look like targets) are detected and labelled, not hidden.',
]

const LIMITS = [
  {
    k: 'Ghost nets',
    v: 'Standard side-scan runs 100–600 kHz. Monofilament strand diameter is 0.1–0.5 mm  orders of magnitude below the acoustic wavelength  so netting is acoustically semi-transparent, and no public labelled side-scan dataset contains it. A physical limit at current sensor specifications, not a modelling failure. We detect what sonar reliably reveals: wrecks, rigid man-made objects, pipelines.',
  },
  {
    k: 'Confidence',
    v: 'A raw detector score, never a calibrated probability. Calibration was scoped out for time and is the first thing we would add.',
  },
  {
    k: 'Two datasets',
    v: 'The detector trains on labelled sonar imagery; the geometry runs on raw survey files. Labelled sonar data has its navigation stripped out, and raw navigation data has no labels. That is also how it deploys  a real survey has no labels either.',
  },
  {
    k: 'The displayed image',
    v: 'Not AI-generated. Intensity value, contrast curve, screen. No neural network touches the pixels you look at.',
  },
]

const KEYS = [
  ['→', 'Walkthrough  next chapter'],
  ['←', 'Walkthrough  previous chapter'],
  ['Esc', 'Walkthrough  skip to the surveys list'],
  ['Enter', 'Upload dialog  open the file picker'],
]

const POINTER = [
  'Click a row on Surveys to open that file in the console.',
  'Click a target in the console worklist to seek the waterfall to it and show how its position was derived.',
  'Click a row on Detections for the same derivation panel.',
  'Drag the cards on the first walkthrough chapter; hover the 3D object to hold its rotation.',
]

export function About() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  return (
    <PageContainer
      kicker="Deep-Sight"
      title="About"
      meta={theme}
      description="What this console is, who it is for, and how to read the numbers it produces."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="About Deep-Sight">
          <p className="text-sm leading-relaxed">
            A sonar survey review console. An operator loads a raw side-scan survey; Deep-Sight
            replays it the way the instrument recorded it, flags man-made objects on the seabed as
            the sonar passes over them, and turns each one into a latitude, a longitude and a search
            radius.
          </p>
          <p className="mt-3 rounded-lg border border-accent/35 bg-accent/5 px-3 py-2.5 text-sm leading-relaxed">
            Existing systems find debris. This one gives you a coordinate you can actually sail to 
            and tells you how big the search circle needs to be.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
            {IDENTITY.map(([k, v]) => (
              <div key={k}>
                <dt className="label-micro">{k}</dt>
                <dd className="mt-0.5 text-sm">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel title="Who it is for">
          <p className="text-sm leading-relaxed">
            NIOT runs systematic side-scan surveys of India’s EEZ and coastal seabed  often
            thousands of kilometres per campaign, stored as XTF. Today a trained operator scrolls
            that log frame by frame at roughly 2–3 km of sonar per review hour, so a single campaign
            turns into weeks of backlog.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Deep-Sight automates the scroll, not the judgement. Everything uncertain still routes to
            a human  it just routes to a human with a shortlist instead of the whole haystack, and
            every target arrives with the working that produced it.
          </p>
          <p className="mt-3 border-t pt-3 text-sm leading-relaxed">
            The deliverable is not a detection model. It is a coordinate report a cleanup vessel can
            act on.
          </p>
        </Panel>

        <Panel title="Appearance">
          <div className="space-y-2">
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
                      t === 'light' ? 'bg-white' : 'bg-[oklch(0.155_0.014_165)]',
                    )}
                  />
                  {t}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Light is cool paper. Dark is phosphor green, after the displays this console descends
              from. Your choice is saved to this browser.
            </p>
          </div>
        </Panel>

        <Panel title="Walkthrough">
          <p className="text-sm leading-relaxed">
            Six chapters: ingest, the two processing chains that never cross, detection, and the
            geometry that turns a box on a picture into a position on the earth. It runs on a real
            detection from a real survey, so the numbers on screen are the ones the pipeline
            produced.
          </p>
          <Button asChild className="mt-4">
            <Link to="/welcome">
              <Compass className="size-4" /> Replay the walkthrough <ArrowRight className="size-4" />
            </Link>
          </Button>
        </Panel>
      </div>

      <Panel className="mt-4" title="Getting around">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <div className="label-micro mb-2.5">Keys</div>
            <dl className="space-y-2">
              {KEYS.map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-3">
                  <dt className="tnum min-w-14 shrink-0 rounded border px-1.5 py-0.5 text-center text-xs">
                    {k}
                  </dt>
                  <dd className="text-sm text-muted-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <div className="label-micro mb-2.5">Pointer</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {POINTER.map((p) => (
                <li key={p} className="flex gap-2.5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>

      <Panel className="mt-4" title="How to read the output">
        <ul className="space-y-2 text-sm text-muted-foreground">
          {METHOD_NOTES.map((n) => (
            <li key={n} className="flex gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
              {n}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        className="mt-4"
        title="What we do not claim"
        right={<span className="label-micro">said before we are asked</span>}
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          {LIMITS.map(({ k, v }) => (
            <div key={k}>
              <dt className="text-sm font-semibold">{k}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{v}</dd>
            </div>
          ))}
        </dl>
        <Footnote>
          Nothing reaches a report, or an answer in the room, that cannot be traced to a measured
          value.
        </Footnote>
      </Panel>
    </PageContainer>
  )
}

function Footnote({ children }: { children: ReactNode }) {
  return <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">{children}</p>
}
