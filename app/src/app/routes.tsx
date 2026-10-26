import type { RouteObject } from 'react-router'
import { RootLayout } from './RootLayout'

/** Explorer (and with it the map engine) is lazy so the landing page never initializes WebGL. */
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import('@/pages/LandingPage')).LandingPage }),
      },
      {
        path: 'explore',
        lazy: async () => ({ Component: (await import('@/pages/ExplorerPage')).ExplorerPage }),
      },
      {
        path: '*',
        lazy: async () => ({ Component: (await import('@/pages/NotFoundPage')).NotFoundPage }),
      },
    ],
  },
]
