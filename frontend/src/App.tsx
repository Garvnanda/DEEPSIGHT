// App  Root component. Routes between Upload and Console screens.
// No react-router  just state-driven: if we have a loaded survey, show console.

import { ConsoleScreen } from './screens/ConsoleScreen';
import { UploadScreen } from './screens/UploadScreen';
import { useSurveyStore } from './stores/surveyStore';

function App() {
  const currentSurvey = useSurveyStore((s) => s.currentSurvey);

  // If a survey is loaded and ready, show the console. Otherwise, upload screen.
  if (currentSurvey && (currentSurvey.status === 'ready' || currentSurvey.status === 'complete')) {
    return <ConsoleScreen />;
  }

  return <UploadScreen />;
}

export default App;
