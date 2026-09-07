// Deep-Sight API Client
// One function per REST endpoint. Matches apiendpoints.md exactly.

import type {
    ApiErrorBody,
    ApiErrorResponse,
    DetectionDetailResponse,
    DetectionQueryParams,
    DetectionsResponse,
    ProcessResponse,
    ReportResponse,
    SurveyDetail,
    SurveyListResponse,
    SurveyStats,
    SurveyStatusResponse,
    SurveyUploadResponse,
} from '../types/api';

const BASE_URL = 'http://localhost:8000';

// --- Error handling ---

export class ApiError extends Error {
  code: string;
  detail: string;
  surveyId?: string;
  httpStatus: number;

  constructor(body: ApiErrorBody, status: number) {
    super(body.message); // .message is always safe to show to user
    this.name = 'ApiError';
    this.code = body.code;
    this.detail = body.detail; // console only, never shown on screen
    this.surveyId = body.survey_id;
    this.httpStatus = status;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    let body: ApiErrorResponse;
    try {
      body = (await res.json()) as ApiErrorResponse;
    } catch {
      throw new ApiError(
        {
          code: 'UNKNOWN',
          message: 'An unexpected error occurred.',
          detail: `HTTP ${res.status}: ${res.statusText}`,
        },
        res.status
      );
    }
    console.error(`[API ${res.status}]`, body.error.detail);
    throw new ApiError(body.error, res.status);
  }
  return res.json() as Promise<T>;
}

// --- Endpoints ---

/**
 * POST /api/surveys  Upload an XTF file.
 * Uses XMLHttpRequest (not fetch) for upload progress tracking.
 */
export function uploadSurvey(
  file: File,
  onProgress: (pct: number) => void
): Promise<SurveyUploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 201 || xhr.status === 200) {
        try {
          resolve(JSON.parse(xhr.responseText) as SurveyUploadResponse);
        } catch {
          reject(
            new ApiError(
              {
                code: 'UNKNOWN',
                message: 'Invalid response from server.',
                detail: 'Failed to parse upload response JSON',
              },
              xhr.status
            )
          );
        }
      } else {
        try {
          const body = JSON.parse(xhr.responseText) as ApiErrorResponse;
          console.error(`[API ${xhr.status}]`, body.error.detail);
          reject(new ApiError(body.error, xhr.status));
        } catch {
          reject(
            new ApiError(
              {
                code: 'UNKNOWN',
                message: 'Upload failed.',
                detail: `HTTP ${xhr.status}`,
              },
              xhr.status
            )
          );
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(
        new ApiError(
          {
            code: 'UNKNOWN',
            message: 'Network error during upload.',
            detail: 'XHR error event fired',
          },
          0
        )
      );
    });

    xhr.addEventListener('abort', () => {
      reject(
        new ApiError(
          {
            code: 'UNKNOWN',
            message: 'Upload cancelled.',
            detail: 'XHR abort event fired',
          },
          0
        )
      );
    });

    xhr.open('POST', `${BASE_URL}/api/surveys`);
    xhr.send(formData);
  });
}

/** GET /api/surveys  List all surveys, newest first. */
export function listSurveys(): Promise<SurveyListResponse> {
  return apiFetch('/api/surveys');
}

/** GET /api/surveys/{id}  Full survey detail for setting up the view. */
export function getSurvey(surveyId: string): Promise<SurveyDetail> {
  return apiFetch(`/api/surveys/${surveyId}`);
}

/** GET /api/surveys/{id}/status  Poll during parsing/processing. Safe every 1s. */
export function getSurveyStatus(surveyId: string): Promise<SurveyStatusResponse> {
  return apiFetch(`/api/surveys/${surveyId}/status`);
}

/** POST /api/surveys/{id}/process  Kick off headless detection. */
export function processSurvey(surveyId: string): Promise<ProcessResponse> {
  return apiFetch(`/api/surveys/${surveyId}/process`, { method: 'POST' });
}

/** GET /api/surveys/{id}/detections  All detections for a survey. */
export function getDetections(
  surveyId: string,
  params?: DetectionQueryParams
): Promise<DetectionsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.class) searchParams.set('class', params.class);
  if (params?.min_confidence != null)
    searchParams.set('min_confidence', String(params.min_confidence));
  if (params?.sort) searchParams.set('sort', params.sort);
  const qs = searchParams.toString();
  return apiFetch(`/api/surveys/${surveyId}/detections${qs ? `?${qs}` : ''}`);
}

/** GET /api/detections/{id}  Single detection with error budget + geometry. */
export function getDetection(detectionId: string): Promise<DetectionDetailResponse> {
  return apiFetch(`/api/detections/${detectionId}`);
}

/** GET /api/surveys/{id}/track  GeoJSON LineString for the map. */
export function getTrack(
  surveyId: string
): Promise<GeoJSON.Feature<GeoJSON.LineString>> {
  return apiFetch(`/api/surveys/${surveyId}/track`);
}

/**
 * GET /api/surveys/{id}/waterfall  PNG tile for scrubbing & fallback.
 * Returns image/png as a Blob (not JSON).
 */
export async function getWaterfallTile(
  surveyId: string,
  startPing: number,
  count: number,
  corrected = false
): Promise<Blob> {
  const params = new URLSearchParams({
    start_ping: String(startPing),
    count: String(count),
    corrected: String(corrected),
  });
  const res = await fetch(
    `${BASE_URL}/api/surveys/${surveyId}/waterfall?${params}`
  );
  if (!res.ok) {
    let body: ApiErrorResponse;
    try {
      body = (await res.json()) as ApiErrorResponse;
    } catch {
      throw new ApiError(
        {
          code: 'UNKNOWN',
          message: 'Failed to load waterfall tile.',
          detail: `HTTP ${res.status}`,
        },
        res.status
      );
    }
    console.error(`[API ${res.status}]`, body.error.detail);
    throw new ApiError(body.error, res.status);
  }
  return res.blob();
}

/** GET /api/surveys/{id}/stats  Headline numbers for the survey. */
export function getStats(surveyId: string): Promise<SurveyStats> {
  return apiFetch(`/api/surveys/${surveyId}/stats`);
}

/** GET /api/surveys/{id}/report.json  Full report for preview. */
export function getReportJson(surveyId: string): Promise<ReportResponse> {
  return apiFetch(`/api/surveys/${surveyId}/report.json`);
}

/** Returns the URL for CSV download. Browser handles Content-Disposition. */
export function getReportCsvUrl(surveyId: string): string {
  return `${BASE_URL}/api/surveys/${surveyId}/report.csv`;
}
