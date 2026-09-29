import { create } from 'zustand'

import { getDetection } from '@/lib/api'
import type { DetectionDetailResponse } from '@/lib/types'

interface SelectionState {
  selectedId: string | null
  detail: DetectionDetailResponse | null
  loading: boolean
  select: (id: string | null) => Promise<void>
  clear: () => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedId: null,
  detail: null,
  loading: false,

  select: async (id) => {
    if (!id) {
      set({ selectedId: null, detail: null, loading: false })
      return
    }
    set({ selectedId: id, loading: true, detail: null })
    try {
      const detail = await getDetection(id)
      set({ detail, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  clear: () => set({ selectedId: null, detail: null, loading: false }),
}))
