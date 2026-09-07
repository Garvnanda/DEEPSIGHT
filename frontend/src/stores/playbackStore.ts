import { create } from 'zustand';
import type { Detection, NavPoint } from '../types/api';
import { PlaybackSocket } from '../ws/playbackSocket';

export interface PingBatchData {
  data: Uint8Array;
  count: number;
  width: number;
  startPing: number;
  nav: NavPoint[];
}

interface PlaybackState {
  state: 'idle' | 'playing' | 'paused' | 'complete' | 'error';
  currentPing: number;
  totalPings: number;
  speed: number;
  progress: number; // 0.0–1.0
  detections: Detection[];
  rowQueue: PingBatchData[];
  error: string | null;
  correctedView: boolean;
  socket: PlaybackSocket | null;
  waterfallWidth: number; // Set from first ping_batch

  // Actions
  startPlayback: (surveyId: string) => void;
  pause: () => void;
  resume: () => void;
  seek: (ping: number) => void;
  setSpeed: (speed: number) => void;
  stop: () => void;
  addBatch: (batch: PingBatchData) => void;
  addDetection: (det: Detection) => void;
  updateProgress: (ping: number, progress: number) => void;
  setComplete: (totalPings: number, totalDetections: number) => void;
  setError: (msg: string) => void;
  toggleCorrected: () => void;
  reset: () => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  state: 'idle',
  currentPing: 0,
  totalPings: 0,
  speed: 4,
  progress: 0,
  detections: [],
  rowQueue: [],
  error: null,
  correctedView: false,
  socket: null,
  waterfallWidth: 0,

  startPlayback: (surveyId: string) => {
    const existing = get().socket;
    if (existing) existing.disconnect();

    const socket = new PlaybackSocket();
    set({ socket, state: 'playing', detections: [], rowQueue: [], error: null, currentPing: 0, progress: 0 });
    socket.connect(surveyId, 0, get().speed, 32);
  },

  pause: () => {
    const { socket } = get();
    if (socket) socket.send({ type: 'pause' });
    set({ state: 'paused' });
  },

  resume: () => {
    const { socket } = get();
    if (socket) socket.send({ type: 'resume' });
    set({ state: 'playing' });
  },

  seek: (ping: number) => {
    const { socket } = get();
    if (socket) socket.send({ type: 'seek', ping });
    set({ currentPing: ping });
  },

  setSpeed: (speed: number) => {
    const { socket } = get();
    if (socket) socket.send({ type: 'speed', speed });
    set({ speed });
  },

  stop: () => {
    const { socket } = get();
    if (socket) {
      socket.send({ type: 'stop' });
      socket.disconnect();
    }
    set({ state: 'idle', socket: null });
  },

  addBatch: (batch: PingBatchData) => {
    set((s) => ({
      rowQueue: [...s.rowQueue, batch],
      currentPing: batch.startPing + batch.count,
      waterfallWidth: s.waterfallWidth || batch.width,
    }));
  },

  addDetection: (det: Detection) => {
    set((s) => ({ detections: [...s.detections, det] }));
  },

  updateProgress: (ping: number, progress: number) => {
    set({ currentPing: ping, progress });
  },

  setComplete: (totalPings: number, _totalDetections: number) => {
    set({ state: 'complete', totalPings, progress: 1 });
  },

  setError: (msg: string) => {
    set({ state: 'error', error: msg });
  },

  toggleCorrected: () => {
    set((s) => ({ correctedView: !s.correctedView }));
  },

  reset: () => {
    const { socket } = get();
    if (socket) socket.disconnect();
    set({
      state: 'idle',
      currentPing: 0,
      totalPings: 0,
      progress: 0,
      detections: [],
      rowQueue: [],
      error: null,
      socket: null,
      waterfallWidth: 0,
    });
  },
}));
