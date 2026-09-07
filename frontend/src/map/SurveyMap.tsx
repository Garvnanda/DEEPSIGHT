// SurveyMap  Leaflet map with track, detection circles in metres, moving marker.
// Dark CARTO basemap. Circles sized by error_radius_m (native metres).

import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState } from 'react';
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer } from 'react-leaflet';

import * as api from '../api/client';
import { usePlaybackStore } from '../stores/playbackStore';
import { useSelectionStore } from '../stores/selectionStore';
import { useSurveyStore } from '../stores/surveyStore';

// Class → colour hex (Leaflet can't resolve CSS variables)
const CLASS_COLOURS: Record<string, string> = {
  wreck: '#E0674F',
  milco: '#E8A33D',
  pipeline: '#4FB3C9',
  nombo: '#7E9AA3',
};

/** Convert GeoJSON [lon, lat] → Leaflet [lat, lon] */
function geoToLatLng(coord: number[]): LatLngExpression {
  return [coord[1], coord[0]];
}

export function SurveyMap() {
  const survey = useSurveyStore((s) => s.currentSurvey);
  const detections = usePlaybackStore((s) => s.detections);
  const selectedId = useSelectionStore((s) => s.selectedDetectionId);
  const selectDetection = useSelectionStore((s) => s.selectDetection);

  const [trackPositions, setTrackPositions] = useState<LatLngExpression[]>([]);
  const [currentPos, setCurrentPos] = useState<LatLngExpression | null>(null);

  // Derive survey bounds for initial map view
  const surveyBounds = useMemo<LatLngBoundsExpression | undefined>(() => {
    if (!survey?.bounds) return undefined;
    return [
      [survey.bounds.south, survey.bounds.west],
      [survey.bounds.north, survey.bounds.east],
    ];
  }, [survey]);

  // Load track GeoJSON
  useEffect(() => {
    if (!survey) return;
    api
      .getTrack(survey.survey_id)
      .then((feature) => {
        if (feature.geometry?.type === 'LineString') {
          const coords = (feature.geometry as GeoJSON.LineString).coordinates;
          setTrackPositions(coords.map(geoToLatLng));
        }
      })
      .catch(console.error);
  }, [survey]);

  // Update current position from latest nav data
  useEffect(() => {
    const unsub = usePlaybackStore.subscribe((state) => {
      const queue = state.rowQueue;
      if (queue.length > 0) {
        const lastBatch = queue[queue.length - 1];
        const lastNav = lastBatch.nav[lastBatch.nav.length - 1];
        // Skip null lat/lon  don't draw at 0,0
        if (lastNav && lastNav.lat !== null && lastNav.lon !== null) {
          setCurrentPos([lastNav.lat, lastNav.lon]);
        }
      }
    });
    return unsub;
  }, []);

  if (!survey || !surveyBounds) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7E9AA3', fontSize: 12 }}>
        Map
      </div>
    );
  }

  return (
    <MapContainer
      bounds={surveyBounds}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
        maxZoom={19}
      />

      {/* Vessel track */}
      {trackPositions.length > 1 && (
        <Polyline
          positions={trackPositions}
          pathOptions={{ color: '#4FB3C9', weight: 2, opacity: 0.7 }}
        />
      )}

      {/* Current position marker */}
      {currentPos && (
        <CircleMarker
          center={currentPos}
          radius={4}
          pathOptions={{
            color: '#4FB3C9',
            fillColor: '#4FB3C9',
            fillOpacity: 1,
            weight: 2,
          }}
        />
      )}

      {/* Detection circles  guard null lat/lon */}
      {detections
        .filter((det) => det.lat !== null && det.lon !== null)
        .map((det) => (
          <Circle
            key={det.detection_id}
            center={[det.lat!, det.lon!]}
            radius={det.error_radius_m} // native metres!
            pathOptions={{
              color:
                selectedId === det.detection_id
                  ? '#FFFFFF'
                  : CLASS_COLOURS[det.class] || '#4FB3C9',
              fillColor: CLASS_COLOURS[det.class] || '#4FB3C9',
              fillOpacity: det.confidence * 0.4,
              weight: det.class === 'nombo' ? 1 : selectedId === det.detection_id ? 3 : 2,
            }}
            eventHandlers={{
              click: () => selectDetection(det.detection_id),
            }}
          />
        ))}
    </MapContainer>
  );
}
