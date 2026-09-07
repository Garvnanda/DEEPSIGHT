// UploadScreen  Drop zone, upload progress, parsing status.
// All states: empty, uploading, parsing, failed.

import { useCallback, useRef, useState } from 'react';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { useSurveyStore } from '../stores/surveyStore';

export function UploadScreen() {
  const uploadProgress = useSurveyStore((s) => s.uploadProgress);
  const parseProgress = useSurveyStore((s) => s.parseProgress);
  const error = useSurveyStore((s) => s.error);
  const uploadFile = useSurveyStore((s) => s.uploadFile);
  const clearError = useSurveyStore((s) => s.clearError);

  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      clearError();
      uploadFile(file);
    },
    [uploadFile, clearError]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  // --- Failed state ---
  if (error) {
    return (
      <div className="upload-screen">
        <ErrorDisplay
          error={error}
          onTryAnother={() => {
            clearError();
          }}
        />
      </div>
    );
  }

  // --- Parsing state ---
  if (parseProgress && parseProgress.status === 'parsing') {
    return (
      <div className="upload-screen">
        <div className="upload-progress">
          <h2 style={{ fontSize: 20, fontWeight: 500 }}>Parsing survey…</h2>
          <div className="upload-progress-bar">
            <div
              className="upload-progress-bar-fill"
              style={{ width: `${(parseProgress.progress * 100).toFixed(0)}%` }}
            />
          </div>
          <span className="font-mono" style={{ fontSize: 13, color: '#7E9AA3' }}>
            {parseProgress.pings_processed.toLocaleString()} pings read
          </span>
          {parseProgress.message && (
            <span style={{ fontSize: 12, color: '#7E9AA3' }}>
              {parseProgress.message}
            </span>
          )}
        </div>
      </div>
    );
  }

  // --- Uploading state ---
  if (uploadProgress !== null) {
    return (
      <div className="upload-screen">
        <div className="upload-progress">
          <h2 style={{ fontSize: 20, fontWeight: 500 }}>Uploading…</h2>
          <div className="upload-progress-bar">
            <div
              className="upload-progress-bar-fill"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <span className="font-mono" style={{ fontSize: 13, color: '#7E9AA3' }}>
            {uploadProgress}%
          </span>
        </div>
      </div>
    );
  }

  // --- Empty state (default) ---
  return (
    <div className="upload-screen">
      <div
        className={`upload-dropzone ${dragOver ? 'drag-over' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <h2>Drop an XTF survey file to begin</h2>
        <p>
          XTF (eXtended Triton Format) is the standard side-scan sonar data format
          used by EdgeTech, Klein, and other manufacturers.
        </p>
        <p style={{ marginTop: 8 }}>
          <span style={{ color: '#4FB3C9', cursor: 'pointer' }}>
            Browse files
          </span>
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xtf,.XTF"
          onChange={onInputChange}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}
