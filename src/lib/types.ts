// Shared types for the F1 Performance Intelligence Platform

export type SessionType = 'FP1' | 'FP2' | 'FP3' | 'Q' | 'RACE'
export type SessionStatus = 'scheduled' | 'live' | 'completed'

export interface Circuit {
  id: string
  name: string
  country: string
  trackLength: number
  corners: number
}

export interface SessionSummary {
  id: string
  round: number
  type: SessionType
  date: string
  status: SessionStatus
  airTemp: number | null
  trackTemp: number | null
  condition: string | null
  circuit: Circuit
  lapCount: number
  validLapCount: number
}

export interface Driver {
  id: string
  code: string
  name: string
  team: string
  number: number
  isRival: boolean
  nationality: string | null
}

export interface LapSummary {
  id: string
  lapNumber: number
  lapTimeMs: number
  sector1Ms: number | null
  sector2Ms: number | null
  sector3Ms: number | null
  tireCompound: string | null
  tireTempAvg: number | null
  fuelKg: number | null
  drsCount: number
  isValid: boolean
  isFastest: boolean
}

export interface SessionDetailDriver {
  driver: Driver
  laps: LapSummary[]
}

export interface ChannelDef {
  key: string
  label: string
  unit: string
  group: string
}

export interface TracePoint {
  distance: number
  value: number
}

export interface CompareResult {
  channel: ChannelDef & { minOk: number | null; maxOk: number | null }
  lapA: { id: string; lapNumber: number; lapTimeMs: number; driver: Driver; session: { type: string; round: number; circuit: string } }
  lapB: { id: string; lapNumber: number; lapTimeMs: number; driver: Driver }
  traceA: TracePoint[]
  traceB: TracePoint[]
  diff: { distance: number; delta: number; absDelta: number }[]
  zones: { distance: number; delta: number; absDelta: number }[]
}

// Live telemetry (from WebSocket)
export interface LiveDriverSnapshot {
  code: string
  name: string
  team: string
  number: number
  isRival: boolean
  lap: number
  sector: number
  tireCompound: string
  fuelKg: number
}
export interface LiveTick {
  code: string
  lap: number
  lapProgress: number
  sector: number
  channels: Record<string, number>
  ts: number
}
export interface PipelineState {
  primaryHealthy: boolean
  secondaryBufferArmed: boolean
  consumerLagMs: number
  sparkJobsRunning: number
  ingestRateHz: number
  dataLossGuarantee: boolean
  uptimePct: number
}

export type ViewKey =
  | 'overview'
  | 'telemetry'
  | 'builder'
  | 'analytics'
  | 'devops'
  | 'raceops'
  | 'pitbox'
  | 'strategy'
