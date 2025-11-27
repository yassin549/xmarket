# Next.js Setup Guide

## Quick Setup (5 minutes)

Run these commands to initialize Next.js in the frontend directory:

```bash
cd src/frontend

# Initialize Next.js with App Router
npx create-next-app@latest . --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*"

# When prompted, choose:
# ✔ Would you like to use Turbopack? … No
# ✔ Would you like to customize the import alias (@/* by default)? … No

# Install additional dependencies
npm install pg @upstash/redis @pinecone-database/pinecone @vercel/blob
npm install -D @types/pg

# Create .env.local from template
copy ..\..\env.example .env.local
```

## Project Structure After Setup

```
src/frontend/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page
│   ├── globals.css         # Global styles
│   └── api/                # API routes (we'll create these)
│       ├── health/
│       └── jobs/
├── public/                 # Static assets
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
└── .env.local             # Environment variables
```

## Update tsconfig.json

After initialization, update `src/frontend/tsconfig.json` to add path alias for infra:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@/infra/*": ["../../infra/*"]
    }
  }
}
```

## Test the Setup

```bash
# Start dev server
npm run dev

# Visit http://localhost:3000
# You should see the Next.js welcome page
```

## Next Steps

After Next.js is running:
1. Create `/api/health` endpoint
2. Create `/api/jobs` endpoint
3. Test database connectivity

---

**Note**: The actual API route files will be created automatically in the next step. This guide is for the initial Next.js setup only.
