import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import ErrorBoundary from './components/shared/ErrorBoundary'
import './index.css'
import { initMonitoring } from './lib/monitoring'
import { router } from './router'

initMonitoring()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </StrictMode>,
)
