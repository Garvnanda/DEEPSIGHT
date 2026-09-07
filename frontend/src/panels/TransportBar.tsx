// TransportBar  Play/pause/seek/speed controls + raw/corrected toggle.
// Bottom bar of the console layout.

import { usePlaybackStore } from '../stores/playbackStore';
import { useSurveyStore } from '../stores/surveyStore';

const SPEEDS = [1, 2, 4, 8];

export function TransportBar() {
  const survey = useSurveyStore((s) => s.currentSurvey);
  const state = usePlaybackStore((s) => s.state);
  const currentPing = usePlaybackStore((s) => s.currentPing);
  const totalPings = survey?.ping_count ?? 0;
  const speed = usePlaybackStore((s) => s.speed);
  const correctedView = usePlaybackStore((s) => s.correctedView);
  const startPlayback = usePlaybackStore((s) => s.startPlayback);
  const pause = usePlaybackStore((s) => s.pause);
  const resume = usePlaybackStore((s) => s.resume);
  const seek = usePlaybackStore((s) => s.seek);
  const setSpeed = usePlaybackStore((s) => s.setSpeed);
  const toggleCorrected = usePlaybackStore((s) => s.toggleCorrected);

  if (!survey) return <div className="console-transport" />;

  const handlePlayPause = () => {
    if (state === 'idle' || state === 'complete') {
      startPlayback(survey.survey_id);
    } else if (state === 'playing') {
      pause();
    } else if (state === 'paused') {
      resume();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseInt(e.target.value, 10));
  };

  const isPlaying = state === 'playing';
  const canPlay = state !== 'error';

  return (
    <div className="console-transport">
      {/* Play/Pause button */}
      <button
        className="transport-play-btn"
        onClick={handlePlayPause}
        disabled={!canPlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      {/* Timeline slider */}
      <input
        type="range"
        className="transport-timeline"
        min={0}
        max={totalPings}
        value={currentPing}
        onChange={handleSeek}
        aria-label="Playback timeline"
      />

      {/* Ping counter */}
      <span className="transport-ping-counter">
        {currentPing.toLocaleString()} / {totalPings.toLocaleString()}
      </span>

      {/* Speed selector */}
      {SPEEDS.map((s) => (
        <button
          key={s}
          className={`transport-speed-btn ${speed === s ? 'active' : ''}`}
          onClick={() => setSpeed(s)}
        >
          {s}×
        </button>
      ))}

      {/* Raw / Corrected toggle */}
      <div className="transport-toggle">
        <button
          className={!correctedView ? 'active' : ''}
          onClick={() => correctedView && toggleCorrected()}
        >
          raw
        </button>
        <button
          className={correctedView ? 'active' : ''}
          onClick={() => !correctedView && toggleCorrected()}
        >
          geo
        </button>
      </div>
    </div>
  );
}
