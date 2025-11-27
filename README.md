# Everything Market

## Overview
**Everything Market** is a prediction market platform where users can trade on real-world events across multiple categories: political, economic, social, technology, finance, culture, and sports.

## Core Principles
1. **Determinism & Reproducibility** - All market events are reproducible from snapshots + logs
2. **Human-in-the-loop** - No automated creation of markets without signed admin approval
3. **Auditability** - Append-only audit logs for all state changes
4. **Provenance** - All external data tracked via content-addressed snapshots

## Architecture
- **Frontend**: Next.js (Render Web Service)
- **Orderbook**: Express + matching engine with WAL (Render Docker Service with persistent disk)
- **Backend**: Serverless API functions (Render Web Service)
- **Reality Engine**: Data ingestion and LLM processing (Render Background Worker)
- **Playwright Runner**: Deterministic web scraping service
- **Database**: PostgreSQL (Render Managed Database)

All services deployed on Render with automatic HTTPS, service discovery, and persistent storage for orderbook WAL.

## Repository Structure
```
/docs/              Documentation and specifications
  /specs/           Technical specs (API contracts, schemas)
  /runbooks/        Operational procedures
/src/
  /backend/         Backend API and realtime services
  /frontend/        Next.js web application
  /orderbook/       Dedicated matching engine service (Docker)
  /reality/         Reality engine workers
  /infra/           Shared infrastructure code
  /playwright-runner/ Web scraping service
/ops/               Operational scripts and configs
/.github/workflows/ CI/CD pipelines
render.yaml         Render deployment blueprint
```

## Getting Started
**Status**: Phase 0 - Repository Scaffold

This repository is currently in the initial setup phase. Implementation will proceed according to `checklist.txt`.

## Documentation
- **Master Plan**: `plan.txt`
- **Implementation Checklist**: `checklist.txt`
- **Agent Rules**: `docs/antigravity-rules.md`
- **Decisions Log**: `docs/decisions.md`

## Safety & Governance
This project follows strict safety guidelines:
- Agents may propose code but cannot merge or deploy
- All PRs require human approval
- Market creation requires signed admin decisions
- No seeding of fake market data permitted

## License
TBD
