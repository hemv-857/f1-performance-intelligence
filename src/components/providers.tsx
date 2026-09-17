'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

  // Ensure dark mode is applied (html already has .dark, this is a safety net)
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
