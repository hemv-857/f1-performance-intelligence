'use client'

import { create } from 'zustand'
import type { ViewKey, SessionSummary } from './types'

export interface AnomalyAlert {
  id: string
  channel: string
  driverCode: string
  value: number
  range: { min: number; max: number }
  message: string
  ts: number
  acknowledged: boolean
}

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
  // anomaly alerts (cross-component: telemetry viewer writes, AI panel reads)
  anomalies: AnomalyAlert[]
  pushAnomaly: (a: Omit<AnomalyAlert, 'id' | 'ts' | 'acknowledged'>) => void
  acknowledgeAnomaly: (id: string) => void
  clearAnomalies: () => void
  // AI engineer panel open state (shared so other components can open it)
  aiPanelOpen: boolean
  setAiPanelOpen: (v: boolean) => void
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
  anomalies: [],
  pushAnomaly: (a) =>
    set((s) => {
      // dedupe: don't re-add the same channel+driver anomaly if it's already in the list and unacknowledged
      const exists = s.anomalies.some(
        (x) => x.channel === a.channel && x.driverCode === a.driverCode && !x.acknowledged
      )
      if (exists) return s
      const id = `${a.channel}-${a.driverCode}-${Date.now()}`
      const newAlert: AnomalyAlert = { ...a, id, ts: Date.now(), acknowledged: false }
      return { anomalies: [newAlert, ...s.anomalies].slice(0, 20) }
    }),
  acknowledgeAnomaly: (id) =>
    set((s) => ({
      anomalies: s.anomalies.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    })),
  clearAnomalies: () => set({ anomalies: [] }),
  aiPanelOpen: false,
  setAiPanelOpen: (v) => set({ aiPanelOpen: v }),
}))

