# Deep-Sight — Console (v3)

Third front end. Same backend contract as v1/v2. **No home page.** The instrument
console is the working screen; supporting pages (Surveys / Detections / Reports /
Settings) sit under a **top nav bar** instead of a sidebar. Fully offline (bundled
fonts, no basemap tiles).

> This diverges on purpose from `docs/implementation_P.md` §1/§3 (single-screen
> console, minimal motion): multipage, plus a first-run walkthrough. Chosen by the
> project owner. The **console screen itself still follows** implementation_P.md.

## First-run walkthrough — `src/pages/Onboarding.tsx`

Four **static** slides explaining the pipeline (ingest → two chains → detect →
geometry), stepped with Previous / Next / Skip and a progress rail. No backend
calls, no demo-survey dependency — it always renders. Slide 4 shows the `Cuboid3D`
and `WorldMap` components as illustrations (fixed numbers, not live data).

Routing (`src/main.tsx`):

- `/` → `<Home>`: if `localStorage['deepsight.onboarded'] === '1'`, redirect to
  `/surveys`; otherwise show `<Onboarding>`. Finish / Skip sets the flag and goes to
  `/surveys`.
- `/welcome` → `<Onboarding>` always (the `?` button in the nav re-opens it).

`WorldMap` is an equirectangular SVG drawn from a bundled 110m land outline
(`src/assets/land-110m.geo.json`, ~230 KB) — no tiles, no network. It and `Cuboid3D`
also render in the **console detail panel** (`DetectionDetail.tsx`): the selected
target's measured dimensions as a to-scale wireframe, and a tight Leaflet map
centred on its coordinate with the error circle.

## Deleting a survey

`DELETE /api/surveys/{id}` (contract §1, added post-freeze with the owner's
agreement — see `apiendpoints.md`, `implementation_garv.md`, `implementation_P.md`).
Exposed from the Surveys row menu and the console header, both behind a confirm
dialog. `api.deleteSurvey` treats `404` as success.

## Stack

- Vite + React 19 + TS, Tailwind v4 + shadcn/ui, react-router, Zustand, Recharts
- Leaflet (no tile layer — graticule + track + metre-accurate error circles) for the console map
- `framer-motion` for stage reveals and small UI motion
- `@fontsource` Inter + JetBrains Mono (bundled)

## React Bits components (`src/components/reactbits/`)

The animated landing-page pieces (DotField, Carousel, SpecularButton, BorderGlow,
Dock, OptionWheel, BlobCursor, ClickSpark) and the `gsap` / `ogl` deps were removed
with the landing page. What remains:

| Component | Where |
|---|---|
| `ElasticSlider` | **console transport timeline** |

## Routes

| Route | Page |
|---|---|
| `/` | redirect to `/surveys` once onboarded, else the walkthrough |
| `/welcome` | the walkthrough, always |
| `/console/:id` | Survey console — waterfall, live playback, map, worklist, error-budget detail |
| `/surveys/:id` | alias of the console |
| `/surveys` `/detections` `/reports` `/settings` | supporting pages |

## Run

Backend on `:8000`. `npm install && npm run dev` → `http://localhost:5373`
(dev server proxies `/api` + `/ws`). `npm run build` → `dist/`.

## Playback fallback

`src/lib/tileFallback.ts` — if the WebSocket exhausts its reconnects, the playback
store switches to polling `GET /api/surveys/{id}/waterfall` for PNG strips, decodes
them to greyscale, and feeds the same row queue. Seeking in tile mode fetches a strip
at the new position. The demo never shows an empty screen.

## v1 / v2

`../frontend` (teammate's original) and `../frontend-v2` are untouched and still
runnable on their own ports (5173, 5273).
