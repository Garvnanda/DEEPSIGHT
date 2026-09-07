import { create } from 'zustand';
import type {
  SurveyListItem,
  SurveyDetail,
  SurveyStatusResponse,
} from '../types/api';
import * as api from '../api/client';

interface SurveyState {
  surveys: SurveyListItem[];
  currentSurvey: SurveyDetail | null;
  uploadProgress: number | null; // 0–100 during upload, null otherwise
  parseProgress: SurveyStatusResponse | null;
  error: string | null;
  pollingTimer: ReturnType<typeof setInterval> | null;

  // Actions
  fetchSurveys: () => Promise<void>;
  loadSurvey: (id: string) => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  pollStatus: (id: string) => void;
  stopPolling: () => void;
  clearError: () => void;
}

export const useSurveyStore = create<SurveyState>((set, get) => ({
  surveys: [],
  currentSurvey: null,
  uploadProgress: null,
  parseProgress: null,
  error: null,
  pollingTimer: null,

  fetchSurveys: async () => {
    try {
      const res = await api.listSurveys();
      set({ surveys: res.surveys, error: null });
    } catch (e) {
      set({ error: e instanceof api.ApiError ? e.message : 'Failed to load surveys.' });
    }
  },

  loadSurvey: async (id: string) => {
    try {
      const survey = await api.getSurvey(id);
      set({ currentSurvey: survey, error: null });
    } catch (e) {
      set({ error: e instanceof api.ApiError ? e.message : 'Failed to load survey.' });
    }
  },

  uploadFile: async (file: File) => {
    set({ uploadProgress: 0, error: null });
    try {
      const res = await api.uploadSurvey(file, (pct) => {
        set({ uploadProgress: pct });
      });
      set({ uploadProgress: null });
      // Start polling for parsing status
      get().pollStatus(res.survey_id);
    } catch (e) {
      set({
        uploadProgress: null,
        error: e instanceof api.ApiError ? e.message : 'Upload failed.',
      });
    }
  },

  pollStatus: (id: string) => {
    get().stopPolling();
    const timer = setInterval(async () => {
      try {
        const status = await api.getSurveyStatus(id);
        set({ parseProgress: status });
        if (status.status === 'ready' || status.status === 'complete') {
          get().stopPolling();
          // Load the full survey detail
          await get().loadSurvey(id);
        } else if (status.status === 'failed') {
          get().stopPolling();
          set({ error: status.message || 'Processing failed.' });
        }
      } catch (e) {
        get().stopPolling();
        set({ error: e instanceof api.ApiError ? e.message : 'Failed to check status.' });
      }
    }, 1000);
    set({ pollingTimer: timer });
  },

  stopPolling: () => {
    const timer = get().pollingTimer;
    if (timer) {
      clearInterval(timer);
      set({ pollingTimer: null });
    }
  },

  clearError: () => set({ error: null }),
}));
