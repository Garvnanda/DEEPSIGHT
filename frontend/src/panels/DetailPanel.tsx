// DetailPanel  The answer to "how did you get that coordinate?"
// Error budget bar, geometry, flags, dimensions. All from GET /api/detections/{id}.

import { useSelectionStore } from '../stores/selectionStore';

export function DetailPanel() {
  const detail = useSelectionStore((s) => s.detectionDetail);
  const loading = useSelectionStore((s) => s.loading);
  const selectedId = useSelectionStore((s) => s.selectedDetectionId);

  if (!selectedId) {
    return (
      <div className="detail-panel" style={{ color: '#7E9AA3', fontSize: 12 }}>
        Select a target to view details
      </div>
    );
  }

  if (loading) {
    return (
      <div className="detail-panel" style={{ color: '#7E9AA3', fontSize: 12 }}>
        Loading…
      </div>
    );
  }

  if (!detail) return null;

  const { detection: det, error_budget: eb, geometry: geo } = detail;

  return (
    <div className="detail-panel">
      {/* 1. Class header  class_display large + raw class code small */}
      <div className="detail-class-header">
        <span className="detail-class-display">{det.class_display}</span>
        <span className="detail-class-code">{det.class}</span>
      </div>

      {/* 2. Coordinate block  null renders as "unavailable", NEVER as 0 */}
      <div className="detail-coords">
        <div>
          <span style={{ color: '#7E9AA3', marginRight: 8 }}>Lat</span>
          {det.lat !== null ? (
            <span>{det.lat.toFixed(6)}°</span>
          ) : (
            <span className="detail-unavailable">unavailable</span>
          )}
        </div>
        <div>
          <span style={{ color: '#7E9AA3', marginRight: 8 }}>Lon</span>
          {det.lon !== null ? (
            <span>{det.lon.toFixed(6)}°</span>
          ) : (
            <span className="detail-unavailable">unavailable</span>
          )}
        </div>
        <div style={{ marginTop: 4 }}>
          <span style={{ color: '#7E9AA3', marginRight: 8 }}>Search radius</span>
          <span style={{ color: '#E8A33D' }}>±{det.error_radius_m.toFixed(1)} m</span>
        </div>
      </div>

      {/* 3. Error budget bar  CSS flexbox, widths from terms */}
      <div>
        <div className="error-budget-bar">
          {eb.terms.map((term, i) => {
            const pct = eb.total_m > 0 ? (term.value_m / eb.total_m) * 100 : 0;
            return (
              <div
                key={i}
                className={`error-budget-segment ${term.kind}`}
                style={{ width: `${Math.max(pct, 5)}%` }}
                title={`${term.label}: ${term.value_m.toFixed(1)} m (${term.kind})`}
              >
                {pct > 10 ? term.label.split(' ')[0] : ''}
              </div>
            );
          })}
        </div>
        <div className="error-budget-summary" style={{ marginTop: 4 }}>
          <span>Total: {eb.total_m.toFixed(1)} m</span>
          <span>Dominant: {eb.dominant_term}</span>
        </div>
      </div>

      {/* 4. Explanation  rendered verbatim. Don't write our own. */}
      <div className="error-budget-explanation">{eb.explanation}</div>

      {/* 5. Geometry section */}
      <dl className="detail-geometry">
        <dt>Slant range</dt>
        <dd>{geo.slant_range_m.toFixed(1)} m</dd>
        <dt>Ground range</dt>
        <dd>{geo.ground_range_m.toFixed(1)} m</dd>
        <dt>Altitude</dt>
        <dd>{geo.altitude_m.toFixed(1)} m</dd>
        <dt>Layback</dt>
        <dd>{geo.layback_m.toFixed(1)} m</dd>
        <dt>Heading</dt>
        <dd>{geo.heading_deg.toFixed(1)}°</dd>
        <dt>Fish position</dt>
        <dd>
          {geo.fish_lat !== null && geo.fish_lon !== null
            ? `${geo.fish_lat.toFixed(4)}, ${geo.fish_lon.toFixed(4)}`
            : 'unavailable'}
        </dd>
      </dl>

      {/* 6. Dimensions */}
      <div style={{ fontSize: 12 }}>
        <span style={{ color: '#7E9AA3' }}>Dimensions: </span>
        <span className="font-mono">
          {det.bbox_m_width.toFixed(1)} × {det.bbox_m_height.toFixed(1)} m
        </span>
        {det.object_height_m > 0 && (
          <>
            <span style={{ color: '#7E9AA3' }}> · Height: </span>
            <span className="font-mono">{det.object_height_m.toFixed(1)} m</span>
          </>
        )}
      </div>

      {/* 7. Flags  small label chips explaining WHY the circle is large */}
      {det.flags.length > 0 && (
        <div className="flag-list">
          {det.flags.map((flag) => (
            <span key={flag} className="flag-chip">
              {flag.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      {/* 8. Confidence  "Detector score", NOT "probability" */}
      <div style={{ fontSize: 12 }}>
        <span style={{ color: '#7E9AA3' }}>Detector score: </span>
        <span className="font-mono">{det.confidence.toFixed(2)}</span>
      </div>

      {/* 9. Channel */}
      <div style={{ fontSize: 12 }}>
        <span style={{ color: '#7E9AA3' }}>Channel: </span>
        <span>{det.channel}</span>
      </div>
    </div>
  );
}
