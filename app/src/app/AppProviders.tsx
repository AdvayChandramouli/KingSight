import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useState, type ReactNode } from 'react'
import { ClientContext, type ClientContextValue } from '@/services/context'

import { createQueryClient } from './queryClient'

type Props = { value: ClientContextValue; children: ReactNode; queryClient?: QueryClient }

export function AppProviders({ value, children, queryClient }: Props) {
  const [qc] = useState(() => queryClient ?? createQueryClient())
  return (
    <ClientContext.Provider value={value}>
      <QueryClientProvider client={qc}>
        <Tooltip.Provider delayDuration={250}>{children}</Tooltip.Provider>
      </QueryClientProvider>
    </ClientContext.Provider>
  )
}
