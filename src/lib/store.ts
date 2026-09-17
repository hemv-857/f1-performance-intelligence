'use client'

import { create } from 'zustand'
import type { ViewKey, SessionSummary } from './types'

interface AppState {
  activeView: ViewKey
  setActiveView: (v: ViewKey) => void
  // global selections
  selectedSessionId: string | null
  setSelectedSessionId: (id: string | null) => void
  sessions: SessionSummary[]
  setSessions: (s: SessionSummary[]) => void
  // live telemetry filters
  liveDrivers: string[] // driver codes
  toggleLiveDriver: (code: string) => void
  setLiveDrivers: (codes: string[]) => void
  // sidebar collapse (mobile)
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeView: 'overview',
  setActiveView: (v) => set({ activeView: v }),
  selectedSessionId: null,
  setSelectedSessionId: (id) => set({ selectedSessionId: id }),
  sessions: [],
  setSessions: (s) => set({ sessions: s }),
  liveDrivers: ['TSU', 'LAW', 'VER'],
  toggleLiveDriver: (code) =>
    set((s) => ({
      liveDrivers: s.liveDrivers.includes(code)
        ? s.liveDrivers.filter((c) => c !== code)
        : [...s.liveDrivers, code],
    })),
  setLiveDrivers: (codes) => set({ liveDrivers: codes }),
  sidebarOpen: false,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
}))
