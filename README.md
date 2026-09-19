# F1 Performance Intelligence Platform

A unified, multi-discipline engineering platform for the Racing Bulls F1 team. Built with Next.js 16, TypeScript, Prisma, and Tailwind CSS.

## Features

- **Overview Dashboard** — Live KPIs, timing leaderboard, pipeline health, infrastructure status
- **Telemetry Viewer** — Real-time 10Hz multi-driver telemetry overlay with channel comparison and diff diagnosis
- **Analytics** — Delta-P analysis, tire degradation curves, fuel trends, qualifying replay, session comparison
- **Low-Code Builder** — Drag-and-drop SQL template dashboard with 5 visualization types (line, bar, heatmap, 3D track, gauge)
- **DevOps** — CI/CD pipeline visualization, canary rollout tracking, deployment history with promote/rollback, YAML artifacts
- **Race Ops** — Pipeline monitoring, incident playbooks, pre-race health checks, synthetic race simulation
- **Pit-Box** — Touch-first compact strategist view for iPad/mobile with live tire temps and quick playbooks
- **Strategy** — Pit-stop window planner, tire-age projections, undercut simulator, stint comparison

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Database:** Prisma + SQLite
- **Charts:** Recharts
- **State:** Zustand + TanStack React Query
- **Real-time:** WebSocket (via Caddy gateway on port 81)
- **Animation:** Framer Motion
- **PDF:** Python ReportLab

## Getting Started

```bash
# Install dependencies
bun install

# Set up database
bunx prisma generate
bunx prisma db push
bun run prisma/seed.ts

# Start dev server (port 3000) + WebSocket service (port 3003)
bun run dev
```

The Caddy gateway serves on port 81, proxying Next.js (3000) and WebSocket (3003).

## Project Structure

```
src/
  app/              # Next.js App Router routes + API endpoints
  components/       # React components
    views/          # 8 main views (overview, analytics, devops, etc.)
    ui/             # shadcn/ui primitives
    shared.tsx      # TrackMap, StatCard, SectionHeader, StatusBadge
  hooks/            # Custom React hooks
  lib/              # Utilities, types, store, DB client
prisma/
  schema.prisma     # Database schema
  seed.ts           # Seed script (8 circuits, 10 drivers, ~2000 laps)
scripts/
  gen_report.py     # PDF report generator
```
