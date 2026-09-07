import { create } from 'zustand';
import type { DetectionDetailResponse } from '../types/api';
import * as api from '../api/client';

interface SelectionState {
  selectedDetectionId: string | null;
  detectionDetail: DetectionDetailResponse | null;
  loading: boolean;

  // Actions
  selectDetection: (id: string | null) => void;
  clearSelection: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedDetectionId: null,
  detectionDetail: null,
  loading: false,

  selectDetection: async (id: string | null) => {
    if (!id) {
      set({ selectedDetectionId: null, detectionDetail: null, loading: false });
      return;
    }
    set({ selectedDetectionId: id, loading: true, detectionDetail: null });
    try {
      const detail = await api.getDetection(id);
      set({ detectionDetail: detail, loading: false });
    } catch (e) {
      console.error('Failed to load detection detail:', e);
      set({ loading: false });
    }
  },

  clearSelection: () => {
    set({ selectedDetectionId: null, detectionDetail: null, loading: false });
  },
}));
