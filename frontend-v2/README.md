# Deep-Sight  Console (v2)

Redesigned front end for the Deep-Sight sonar review backend. Multi-page,
formal/professional, animated, light + dark (default light). Fully offline 
no CDN calls at runtime (fonts bundled, map has no basemap tiles).

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui (components vendored under `src/components/ui`)
- Framer Motion + `tw-animate-css` for motion
- react-router-dom (multi-page)
- Zustand (survey / playback / selection stores)
- Recharts (dashboard charts)
- Leaflet + react-leaflet (track map, **no tile layer**  graticule + track + metre-accurate error circles)
- `@fontsource` Inter + JetBrains Mono (bundled, offline)

## Run

The backend must be on `http://localhost:8000`.

```bash
npm install
npm run dev      # http://localhost:5273
```

The dev server proxies `/api`, `/ws` and `/health` to `:8000`, so the app is
single-origin. To point at a remote backend, set an absolute URL in **Settings →
Backend connection** (stored in `localStorage`).

```bash
npm run build    # tsc -b && vite build  →  dist/
npm run preview
```

## Pages

| Route | What |
|---|---|
| `/` | Dashboard  fleet KPIs, targets-by-class, error-radius spread, recent surveys |
| `/surveys` | Table of all surveys; upload XTF, upload images, demo survey, re-run detection |
| `/surveys/:id` | Console  waterfall + live playback (WebSocket), track map, worklist, error-budget detail |
| `/detections` | Cross-survey detection browser with filters + error-budget drawer |
| `/reports` | Per-survey report: coverage, method notes (verbatim), targets, JSON/CSV export |
| `/settings` | API base URL, theme, how to read the numbers |

## Contract

`src/lib/types.ts` mirrors `docs/apiendpoints.md` exactly. `src/lib/api.ts` is
one function per endpoint. The waterfall canvas, ring buffer and playback socket
are ported from the original front end unchanged in behaviour.

## Notes

- The production JS bundle is ~1.2 MB (Leaflet + Recharts + Framer). Fine for a
  local demo; code-split later if it needs to ship.
- The original front end is untouched at `../frontend`.
