# Everything Market

## Overview
**Everything Market** is a prediction market platform where users can trade on real-world events across multiple categories: political, economic, social, technology, finance, culture, and sports.

## Core Principles
1. **Determinism & Reproducibility** - All market events are reproducible from snapshots + logs
2. **Human-in-the-loop** - No automated creation of markets without signed admin approval
3. **Auditability** - Append-only audit logs for all state changes
4. **Provenance** - All external data tracked via content-addressed snapshots

## Architecture
- **Frontend**: Next.js (Vercel)
- **Backend**: Serverless functions (Vercel) + dedicated orderbook service
- **Reality Engine**: Data ingestion, LLM processing, event candidate generation
- **Orderbook**: Low-latency matching engine with WAL and snapshots
- **Playwright Runner**: Deterministic web scraping service

## Repository Structure
```
/docs/              Documentation and specifications
  /specs/           Technical specs (API contracts, schemas)
  /runbooks/        Operational procedures
/src/
  /backend/         Serverless API functions
  /frontend/        Next.js web application
  /orderbook/       Dedicated matching engine service
  /reality/         Reality engine workers
  /infra/           Shared infrastructure code
  /playwright-runner/ Web scraping service
/ops/               Operational scripts and configs
/.github/workflows/ CI/CD pipelines
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
