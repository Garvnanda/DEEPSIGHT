# Deep-Sight — Idea

**SIH 2026 · PS 26057 · Ministry of Earth Sciences / NIOT · Software · Disaster Management**
AI-powered detection and geotagging of underwater marine debris from side-scan sonar imagery.

> **Read this file first, both of you.** It is the shared understanding. Nothing in it is anyone's private
> implementation detail. If `implementation_garv.md` or `implementation_P.md` ever contradicts this file,
> this file is wrong and needs updating — fix it here, don't fork the understanding.

---

## 1 · What we are building

A **sonar survey review console**.

An operator loads a raw side-scan sonar survey file. The software replays the survey the way it was
recorded — the sonar waterfall scrolls past, the vessel track draws itself on a map — and as the sonar
passes over man-made objects on the seabed, the system flags them live.

For every flagged target it outputs:

- a **latitude/longitude**
- an **error radius** — how big the search circle actually needs to be
- the object's **real-world dimensions in metres**
- a **class** and a confidence score

The operator gets a prioritised worklist and a downloadable JSON/CSV report instead of thousands of
kilometres of sonar log to review by hand.

**One-line pitch:**
*Existing systems find debris. Ours gives you a coordinate you can actually sail to — and tells you how
big the search circle needs to be.*

**The deliverable NIOT wants is not a detection model. It is a coordinate report a cleanup vessel can act
on.** Every decision in every one of these files follows from that sentence.

---

## 2 · Why this is a real problem

NIOT runs systematic side-scan surveys of India's EEZ and coastal seabed. A vessel tows a sonar fish that
records continuous backscatter — often thousands of kilometres per campaign — stored as XTF or JSF files.
A trained operator then scrolls through it frame by frame looking for anomalies.

At roughly 2–3 km of sonar log per hour of manual review, one campaign creates weeks of backlog. The
operator's output is a spreadsheet of GPS positions — coordinates with a note attached. We are automating
the scroll, not replacing the operator's judgement: everything uncertain still routes to a human, it just
routes to a human with a 3% shortlist instead of a 100% haystack.

---

## 3 · How side-scan sonar works (the 5-minute version)

A sonar fish emits a fan-shaped acoustic pulse perpendicular to its track. The return intensity of each
pulse (a **ping**) is recorded as a row of samples. Consecutive pings stack into a **waterfall** image —
new rows arriving at the top or bottom, older ones scrolling away. That scroll is not a UI flourish; it is
literally how the instrument produces data.

**The critical property:** each sample index is a **slant range** from the transducer, not a ground range.
The echo travels a longer diagonal path than the horizontal distance along the seabed, so objects further
from the centre line are geometrically stretched. Correcting this is the first thing that has to happen
before a pixel position means anything on a map.

Three features of a waterfall that matter for both of us:

- **Nadir** — the bright band down the middle, directly under the fish. Either side of it is port and
  starboard.
- **The nadir gap** — a dark zone right at the centre where the pulse is still travelling through water
  and hasn't hit the seabed yet. Nothing real is ever detected there.
- **Acoustic shadow** — every object standing proud of the seabed casts a dark shadow on the far side from
  nadir. Shadow is the single most informative cue in sonar. It is how we measure object height.

---

## 4 · Why it is hard

1. **Speckle noise.** Sonar backscatter is multiplicative-noise dominated. Even smooth sand looks grainy.
   Optical denoising is the wrong tool.
2. **Rocks look like debris.** A boulder gives a bright highlight and a dark shadow, exactly like a pipe
   section. This is the primary source of false positives and the hardest genuine problem in the project.
3. **Slant-range distortion.** Pixel position ≠ ground coordinate without correction.
4. **Domain shift.** A model trained on 450 kHz EdgeTech data typically fails on 500 kHz Klein data. This
   is why published in-domain accuracy numbers mislead.
5. **Ghost nets are physically hard.** Monofilament strands are orders of magnitude thinner than the
   acoustic wavelength. Nets are semi-transparent to sound: no coherent shadow, no reliable highlight. No
   public labelled side-scan dataset contains them. See §8.

---

## 5 · What makes ours different

Four things, ranked. If we have to cut, cut from the bottom.

| # | Differentiator | Why others won't have it |
|---|---|---|
| 1 | **Position with an error radius**, computed from real sonar geometry | Teams working from JPEGs have no headers, so they cannot produce a defensible coordinate at all |
| 2 | **Live waterfall playback** reconstructed from raw ping records | Everyone else shows a static image with boxes on it |
| 3 | **A trained-in false-positive class** — we train on labelled *natural* bottom objects, not just targets | Everyone else filters false alarms after the fact, if at all |
| 4 | **Honest evaluation** — cross-dataset drop reported, not hidden | Most teams report one in-domain mAP and stop |

