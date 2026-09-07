// StatsBar  Displays stats.headline verbatim.
// The backend pre-formats the headline so the number on screen
// and the number in the report can never disagree.

import { useEffect, useState } from 'react';
import * as api from '../api/client';
import { usePlaybackStore } from '../stores/playbackStore';
import { useSurveyStore } from '../stores/surveyStore';
import type { SurveyStats } from '../types/api';

export function StatsBar() {
  const survey = useSurveyStore((s) => s.currentSurvey);
  const playbackState = usePlaybackStore((s) => s.state);
  const [stats, setStats] = useState<SurveyStats | null>(null);

  useEffect(() => {
    if (!survey || playbackState !== 'complete') {
      setStats(null);
      return;
    }
    api.getStats(survey.survey_id).then(setStats).catch(console.error);
  }, [survey, playbackState]);

  if (!stats) return null;

  return (
    <div className="stats-headline">
      {/* Render verbatim  do not reformat */}
      {stats.headline}
    </div>
  );
}
