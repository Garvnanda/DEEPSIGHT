// First-run walkthrough. Four static slides explaining the pipeline, stepped through
// with Previous / Next / Skip. No backend calls. On finish or skip it stores a flag and
// sends you to the Surveys page; re-openable any time from the "?" in the nav.

import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Crosshair, FileStack, GitBranch, ScanSearch } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Cuboid3D } from '@/components/tour/Cuboid3D'
import { WorldMap } from '@/components/tour/WorldMap'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const ONBOARDED_KEY = 'deepsight.onboarded'

interface Slide {
  icon: ReactNode
  title: string
  body: string
  figure: ReactNode
}

const SLIDES: Slide[] = [
  {
    icon: <FileStack className="size-5" />,
    title: 'Ingest the raw sonar',
    body: 'An XTF file is not an image. It is a stream of ping records — navigation, altitude, range, frequency, and one intensity array per channel. Deep-Sight reads those directly.',
    figure: (
      <Flow
        from="XTF"
        to={['navigation', 'altitude', 'range', 'frequency', 'intensity arrays']}
      />
    ),
  },
  {
    icon: <GitBranch className="size-5" />,
    title: 'Two pictures from one array',
    body: 'The samples branch into two chains that never cross. The display chain — log compression, time-varied gain, a percentile stretch — makes the amber waterfall a human scrolls. A separate analysis chain — nadir-gap mask, wavelet despeckle — makes the cleaner image the detector reads.',
    figure: (
      <div className="flex items-center gap-3 text-xs">
        <Chip>raw samples</Chip>
        <div className="flex flex-col gap-2">
          <ArrowRight className="size-4 text-muted-foreground" />
          <ArrowRight className="size-4 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-2">
          <Chip tone="accent">display chain · log · TVG · stretch</Chip>
          <Chip tone="accent">analysis chain · nadir mask · wavelet despeckle</Chip>
        </div>
      </div>
    ),
  },
  {
    icon: <ScanSearch className="size-5" />,
    title: 'Detect what is man-made',
    body: 'YOLO runs on the analysis image. Every hit carries a class and a detector score. Natural bottom objects are a trained-in class, so a boulder is called a boulder instead of a false alarm.',
    figure: <StripMock />,
  },
  {
    icon: <Crosshair className="size-5" />,
    title: 'Geometry turns the box into a position',
    body: 'Slant range becomes ground range. Layback puts the towfish behind the ship. The acoustic shadow gives object height. A geodesic step projects the target onto the earth — with an error budget, not a false-precision dot.',
    figure: (
      <div className="grid w-full gap-4 sm:grid-cols-2">
        <Cuboid3D widthM={6} lengthM={3.4} heightM={1.5} />
        <div>
          <WorldMap lat={13.05} lon={80.3} />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            → 13.0500°, 80.3000° <span className="text-accent">± 24 m</span>
          </p>
        </div>
      </div>
    ),
  },
]

export function Onboarding() {
  const navigate = useNavigate()
  const [i, setI] = useState(0)
  const last = i === SLIDES.length - 1

  const finish = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDED_KEY, '1')
    } catch {
      /* private mode — fine, they just see it again */
    }
    navigate('/surveys')
  }, [navigate])

  const next = useCallback(() => (last ? finish() : setI((n) => n + 1)), [last, finish])
  const prev = useCallback(() => setI((n) => Math.max(0, n - 1)), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, finish])

  const slide = SLIDES[i]

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-3xl flex-col px-6 py-10">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Getting started · {i + 1} / {SLIDES.length}
        </div>
        <Button variant="ghost" size="sm" onClick={finish}>
          Skip
        </Button>
      </div>

      <div className="relative flex flex-1 items-center">
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="w-full"
        >
          <div className="flex size-11 items-center justify-center rounded-xl bg-secondary text-accent">
            {slide.icon}
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{slide.title}</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{slide.body}</p>
          <div className="mt-8 flex min-h-[240px] items-center rounded-xl border bg-card p-5">
            {slide.figure}
          </div>
        </motion.div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" onClick={prev} disabled={i === 0}>
          <ArrowLeft className="size-4" /> Previous
        </Button>
        <div className="flex gap-1.5">
          {SLIDES.map((_, n) => (
            <button
              key={n}
              aria-label={`Go to step ${n + 1}`}
              onClick={() => setI(n)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                n === i ? 'w-6 bg-accent' : 'w-1.5 bg-muted-foreground/30',
              )}
            />
          ))}
        </div>
        <Button onClick={next}>
          {last ? 'Start' : 'Next'} <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function Chip({ children, tone }: { children: ReactNode; tone?: 'accent' }) {
  return (
    <span
      className={cn(
        'inline-block rounded-md border px-2 py-1 text-xs font-medium',
        tone === 'accent' ? 'border-accent/40 text-foreground' : 'bg-secondary',
      )}
    >
      {children}
    </span>
  )
}

function Flow({ from, to }: { from: string; to: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip>{from}</Chip>
      <ArrowRight className="size-4 text-muted-foreground" />
      <div className="flex flex-wrap gap-1.5">
        {to.map((t) => (
          <Chip key={t} tone="accent">
            {t}
          </Chip>
        ))}
      </div>
    </div>
  )
}

function StripMock() {
  return (
    <div className="relative h-32 w-full overflow-hidden rounded-md border">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, #0e0b08, #3a2c1a 46%, #0c0906 49% 51%, #3a2c1a 54%, #0e0b08)',
        }}
      />
      <div
        className="absolute rounded border-2"
        style={{ left: '22%', top: '34%', width: '11%', height: '30%', borderColor: 'var(--cls-milco)' }}
      >
        <span
          className="absolute -top-5 left-0 whitespace-nowrap rounded px-1 text-[10px] font-medium text-black"
          style={{ background: 'var(--cls-milco)' }}
        >
          Rigid man-made object · 0.78
        </span>
      </div>
    </div>
  )
}
