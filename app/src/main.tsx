import '@fontsource-variable/fraunces'
import '@fontsource-variable/inter'
import './styles/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppProviders } from './app/AppProviders'
import { config } from './app/config'
import { createClient } from './app/createClient'
import { routes } from './app/routes'

const clientValue = createClient(config, window.location.search)
const router = createBrowserRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders value={clientValue}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
