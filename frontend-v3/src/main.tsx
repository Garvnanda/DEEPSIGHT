import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom'

import './index.css'

import { AppShell } from '@/components/layout/AppShell'
import { ThemeProvider } from '@/lib/theme'
import { Detections } from '@/pages/Detections'
import { NotFound } from '@/pages/NotFound'
import { About } from '@/pages/About'
import { Onboarding } from '@/pages/Onboarding'
import { Reports } from '@/pages/Reports'
import { SurveyConsole } from '@/pages/SurveyConsole'
import { Surveys } from '@/pages/Surveys'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      // `/` is the walkthrough, every visit. Skip / Open the console lands on /surveys.
      { index: true, element: <Onboarding /> },
      { path: 'welcome', element: <Onboarding /> },
      { path: 'surveys', element: <Surveys /> },
      { path: 'console/:id', element: <SurveyConsole /> },
      { path: 'surveys/:id', element: <SurveyConsole /> },
      { path: 'detections', element: <Detections /> },
      { path: 'reports', element: <Reports /> },
      { path: 'about', element: <About /> },
      // old link, kept so anything already pointing at it still lands somewhere
      { path: 'settings', element: <Navigate to="/about" replace /> },
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
