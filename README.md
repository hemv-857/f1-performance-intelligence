# F1 Performance Intelligence Platform

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

> Unified multi-discipline engineering platform for the **Racing Bulls F1 team** — real-time telemetry ingestion, strategic analytics, low-code dashboards, DevOps, and AI-powered race engineering.

---

## Overview

Built for race engineers, strategists, and DevOps teams who need instant visibility into car performance, infrastructure health, and race-weekend operations. Simulates a production-grade data pipeline (Kafka → Spark → Snowflake) with live WebSocket telemetry streaming and an AI Race Engineer assistant powered by Groq.

## Features

### Telemetry & Analytics
- **Live Telemetry Viewer** — Real-time 10Hz multi-driver telemetry overlay with channel comparison and diff diagnosis
- **Delta-P Analysis** — Lap-by-lap delta vs rival drivers with sector heatmaps and trend visualization
- **Tire Degradation Curves** — Compound-specific degradation modeling with cliff detection
- **Fuel Trends** — Consumption tracking with fuel-corrected lap time normalization
- **Session Comparison** — Head-to-head driver/session analysis with engineer leaderboard

### Strategy & Race Ops
- **Pit-Stop Window Planner** — Optimal pit window Gantt chart with compound-specific strategies
- **Tire-Age Projection** — Cliff-lap prediction for soft/medium/hard compounds with live indicator
- **Undercut Simulator** — Interactive pit-lap optimizer with out-lap pace adjustment
- **Race Ops Dashboard** — Pipeline health monitoring, incident playbooks, synthetic race simulation

### AI Race Engineer
- **LLM-Powered Assistant** — Ask natural language questions about telemetry anomalies, setup changes, and race strategy
- **Live Context** — Automatically injects active alerts, session laps, delta-P, and channel diffs into prompts
- **Data-Driven Recommendations** — References specific corners, sectors, and channel values

### Low-Code Builder
- **Drag-and-Drop Dashboard Builder** — SQL templates onto a canvas with 5 visualization types
- **Parameterized SQL** — Session and driver selectors auto-fill query parameters

### DevOps & Operations
- **CI/CD Pipeline Visualization** — 7-stage pipeline with simulated canary progression
- **Canary Rollback** — One-click rollback with automated incident logging
- **Audit Log** — Full activity trail across playbooks, deploys, AI queries, and template runs

### Platform
- **Command Palette** — `⌘K` quick-access to any view, session, or action
- **PDF Report Generation** — Session-specific reports with driver comparison and recommendations
- **Mobile Pit-Box View** — Touch-optimized compact dashboard for iPad

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS 4, shadcn/ui |
| Database | Prisma + SQLite |
| Charts | Recharts |
| State | Zustand |
| Real-time | WebSocket via Caddy gateway |
| Animation | Framer Motion |
| AI | Groq API (qwen3.8-27b) |
| PDF | Python ReportLab |

---

## Getting Started

### Prerequisites
- [Bun](https://bun.sh) >= 1.2 or Node.js >= 20
- Python 3.10+ (for PDF generation)

### Setup

```bash
git clone https://github.com/hemv-857/f1-performance-intelligence.git
cd f1-performance-intelligence

bun install
bunx prisma generate
bunx prisma db push
bunx tsx prisma/seed.ts

bun run dev
```

Open **http://localhost:3000**.

### Environment Variables

Copy `.env.example` to `.env`:

```env
DATABASE_URL=file:./db/custom.db
AI_API_URL=https://api.groq.com/openai/v1/chat/completions
AI_API_KEY=your-groq-api-key
AI_MODEL=qwen/qwen3.8-27b
```

---

## Database Schema

| Model | Purpose |
|-------|---------|
| `Driver` | 10 drivers (6 Racing Bulls + 4 rivals) |
| `Circuit` | 8 circuits (Suzuka, Singapore, Austin, Monaco, Silverstone, Spa, Monza, Zandvoort) |
| `Channel` | 14 telemetry channels |
| `Session` | 40 sessions across 3 seasons |
| `Lap` | ~2000 laps with sector times, tire compound, fuel load |
| `TelemetrySample` | ~524k samples at 10Hz |
| `DeltaRecord` | ~7000 delta-P records vs rivals |
| `Deployment` | CI/CD deployment history |
| `Alert` | System alerts |
| `DashboardTemplate` | 6 low-code SQL templates |
| `IncidentRun` | Playbook execution history |
| `AuditLog` | Full activity audit trail |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes (21 endpoints)
│   └── layout.tsx          # Root layout
├── components/
│   ├── views/              # 8 main views
│   ├── ui/                 # shadcn/ui primitives
│   └── shared.tsx          # TrackMap, StatCard, SectionHeader
├── hooks/                  # Custom React hooks
└── lib/                    # Types, store, DB client, utils
prisma/
├── schema.prisma           # Database schema
└── seed.ts                 # Seed script
```

---

## License

MIT — see [LICENSE](LICENSE).
