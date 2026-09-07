// WarningBanner — Persistent, non-dismissible warnings.
// Shows altitude_source notice and any warnings[] from the survey.

import { useSurveyStore } from '../stores/surveyStore';

export function WarningBanner() {
  const survey = useSurveyStore((s) => s.currentSurvey);
  if (!survey) return null;

  const notices: string[] = [];

  // Altitude source warning — critical honesty requirement
  if (survey.altitude_source === 'blank_zone_estimate') {
    notices.push(
      'Altitude estimated from water column — positions carry higher uncertainty.'
    );
  }

  // Survey-level warnings from the backend
  if (survey.warnings?.length) {
    notices.push(...survey.warnings);
  }

  if (notices.length === 0) return null;

  return (
    <div className="warning-banner">
      {notices.map((notice, i) => (
        <div key={i} style={{ marginBottom: i < notices.length - 1 ? 4 : 0 }}>
          ⚠ {notice}
        </div>
      ))}
    </div>
  );
}
