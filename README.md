# CloudSent()

CloudSent is a calm, anonymous digital prayer wall built for the capstone SRS in this repository.

## Workspaces

- `apps/web` — Vite + React + Tailwind public wall and admin dashboard
- `apps/api` — Express REST API, PostgreSQL migrations, moderation and session security
- `packages/contracts` — shared TypeScript/Zod request and response contracts

## Local setup

1. Copy `apps/api/.env.example` to `apps/api/.env` and set a PostgreSQL `DATABASE_URL`.
2. Run `npm install`.
3. Run `npm run db:migrate`.
4. Run `npm run dev`.

The first public launch intentionally has no sample prayers. The empty wall is a supported state.

To preview the wall with realistic local content, run `npm run db:seed:demo` after migrations. The idempotent demo seed adds eight approved prayers across the launch taxonomy and is blocked when `NODE_ENV=production`.

## Deployment

The Render blueprint targets the Singapore free web service. Set `DATABASE_URL`, `JWT_SECRET`, `PIN_PEPPER`, and `PUBLIC_ORIGIN` as secrets in Render. Before connecting Vercel, replace the example Render hostname in the repository-root `vercel.json` with the API service’s actual hostname. Keep Vercel preview deployments pointed at a non-production API or disabled for writes.

Neon is the recommended PostgreSQL provider. Run the API with the included migration runner; the API acquires a PostgreSQL advisory lock and applies pending migrations before listening.

## Security notes

Never commit a PIN, PIN hash, JWT secret, database URL, or production cookie. Generate the administrator hash through the bootstrap script and rotate the PIN after initial setup.
