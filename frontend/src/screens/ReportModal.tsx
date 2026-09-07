// ReportModal — Report preview overlay with method_notes rendered in FULL.
// Downloads via JSON blob or CSV link.

import { useEffect, useState } from 'react';
import * as api from '../api/client';
import type { ReportResponse } from '../types/api';

interface ReportModalProps {
  surveyId: string;
  onClose: () => void;
}

export function ReportModal({ surveyId, onClose }: ReportModalProps) {
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getReportJson(surveyId)
      .then(setReport)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [surveyId]);

  const handleDownloadJson = async () => {
    try {
      const data = await api.getReportJson(surveyId);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deepsight-report-${surveyId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed:', e);
    }
  };

  return (
    <div className="report-overlay" onClick={onClose}>
      <div className="report-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Survey report</h2>
          <button
            onClick={onClose}
            style={{ fontSize: 20, color: '#7E9AA3', padding: 4 }}
            aria-label="Close report"
          >
            ×
          </button>
        </div>

        {loading && (
          <div style={{ color: '#7E9AA3', fontSize: 13 }}>Loading report…</div>
        )}

        {report && (
          <>
            {/* Survey metadata */}
            <div style={{ fontSize: 13 }}>
              <div>
                <span style={{ color: '#7E9AA3' }}>File: </span>
                {report.survey.filename}
              </div>
              <div>
                <span style={{ color: '#7E9AA3' }}>Date: </span>
                {new Date(report.survey.start_time).toLocaleDateString()}
              </div>
              <div>
                <span style={{ color: '#7E9AA3' }}>Pings: </span>
                <span className="font-mono">{report.survey.ping_count.toLocaleString()}</span>
              </div>
            </div>

            {/* Stats headline — verbatim */}
            <div className="stats-headline" style={{ borderRadius: 4, border: '1px solid #2C4650' }}>
              {report.stats.headline}
            </div>

            {/* Method notes — rendered IN FULL. Not collapsible. Not behind "show more".
                This is where our honesty lives. */}
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                Method notes
              </h3>
              <ul className="report-method-notes">
                {report.method_notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>

            {/* Detection table */}
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                Detections ({report.detections.length})
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    fontSize: 11,
                    borderCollapse: 'collapse',
                    fontFamily: 'var(--font-mono)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <thead>
                    <tr style={{ color: '#7E9AA3', borderBottom: '1px solid #2C4650' }}>
                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>ID</th>
                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Class</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px' }}>Score</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px' }}>Lat</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px' }}>Lon</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px' }}>±m</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.detections.map((det) => (
                      <tr
                        key={det.detection_id}
                        style={{
                          borderBottom: '1px solid #1E333B',
                          color: det.class === 'nombo' ? '#7E9AA3' : '#D6E2E5',
                        }}
                      >
                        <td style={{ padding: '4px 8px' }}>{det.detection_id}</td>
                        <td style={{ padding: '4px 8px' }}>{det.class_display}</td>
                        <td style={{ textAlign: 'right', padding: '4px 8px' }}>
                          {det.confidence.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '4px 8px' }}>
                          {det.lat !== null ? det.lat.toFixed(6) : 'unavailable'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '4px 8px' }}>
                          {det.lon !== null ? det.lon.toFixed(6) : 'unavailable'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '4px 8px' }}>
                          {det.error_radius_m.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Download buttons */}
            <div className="report-download-btns">
              <button className="btn-primary" onClick={handleDownloadJson}>
                Download JSON
              </button>
              <a
                href={api.getReportCsvUrl(surveyId)}
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                download
              >
                Download CSV
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
