'use client'

import dynamic from 'next/dynamic'

// Render the app shell client-side (uses live WebSocket telemetry).
const AppShell = dynamic(() => import('@/components/app-shell').then((m) => m.AppShell), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <div className="h-12 w-12 rounded-full border-2 border-red-500/40 border-t-red-500 animate-spin" />
      <p className="text-sm text-muted-foreground font-mono-nums">Booting Apex Racing telemetry platform…</p>
    </div>
  ),
})

export default function Home() {
  return <AppShell />
}
