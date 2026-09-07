import { create } from 'zustand'

import { getDetections } from '@/lib/api'
import { PlaybackSocket, type PingBatch } from '@/lib/playbackSocket'
import { fetchScrubTile, startTilePolling, type TilePoller } from '@/lib/tileFallback'
import type { Detection } from '@/lib/types'

export type PlaybackState = 'idle' | 'playing' | 'paused' | 'complete' | 'error'

interface Store {
  state: PlaybackState
  surveyId: string | null
  currentPing: number
  totalPings: number
  speed: number
  progress: number
  detections: Detection[]
  rowQueue: PingBatch[]
  waterfallWidth: number
  correctedView: boolean
  error: string | null
  transport: 'ws' | 'tiles'
  socket: PlaybackSocket | null
  poller: TilePoller | null

  start: (surveyId: string, totalPings: number) => void
  pause: () => void
  resume: () => void
  seek: (ping: number) => void
  setSpeed: (speed: number) => void
  stop: () => void
  toggleCorrected: () => void
  consumeQueue: () => void
  reset: () => void
  useTileFallback: (fromPing?: number) => void
}

const SPEED_DEFAULT = 4

export const usePlaybackStore = create<Store>((set, get) => ({
  state: 'idle',
  surveyId: null,
  currentPing: 0,
  totalPings: 0,
  speed: SPEED_DEFAULT,
  progress: 0,
  detections: [],
  rowQueue: [],
  waterfallWidth: 0,
  correctedView: false,
  error: null,
  transport: 'ws',
  socket: null,
  poller: null,

  start: (surveyId, totalPings) => {
    get().socket?.disconnect()
    get().poller?.stop()
    const socket = new PlaybackSocket({
      onBatch: (b) =>
        set((s) => ({
          rowQueue: [...s.rowQueue, b],
          currentPing: b.startPing + b.count,
          waterfallWidth: s.waterfallWidth || b.width,
        })),
      onDetection: (d) =>
        set((s) =>
          s.detections.some((x) => x.detection_id === d.detection_id)
            ? s
            : { detections: [...s.detections, d] },
        ),
      onStatus: (ping, progress) => set({ currentPing: ping, progress }),
      onDone: (total) => set({ state: 'complete', totalPings: total, progress: 1 }),
      // the socket only calls this after it has exhausted its reconnects
      onError: () => get().useTileFallback(get().currentPing),
    })
    set({
      socket,
      poller: null,
      surveyId,
      totalPings,
      state: 'playing',
      transport: 'ws',
      detections: [],
      rowQueue: [],
      error: null,
      currentPing: 0,
      progress: 0,
    })
    socket.connect(surveyId, 0, get().speed, 32)
  },

  useTileFallback: (fromPing = 0) => {
    const { surveyId, totalPings, correctedView } = get()
    if (!surveyId) return
    get().socket?.disconnect()
    get().poller?.stop()
    // seed detections from REST so the map/worklist aren't empty without the socket
    void getDetections(surveyId)
      .then((r) => set({ detections: r.detections }))
      .catch(() => undefined)
    const poller = startTilePolling({
      surveyId,
      startPing: fromPing,
      totalPings,
      batch: 48,
      corrected: correctedView,
      onBatch: (b) =>
        set((s) => ({
          rowQueue: [...s.rowQueue, b],
          currentPing: b.startPing + b.count,
          waterfallWidth: s.waterfallWidth || b.width,
        })),
      onDone: () => set({ state: 'complete', progress: 1 }),
    })
    set({ poller, socket: null, transport: 'tiles', state: 'playing', error: null })
  },

  pause: () => {
    get().socket?.send({ type: 'pause' })
    set({ state: 'paused' })
  },
  resume: () => {
    const { transport } = get()
    if (transport === 'tiles') {
      get().useTileFallback(get().currentPing)
      return
    }
    get().socket?.send({ type: 'resume' })
    set({ state: 'playing' })
  },
  seek: (ping) => {
    const { transport, state, surveyId, correctedView } = get()
    set({ currentPing: ping })
    if (transport === 'ws') {
      get().socket?.send({ type: 'seek', ping })
      return
    }
    // tile transport: scrub by fetching the strip at this position
    get().poller?.stop()
    if (surveyId && (state === 'paused' || state === 'complete' || state === 'playing')) {
      void fetchScrubTile(surveyId, ping, 256, correctedView)
        .then((b) => set((s) => ({ rowQueue: [...s.rowQueue, b], waterfallWidth: s.waterfallWidth || b.width })))
        .catch(() => undefined)
    }
  },
  setSpeed: (speed) => {
    get().socket?.send({ type: 'speed', speed })
    set({ speed })
  },
  stop: () => {
    const { socket, poller } = get()
    socket?.send({ type: 'stop' })
    socket?.disconnect()
    poller?.stop()
    set({ state: 'idle', socket: null, poller: null })
  },
  toggleCorrected: () => set((s) => ({ correctedView: !s.correctedView })),

  consumeQueue: () => set({ rowQueue: [] }),

  reset: () => {
    get().socket?.disconnect()
    get().poller?.stop()
    set({
      state: 'idle',
      surveyId: null,
      currentPing: 0,
      totalPings: 0,
      progress: 0,
      detections: [],
      rowQueue: [],
      waterfallWidth: 0,
      error: null,
      transport: 'ws',
      socket: null,
      poller: null,
    })
  },
}))
