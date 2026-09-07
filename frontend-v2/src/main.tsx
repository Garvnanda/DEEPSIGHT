import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'

import './index.css'

import { AppShell } from '@/components/layout/AppShell'
import { ThemeProvider } from '@/lib/theme'
import { Dashboard } from '@/pages/Dashboard'
import { Detections } from '@/pages/Detections'
import { NotFound } from '@/pages/NotFound'
import { Reports } from '@/pages/Reports'
import { Settings } from '@/pages/Settings'
import { SurveyConsole } from '@/pages/SurveyConsole'
import { Surveys } from '@/pages/Surveys'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'surveys', element: <Surveys /> },
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
