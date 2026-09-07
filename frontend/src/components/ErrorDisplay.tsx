// ErrorDisplay — Maps API error codes to user-facing messages.
// Shows what happened and how to fix it. Never vague. Never apologetic.

import { ApiError } from '../api/client';

interface ErrorDisplayProps {
  error: string | ApiError | Error;
  onRetry?: () => void;
  onTryAnother?: () => void;
}

export function ErrorDisplay({ error, onRetry, onTryAnother }: ErrorDisplayProps) {
  let message: string;
  let showRetry = false;
  let showTryAnother = false;

  if (error instanceof ApiError) {
    // Map error codes to specific messages
    switch (error.code) {
      case 'SURVEY_NOT_FOUND':
        message = 'That survey no longer exists.';
        showTryAnother = true;
        break;
      case 'PARSE_FAILED':
        message = error.message; // Backend message is safe to show
        showTryAnother = true;
        break;
      case 'NOT_READY':
        message = 'Still parsing — this takes about a minute.';
        break;
      case 'PROCESSING_FAILED':
        message = error.message;
        showRetry = true;
        break;
      case 'FILE_TOO_LARGE':
        message = 'That file is over the 500 MB limit.';
        showTryAnother = true;
        break;
      default:
        message = error.message;
        showTryAnother = true; // Always offer recovery for unknown errors
        break;
    }
    // detail goes to console only, never screen
    console.error(`[ErrorDisplay] code=${error.code} detail=${error.detail}`);
  } else if (error instanceof Error) {
    message = error.message;
    showTryAnother = true;
  } else {
    message = error as string;
    showTryAnother = true;
  }

  return (
    <div className="error-display">
      <div className="error-message">{message}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {showRetry && onRetry && (
          <button className="btn-primary" onClick={onRetry}>
            Retry
          </button>
        )}
        {showTryAnother && onTryAnother && (
          <button className="btn-secondary" onClick={onTryAnother}>
            Try another file
          </button>
        )}
      </div>
    </div>
  );
}