**Number 1 is the strongest and the safest.** It is geometry, not machine learning, so it cannot fail to
train. Protect it.

---

## 6 · The architecture, in one picture

```
raw XTF survey file
        │
        ▼
  [1] Ping ingest ──────────► per-ping header: lat, lon, heading, altitude, range
        │
        ├──► [2] Display chain ──► gain normalise → contrast → waterfall rows ──► WebSocket ──► UI
        │                                                                                       │
        └──► [3] Analysis chain ──► log + wavelet ──► [4] YOLOv8s detection                     │
                                                            │                                   │
                                                            ▼                                   │
                                                     [5] False-alarm rules                      │
                                                            │                                   │
                                                            ▼                                   │
                                              [6] Geotag + error radius ────────────────────────┘
                                                            │
                                                            ▼
                                                  [7] Report: JSON / CSV
```

> **Golden rule:** the display chain and the analysis chain branch from the **same raw array and never
> cross.** Despeckling makes an image look nicer and destroys the texture statistics the detector needs.
> Pretty pixels go to the screen; raw values go to the model.

---

## 7 · Who does what

| | Garv | P |
|---|---|---|
| Owns | Everything server-side: XTF parsing, geometry, error budget, model training, detection, report engine, the API | Everything the operator sees: React app, waterfall renderer, map, worklist, detail panel, report download |
| Language | Python | TypeScript |
| Contract between us | `apiendpoints.md` — the single source of truth for every request, response and WebSocket message | |

**How we work in parallel:** the API contract is written and frozen *before* either of us starts. P builds
against a mock server that returns contract-shaped fake data from day one; Garv builds the real endpoints
behind the same shapes. Neither waits for the other. When both sides are ready we swap the mock for the
real base URL and it should just work.

**Repo layout (one repo, no merge conflicts because we never touch the same directories):**

```
/backend      Garv only    Python, FastAPI, models, geometry
/frontend     P only       React + Vite + TypeScript
/docs         both         these four files
/scripts      Garv only    data fetch, training, eval
/data         gitignored   never commit sonar files
```

---

## 8 · Ghost nets — the answer we give before we're asked

Ghost nets are named in the problem statement. A NIOT jury will contain sonar operators who know the
physics. We do not pretend.

**The physics.** Standard side-scan runs 100–600 kHz. Monofilament strand diameter is 0.1–0.5 mm — orders
of magnitude below the acoustic wavelength. Nets are acoustically semi-transparent: no coherent shadow, no
reliable specular highlight. They are detectable only when accumulated into a dense mass, partially buried,
or draped over rigid structure — in which case we are detecting the structure, not the net. **No public
labelled side-scan dataset contains ghost nets.** This is a physical limit at current sensor
specifications, not a modelling failure.

**The path forward.** Synthetic Aperture Sonar. Its advantage is **aperture synthesis** — coherently
combining many pings to synthesise a long array, giving along-track resolution that is roughly
range-independent and reaches centimetre scale. At that resolution netting becomes detectable in aggregate.

> ⚠️ **Do not frame SAS as "higher frequency."** An earlier draft did, and it was wrong — side-scan already
> runs up to 600 kHz. The advantage is aperture synthesis. A sonar operator would catch the error
> instantly, and it was our most confident-sounding, most vulnerable claim.

**What we say, proactively and early:**

> "Ghost nets are the hardest acoustic target in this domain and we're honest about it. Standard side-scan
> cannot resolve monofilament at these wavelengths, and no public labelled dataset contains them. We detect
> what sonar reliably reveals — wrecks, rigid man-made objects, pipelines — precisely enough to produce
> actionable coordinates. The path to ghost nets is synthetic aperture sonar, and we document that path
> explicitly."

This is a strength beat, not an apology.

---

## 9 · What we deliberately did not build

Every item here was considered, costed, and cut. **We never claim a feature we don't have.**

| Cut | Why | What we say if asked |
|---|---|---|
| **Conformal confidence calibration** | Needs a held-out calibration set and a coverage study | "We output a raw detector confidence score. Calibrating it properly — so 80% means 80% — needs a coverage study we scoped out for time. It matters, and it's the first thing we'd add." |
| **Substrate complexity segmentation** | A whole extra model and label set | "We stratify false positives by seabed type in evaluation" — true, and enough |
| **Self-supervised pretraining** | Highest compute cost, uncertain payoff | Don't raise it |
| **Bathymetry-aware slant correction** | Needs a bathymetry-carrying dataset we're not using | "We assume locally flat seabed and report that as a limitation" |
| **Edge latency benchmarking** | Needs hardware and a measurement harness | "YOLOv8s is a standard edge variant; it runs on Jetson-class hardware for offline survey processing" |
| **Manual annotation of KLSG** | Was a 3-week full-time job for a person we no longer have | "We assembled training data from pre-labelled public sources rather than hand-annotating" |
| **SWDD robustness suite** | It's a harbour-*wall* dataset — two classes, Wall/NoWall. Shares zero classes with our taxonomy | "SubPipe is our cross-dataset test; SWDD tests wall detection, which isn't our problem" |

