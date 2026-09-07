// Deep-Sight API Types
// Hand-typed from docs/apiendpoints.md — the frozen contract.
// This file mirrors the contract EXACTLY. Do not add fields that aren't in the contract.

// === Enums & Unions ===

export type SurveyStatus =
  | 'uploaded'
  | 'parsing'
  | 'ready'
  | 'processing'
  | 'complete'
  | 'failed';

export type DetectionClass = 'wreck' | 'milco' | 'nombo' | 'pipeline';

export type DetectionFlag =
  | 'near_nadir'
  | 'on_turn'
  | 'long_layback'
  | 'estimated_altitude'
  | 'range_change_nearby';

export type AltitudeSource = 'xtf_header' | 'blank_zone_estimate';

export type DetectionSort = 'confidence' | 'ping' | 'error_radius';

// === Survey (POST /api/surveys response, and list items) ===

export interface SurveyUploadResponse {
  survey_id: string;
  filename: string;
  size_bytes: number;
  status: SurveyStatus;
  created_at: string;
}

export interface SurveyListItem {
  survey_id: string;
  filename: string;
  status: SurveyStatus;
  ping_count: number;
  detection_count: number;
  created_at: string;
}

export interface SurveyListResponse {
  surveys: SurveyListItem[];
}

// === Survey Detail (GET /api/surveys/{id}) ===

export interface SurveyBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface SurveyDetail {
  survey_id: string;
  filename: string;
  status: SurveyStatus;
  ping_count: number;
  samples_per_channel: number;
  range_m: number;
  frequency_khz: number;
  duration_s: number;
  altitude_source: AltitudeSource;
  altitude_mean_m: number;
  sound_speed_ms: number;
  bounds: SurveyBounds;
  start_time: string;
  warnings: string[];
}

// === Survey Status (GET /api/surveys/{id}/status) ===

export interface SurveyStatusResponse {
  survey_id: string;
  status: SurveyStatus;
  progress: number; // 0.0–1.0
  pings_processed: number;
  detections_so_far: number;
  message: string | null;
}

// === Process (POST /api/surveys/{id}/process) ===

export interface ProcessResponse {
  survey_id: string;
  status: SurveyStatus;
  job_id: string;
}

// === Detection ===

export interface BboxPx {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Detection {
  detection_id: string;
  survey_id: string;
  ping: number;
  timestamp: string;
  lat: number | null;
  lon: number | null;
  error_radius_m: number;
  class: DetectionClass;
  class_display: string;
  confidence: number;
  bbox_m_width: number;
  bbox_m_height: number;
  object_height_m: number;
  channel: 'port' | 'starboard';
  ground_range_m: number;
  bbox_px: BboxPx;
  altitude_source: AltitudeSource;
  flags: DetectionFlag[];
}

export interface DetectionsResponse {
  survey_id: string;
  count: number;
  detections: Detection[];
}

export interface DetectionQueryParams {
  class?: DetectionClass;
  min_confidence?: number;
  sort?: DetectionSort;
}

// === Detection Detail (GET /api/detections/{id}) ===

export interface ErrorBudgetTerm {
  source: string;
  label: string;
  value_m: number;
  kind: 'independent' | 'systematic';
}

export interface ErrorBudget {
  total_m: number;
  method: string;
  terms: ErrorBudgetTerm[];
  dominant_term: string;
  explanation: string;
}

export interface DetectionGeometry {
  slant_range_m: number;
  ground_range_m: number;
  altitude_m: number;
  layback_m: number;
  heading_deg: number;
  fish_lat: number | null;
  fish_lon: number | null;
}

export interface DetectionDetailResponse {
  detection: Detection;
  error_budget: ErrorBudget;
  geometry: DetectionGeometry;
}

// === Survey Stats (GET /api/surveys/{id}/stats) ===

export interface SurveyStats {
  area_surveyed_m2: number;
  line_length_km: number;
  targets_flagged: number;
  targets_by_class: Record<DetectionClass, number>;
  review_area_fraction: number;
  mean_error_radius_m: number;
  headline: string; // Pre-formatted by backend — render verbatim
}

// === Report (GET /api/surveys/{id}/report.json) ===

export interface ReportResponse {
  survey: SurveyDetail;
  generated_at: string;
  stats: SurveyStats;
  detections: Detection[];
  method_notes: string[]; // Render in full. Not boilerplate. Not collapsible.
}

// === WebSocket: Client → Server ===

export type WsClientMessage =
  | { type: 'start'; start_ping: number; speed: number; batch_size: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'seek'; ping: number }
  | { type: 'speed'; speed: number }
  | { type: 'stop' };

// === WebSocket: Server → Client ===

export interface NavPoint {
  ping: number;
  lat: number | null;
  lon: number | null;
  heading: number | null;
  altitude_m: number | null;
  speed_kn: number | null;
}

export interface WsPingBatch {
  type: 'ping_batch';
  start_ping: number;
  count: number;
  width: number;
  encoding: 'u8_base64';
  rows: string; // base64-encoded, count × width bytes
  nav: NavPoint[];
}

export interface WsDetection {
  type: 'detection';
  detection: Detection;
}

export interface WsStatus {
  type: 'status';
  ping: number;
  progress: number;
  message: string | null;
}

export interface WsDone {
  type: 'done';
  total_pings: number;
  total_detections: number;
}

export interface WsError {
  type: 'error';
  code: string;
  message: string;
}

export type WsServerMessage =
  | WsPingBatch
  | WsDetection
  | WsStatus
  | WsDone
  | WsError;

// === API Errors (§9) ===

export interface ApiErrorBody {
  code: string;
  message: string; // Always safe to show to user
  detail: string; // Console only, never shown on screen
  survey_id?: string;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}

// Error codes P handles explicitly:
// SURVEY_NOT_FOUND (404) — "That survey no longer exists."
// PARSE_FAILED (422) — show message + "Try another file"
// NOT_READY (409) — "Still parsing — this takes about a minute."
// PROCESSING_FAILED (500) — show message + retry button
// FILE_TOO_LARGE (413) — "That file is over the 500 MB limit."
