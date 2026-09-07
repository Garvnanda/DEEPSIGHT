// Worklist  Sorted target list with cross-view selection.
// Confidence DESC, then error_radius ASC. nombo de-emphasised but visible.


import { usePlaybackStore } from '../stores/playbackStore';
import { useSelectionStore } from '../stores/selectionStore';
import type { Detection } from '../types/api';

// Detection class → colour hex
const CLASS_COLOURS: Record<string, string> = {
  wreck: '#E0674F',
  milco: '#E8A33D',
  pipeline: '#4FB3C9',
  nombo: '#7E9AA3',
};

function sortDetections(dets: Detection[]): Detection[] {
  return [...dets].sort((a, b) => {
    // Confidence DESC
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    // Then error_radius ASC (tighter circle = more actionable)
    return a.error_radius_m - b.error_radius_m;
  });
}

export function Worklist() {
  const detections = usePlaybackStore((s) => s.detections);
  const selectedId = useSelectionStore((s) => s.selectedDetectionId);
  const selectDetection = useSelectionStore((s) => s.selectDetection);

  const sorted = sortDetections(detections);

  // Scroll the waterfall to the selected detection's ping
  const seek = usePlaybackStore((s) => s.seek);

  const handleClick = (det: Detection) => {
    selectDetection(det.detection_id);
    seek(det.ping);
  };

  if (sorted.length === 0) {
    return (
      <div style={{ padding: 16, color: '#7E9AA3', fontSize: 12 }}>
        {usePlaybackStore.getState().state === 'idle'
          ? 'Press play to begin scanning'
          : 'No targets detected yet'}
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: '10px 16px', fontSize: 11, color: '#7E9AA3', borderBottom: '1px solid #2C4650' }}>
        Targets ({sorted.length})
      </div>
      {sorted.map((det) => (
        <div
          key={det.detection_id}
          className={`worklist-item ${det.class === 'nombo' ? 'nombo' : ''} ${
            selectedId === det.detection_id ? 'selected' : ''
          }`}
          onClick={() => handleClick(det)}
        >
          <span
            className="worklist-class-dot"
            style={{ backgroundColor: CLASS_COLOURS[det.class] || '#4FB3C9' }}
          />
          <div className="worklist-info">
            <div className="worklist-class-name">
              {/* Render class_display, never the raw code in the list */}
              {det.class_display}
            </div>
            <div className="worklist-meta">
              <span>score {det.confidence.toFixed(2)}</span>
              {' · '}
              <span>±{det.error_radius_m.toFixed(1)} m</span>
              {' · '}
              <span>ping {det.ping.toLocaleString()}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
