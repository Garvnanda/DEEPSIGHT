import { create } from 'zustand'

import { PlaybackSocket, type PingBatch } from '@/lib/playbackSocket'
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
  socket: PlaybackSocket | null

  start: (surveyId: string, totalPings: number) => void
  pause: () => void
  resume: () => void
  seek: (ping: number) => void
  setSpeed: (speed: number) => void
  stop: () => void
  toggleCorrected: () => void
  consumeQueue: () => void
  reset: () => void
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
  socket: null,

  start: (surveyId, totalPings) => {
    get().socket?.disconnect()
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
      onError: (message) => set({ state: 'error', error: message }),
    })
    set({
      socket,
      surveyId,
      totalPings,
      state: 'playing',
      detections: [],
      rowQueue: [],
      error: null,
      currentPing: 0,
      progress: 0,
    })
    socket.connect(surveyId, 0, get().speed, 32)
  },

  pause: () => {
    get().socket?.send({ type: 'pause' })
    set({ state: 'paused' })
  },
  resume: () => {
    get().socket?.send({ type: 'resume' })
    set({ state: 'playing' })
  },
  seek: (ping) => {
    get().socket?.send({ type: 'seek', ping })
    set({ currentPing: ping })
  },
  setSpeed: (speed) => {
    get().socket?.send({ type: 'speed', speed })
    set({ speed })
  },
  stop: () => {
    const { socket } = get()
    if (socket) {
      socket.send({ type: 'stop' })
      socket.disconnect()
    }
    set({ state: 'idle', socket: null })
  },
  toggleCorrected: () => set((s) => ({ correctedView: !s.correctedView })),

  consumeQueue: () => set({ rowQueue: [] }),

  reset: () => {
    get().socket?.disconnect()
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
      socket: null,
    })
  },
}))
