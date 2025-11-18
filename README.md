# Xmarket Monorepo (Phase 1)

Trade Everything — Xmarket is a perpetual sentiment exchange where price reflects collective belief.

## Tech Stack (Phase 1)

- Monorepo with pnpm + Turborepo
- apps/web: Next.js 14 (App Router), Tailwind CSS, shadcn/ui-ready, Radix primitives
- services/api: Fastify + TypeScript
- Shared packages: `packages/types`, `packages/config` (future)
- Postgres (Prisma), Redis (planned in later prompts)

## Getting Started (Local)

1. Install Node 20 (see `.nvmrc`).
2. Install pnpm globally (or use corepack):
   - `npm install -g pnpm` or `corepack enable`.
3. Install dependencies:
   - `pnpm install`
4. Create a `.env` file from `.env.example` and adjust values as needed.
5. Start dev servers:
   - `pnpm dev` (runs web + api concurrently via Turborepo).

### Useful Scripts

- `pnpm dev` — run all dev servers.
- `pnpm lint` — run ESLint across the repo.
- `pnpm test` — run Jest tests.
- `pnpm typecheck` — TypeScript type checking.
- `pnpm build` — production builds for all apps.
- `pnpm bootstrap` — one-time local setup helper.

## Railway Deployment (High Level)

> Detailed deployment steps will be expanded in Phase 1 Prompt 10.

- Create a new Railway project.
- Add services for `apps/web` and `services/api` using their Dockerfiles.
- Configure environment variables from `.env.example`.
- Connect GitHub repo and enable automatic deployments.

## Repository Layout

- `apps/web` — frontend Next.js application.
- `services/api` — Fastify-based API service.
- `packages/types` — shared TypeScript types.
- `packages/config` — shared config (to be added).

## Notes

- This repo is optimized for Cursor/VSCode usage.
- Later prompts will introduce Prisma, AMM engine, real-time infra, and custodial wallet logic.