**A differentiator we consciously gave up:** cutting substrate and calibration also removes the "muddy
estuary" degradation demo — the beat where the system visibly becomes *less confident* rather than
confidently wrong. That was genuinely strong. Given two people, it's the right trade. It is recorded here
so nobody discovers it missing during rehearsal.

---

## 10 · The demo, in order

1. **"Here is the sonar."** Waterfall scrolls, track draws on the map. Real ping data, rendered properly.
   The hook — everyone can see it and everyone believes it.
2. **"Here is what's in it."** Detections appear as the sonar passes over them.
3. **"Here is where to go."** Click a target: coordinate **and search circle**. Explain layback in one
   sentence.
4. **"This is what the sensor recorded; this is what it means geometrically."** Toggle raw vs
   slant-range-corrected.
5. **"Here is the report."** JSON/CSV download.

**Pitch discipline:** lead with the imagery, land on the coordinate. Beautiful visuals win the first thirty
seconds; the error radius is what makes them believe the tool is *useful* rather than pretty. If we only
show imagery, a sharp judge asks what it does that a display program doesn't.

---

## 11 · Q&A — rehearsed answers

| Question | Answer |
|---|---|
| **"What's your accuracy?"** | Give mAP, then three comparisons: naive threshold baseline, raw YOLO without preprocessing, and published SOTA (DFSE-YOLO, 75.51% mAP50 on AI4Shipwrecks). Then the cross-dataset drop. *Lead with the SOTA comparison — a sonar-literate judge cares about the literature, not our own baseline.* |
| **"How did you get that coordinate?"** | Slant range → layback → geodesic projection → error budget. **We will be the only team in the room who can answer this.** |
| **"Is your confidence score meaningful?"** | Raw detector score. Calibration scoped out for time; first thing we'd add. **Do not claim calibration.** |
| **"Why not ghost nets?"** | §8, verbatim, proactively. |
| **"Do you know about GhostNetZero?"** | Yes — WWF Germany with Microsoft AI for Good and Accenture, ~90% detection on Baltic and Puget Sound data. Closed platform, unpublished model; organisations donate data and get positions back. We're the open, onboard-deployable version that reports its own position uncertainty. |
| **"Is the sonar image AI-generated?"** | No. Intensity value → contrast curve → screen. Nothing synthesised. No neural network touches the displayed image. |
| **"Your detector and geometry use different datasets."** | Correct, and here's why — say it before they find it. Labelled sonar data exists as processed images with navigation stripped out; raw navigation data exists without labels. We train on the labelled imagery and run on real raw survey files, which is exactly how this deploys, because a real survey has no labels either. |
| **"Why Antarctic data for an Indian EEZ problem?"** | It's the raw towed EdgeTech XTF that's publicly available. We use it to validate geometry, not to train the detector. The geometry is identical wherever the fish is towed. |
| **"You trained on a mine dataset?"** | Yes, deliberately. Mine-like contacts are rigid man-made objects on the seabed, and the same dataset labels *non*-mine bottom objects — natural rocks that look like targets. That gave us labelled false positives, which is the hardest part of this problem. |
| **"How is this better than a Kaggle notebook?"** | Geometry. A notebook produces boxes on images. We produce coordinates with stated uncertainty, from raw survey files, in the format a cleanup vessel acts on. |

---

## 12 · Decision rules, agreed in advance

1. **Display and analysis pipelines never cross.** Despeckled data never reaches the detector.
2. **We write the geometry ourselves.** Libraries for parsing and plotting only — if `pyxtf` computed it,
   we can't claim it in Q&A.
3. **No forward-looking sonar data, ever.** Wrong modality. Someone will find NKSID or the Kaggle
   "Forward-Looking Sonar Marine Debris" set because they say "marine debris" and "fishing nets." The
   answer is no. Mixing FLS into a side-scan training set silently corrupts the model.
4. **Respect AI4Shipwrecks' site-based split.** No random splits — it inflates the numbers and voids the
   benchmark comparison.
5. **If we can't beat the naive threshold baseline by the detection milestone**, something is broken. Find
   out then, not at the end.
6. **Nothing goes in the report — or the pitch — that we can't trace to a measured value.** This applies to
   Q&A answers as strictly as to the JSON output.
7. **The API contract is frozen before code starts.** Changing it requires both of us to agree and both
   files to be updated in the same commit.
