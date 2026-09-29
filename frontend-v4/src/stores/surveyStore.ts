import { create } from 'zustand'

import { ApiError, listSurveys } from '@/lib/api'
import type { SurveyListItem, SurveyStatus } from '@/lib/types'

const ACTIVE: SurveyStatus[] = ['uploaded', 'parsing', 'processing']

interface SurveyState {
  surveys: SurveyListItem[]
  loading: boolean
  error: string | null
  lastLoaded: number | null
  poll: ReturnType<typeof setInterval> | null
  refresh: () => Promise<void>
  ensureFresh: () => void
  startAutoPoll: () => void
  stopAutoPoll: () => void
}

export const useSurveyStore = create<SurveyState>((set, get) => ({
  surveys: [],
  loading: false,
  error: null,
  lastLoaded: null,
  poll: null,

  refresh: async () => {
    set({ loading: true })
    try {
      const res = await listSurveys()
      set({ surveys: res.surveys, error: null, loading: false, lastLoaded: Date.now() })
      const anyActive = res.surveys.some((s) => ACTIVE.includes(s.status))
      if (anyActive) get().startAutoPoll()
      else get().stopAutoPoll()
    } catch (e) {
      set({
        loading: false,
        error: e instanceof ApiError ? e.message : 'Failed to load surveys.',
      })
    }
  },

  ensureFresh: () => {
    const { lastLoaded, loading } = get()
    if (loading) return
    if (!lastLoaded || Date.now() - lastLoaded > 4000) void get().refresh()
  },

  startAutoPoll: () => {
    if (get().poll) return
    const t = setInterval(() => void get().refresh(), 2000)
    set({ poll: t })
  },

  stopAutoPoll: () => {
    const t = get().poll
    if (t) {
      clearInterval(t)
      set({ poll: null })
    }
  },
}))
