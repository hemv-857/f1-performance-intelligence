# F1 Performance Intelligence Platform

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)
![License](https://img.shields.io/badge/License-Private-red)

> A unified, multi-discipline engineering platform for the **Racing Bulls F1 team** — real-time telemetry ingestion, strategic analytics, low-code dashboarding, and race-day operations in a single interface.

---

## Overview

Built for race engineers, strategists, and DevOps teams who need instant visibility into car performance, infrastructure health, and race-weekend operations. The platform simulates a production-grade data pipeline (Kafka → Spark → Snowflake) with live WebSocket telemetry streaming, enabling sub-second analysis across 8 integrated views.

## Key Features

### Telemetry & Analytics
- **Live Telemetry Viewer** — Real-time 10Hz multi-driver telemetry overlay with channel comparison, diff diagnosis, and problem-zone highlighting
- **Delta-P Analysis** — Lap-by-lap delta vs rival drivers with sector heatmaps and trend visualization
- **Tire Degradation Curves** — Compound-specific degradation modeling with cliff detection and temperature correlation
- **Fuel Trends** — Consumption tracking with fuel-corrected lap time normalization
- **Session Comparison** — Head-to-head driver/session analysis with engineer leaderboard

### Strategy & Race Ops
- **Pit-Stop Window Planner** — Optimal pit window Gantt chart with compound-specific strategies and risk ratings
- **Tire-Age Projection** — Cliff-lap prediction for soft/medium/hard compounds with live "NOW" indicator
- **Undercut Simulator** — Interactive pit-lap optimizer with out-lap pace adjustment and real-time gain calculation
- **Race Ops Dashboard** — Pipeline health monitoring, incident playbooks with automated execution, pre-race health checks, and synthetic race simulation

### Low-Code Builder
- **Drag-and-Drop Dashboard Builder** — Palette of SQL templates onto a canvas, with 5 visualization types:
  - Line charts, bar charts, heatmaps, 3D track overlays, and gauge widgets
- **Parameterized SQL** — Session and driver selectors auto-fill query parameters
- **Execution Metrics** — Query latency, row counts, and executed SQL inspection per widget

### DevOps & Operations
- **CI/CD Pipeline Visualization** — 7-stage pipeline with simulated canary progression (10% → 50% → 100%)
- **Canary Rollback** — One-click rollback with automated incident logging
- **Pipeline Artifacts** — View and download K8s manifests, GitHub Actions workflows, and dbt models
- **Audit Log** — Full activity trail across playbooks, deploys, AI queries, and template runs

### Platform
- **Onboarding Tour** — Step-by-step guided walkthrough for new users
- **Command Palette** — `⌘K` quick-access to any view, session, or action
- **PDF Report Generation** — Session-specific reports with driver comparison, problem zones, and engineering recommendations
- **Mobile Pit-Box View** — Touch-optimized compact dashboard for iPad with large targets and live sparklines

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Caddy Gateway (:81)                 │
├──────────────────────┬──────────────────────────────┤
│   Next.js App (:3000)│   WebSocket Service (:3003)  │
│   ┌──────────────┐   │   ┌────────────────────┐    │
│   │  8 Views      │   │   │  10Hz Telemetry    │    │
│   │  API Routes   │   │   │  Pipeline Status    │    │
│   │  Prisma ORM   │   │   │  Playbook Exec      │    │
│   └──────┬───────┘   │   └────────┬───────────┘    │
│          │           │            │                  │
│   ┌──────▼───────┐   │            │                  │
│   │ SQLite + Seed │◄──┴────────────┘                  │
│   └──────────────┘                                   │
└─────────────────────────────────────────────────────┘
```

**Data Flow:** WebSocket service streams live telemetry → Next.js API routes query Prisma/SQLite → React views render via TanStack Query + Recharts → PDF export via Python ReportLab.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4, shadcn/ui |
| Database | Prisma + SQLite |
| Charts | Recharts |
| State | Zustand, TanStack React Query |
| Real-time | WebSocket via Caddy gateway |
| Animation | Framer Motion |
| PDF | Python ReportLab |
| DnD | @dnd-kit |
| Forms | React Hook Form + Zod |

---

## Getting Started

### Prerequisites
- [Bun](https://bun.sh) (recommended) or Node.js 18+
- Python 3.10+ (for PDF generation)

### Setup

```bash
# Clone the repository
git clone https://github.com/hemv-857/f1-performance-intelligence.git
cd f1-performance-intelligence

# Install dependencies
bun install

# Generate Prisma client and push schema
bunx prisma generate
bunx prisma db push

# Seed the database (8 circuits, 10 drivers, ~2000 laps)
bun run prisma/seed.ts

# Start the dev server (port 3000) + WebSocket service (port 3003)
bun run dev
```

Open **http://localhost:81** (Caddy gateway) for full WebSocket support, or **http://localhost:3000** for Next.js only.

---

## Database Schema

The platform uses 10 Prisma models covering the full F1 data domain:

| Model | Purpose |
|-------|---------|
| `Driver` | 10 drivers (6 Racing Bulls + 4 rivals) |
| `Circuit` | 8 circuits (Suzuka, Singapore, Austin, Monaco, Silverstone, Spa, Monza, Zandvoort) |
| `Channel` | 14 telemetry channels (speed, throttle, brake, tire temps, etc.) |
| `Session` | 40 sessions across 3 seasons (FP1/FP2/FP3/Q/Race) |
| `Lap` | ~2000 laps with sector times, tire compound, fuel load |
| `TelemetrySample` | ~524k samples at 10Hz with distance and timestamp |
| `DeltaRecord` | ~7000 delta-P records vs rival drivers |
| `Deployment` | CI/CD deployment history with canary tracking |
| `Alert` | System alerts (telemetry, Spark, Kafka, K8s, Snowflake) |
| `DashboardTemplate` | 6 low-code SQL templates with chart configurations |
| `IncidentRun` | Playbook execution history with step-by-step results |
| `AuditLog` | Full activity audit trail |

---

## Project Structure

```
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes (sessions, analytics, devops, etc.)
│   │   ├── globals.css         # Global styles + animations
│   │   └── layout.tsx          # Root layout with providers
│   ├── components/
│   │   ├── views/              # 8 main views
│   │   │   ├── overview.tsx    # Dashboard overview
│   │   │   ├── telemetry-viewer.tsx
│   │   │   ├── analytics.tsx   # Delta-P, tire deg, fuel trends
│   │   │   ├── builder.tsx     # Low-code dashboard builder
│   │   │   ├── devops.tsx      # CI/CD, canary, rollback
│   │   │   ├── race-ops.tsx    # Pipeline health, playbooks
│   │   │   ├── pitbox.tsx      # Mobile strategist view
│   │   │   └── strategy.tsx    # Pit windows, undercut sim
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── shared.tsx          # TrackMap, StatCard, SectionHeader
│   │   ├── app-shell.tsx       # Navigation + layout
│   │   └── ...                 # Drawers, modals, panels
│   ├── hooks/                  # Custom React hooks
│   └── lib/                    # Types, store, DB client, utils
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── seed.ts                 # Seed script
├── scripts/
│   └── gen_report.py           # PDF report generator
├── mini-services/              # WebSocket telemetry service
├── Caddyfile                   # Gateway configuration
└── public/                     # Static assets
```

---

## Screenshots

| Overview | Telemetry Viewer | Analytics |
|----------|-----------------|-----------|
| ![Overview](screenshot-overview.png) | ![Telemetry](screenshot-telemetry.png) | ![Analytics](screenshot-analytics.png) |

| Strategy | DevOps | Builder |
|----------|--------|---------|
| ![Strategy](screenshot-strategy.png) | ![DevOps](screenshot-devops.png) | ![Builder](screenshot-builder.png) |

---

## Environment Variables

```env
DATABASE_URL=file:./db/custom.db
```

---

## License

Private — Racing Bulls F1 Team Internal Use Only.

---

<div align="built with passion for speed">
  <sub>Built for the Racing Bulls engineering team. Every millisecond counts.</sub>
</div>
