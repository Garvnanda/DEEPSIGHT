// Header — Top bar: logo, filename, export button

import { useSurveyStore } from '../stores/surveyStore';

interface HeaderProps {
  onExport?: () => void;
}

export function Header({ onExport }: HeaderProps) {
  const survey = useSurveyStore((s) => s.currentSurvey);

  return (
    <header className="console-header">
      <span style={{ fontSize: 16, fontWeight: 600, color: '#4FB3C9' }}>
        Deep-Sight
      </span>
      {survey && (
        <span style={{ fontSize: 13, color: '#7E9AA3', flex: 1 }}>
          {survey.filename}
        </span>
      )}
      {survey && onExport && (
        <button className="btn-secondary" onClick={onExport}>
          Export report
        </button>
      )}
    </header>
  );
}
