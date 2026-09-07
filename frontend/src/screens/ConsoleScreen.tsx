// ConsoleScreen — The main 3-zone survey console layout.
// Waterfall dominant centre, worklist left, map+detail right.

import { useState } from 'react';
import { Header } from '../components/Header';
import { WarningBanner } from '../components/WarningBanner';
import { WaterfallCanvas } from '../waterfall/WaterfallCanvas';
import { SurveyMap } from '../map/SurveyMap';
import { Worklist } from '../panels/Worklist';
import { DetailPanel } from '../panels/DetailPanel';
import { StatsBar } from '../panels/StatsBar';
import { TransportBar } from '../panels/TransportBar';
import { ReportModal } from './ReportModal';
import { useSurveyStore } from '../stores/surveyStore';
import { usePlaybackStore } from '../stores/playbackStore';

export function ConsoleScreen() {
  const survey = useSurveyStore((s: { currentSurvey: any }) => s.currentSurvey);
  const currentPing = usePlaybackStore((s: { currentPing: number }) => s.currentPing);
  const [showReport, setShowReport] = useState(false);

  if (!survey) return null;

  return (
    <>
      <div className="console-layout">
        {/* Header */}
        <Header onExport={() => setShowReport(true)} />

        {/* Warning banner (if applicable) — spans all columns */}
        {/* Note: the banner renders conditionally inside itself */}

        {/* Left: Worklist */}
        <div className="console-worklist">
          <StatsBar />
          <Worklist />
        </div>

        {/* Centre: Waterfall */}
        <div className="console-waterfall">
          <WarningBanner />
          <WaterfallCanvas rangeM={survey.range_m} />
          {/* Ping counter overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              fontFamily: 'var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
              fontSize: 11,
              color: '#7E9AA3',
              pointerEvents: 'none',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            }}
          >
            ping {currentPing.toLocaleString()}
          </div>
        </div>

        {/* Right: Map + Detail */}
        <div className="console-right">
          <div className="console-right-map">
            <SurveyMap />
          </div>
          <div className="console-right-detail">
            <DetailPanel />
          </div>
        </div>

        {/* Bottom: Transport */}
        <TransportBar />
      </div>

      {/* Report modal overlay */}
      {showReport && (
        <ReportModal
          surveyId={survey.survey_id}
          onClose={() => setShowReport(false)}
        />
      )}
    </>
  );
}
