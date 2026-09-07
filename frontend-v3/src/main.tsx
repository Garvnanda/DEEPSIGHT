import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom'

import './index.css'

import { AppShell } from '@/components/layout/AppShell'
import { ThemeProvider } from '@/lib/theme'
import { Detections } from '@/pages/Detections'
import { NotFound } from '@/pages/NotFound'
import { Onboarding, ONBOARDED_KEY } from '@/pages/Onboarding'
import { Reports } from '@/pages/Reports'
import { Settings } from '@/pages/Settings'
import { SurveyConsole } from '@/pages/SurveyConsole'
import { Surveys } from '@/pages/Surveys'

function Home() {
  let done = false
  try {
    done = localStorage.getItem(ONBOARDED_KEY) === '1'
  } catch {
    /* private mode */
  }
  return done ? <Navigate to="/surveys" replace /> : <Onboarding />
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'welcome', element: <Onboarding /> },
      { path: 'surveys', element: <Surveys /> },
      { path: 'console/:id', element: <SurveyConsole /> },
      { path: 'surveys/:id', element: <SurveyConsole /> },
      { path: 'detections', element: <Detections /> },
      { path: 'reports', element: <Reports /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
)
