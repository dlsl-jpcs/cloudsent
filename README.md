# CloudSent()

CloudSent is a digital prayer wall. One Vercel project hosts the React website and its API; Supabase stores the records.

Requests follow this path: **website → Vercel API → Supabase**. The API connects over HTTPS using `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. It uses the Supabase JavaScript client on the server because CloudSent manages its own PIN login. No PostgreSQL connection string is needed. The server key stays in the API and is never included in the browser bundle.

## Database setup

1. In Supabase, open **SQL Editor** and run the entire repository file `supabase/setup.sql`.
2. This creates all tables and the functions used by the API. It also works with the earlier CloudSent tables, keeping existing prayers and admin PIN hashes. It grants the server role access while blocking direct browser access to CloudSent tables and functions.
3. Keep the **public** schema enabled in Supabase's Data API settings (the default). CloudSent's API uses that service to reach the tables.

The setup is safe to run again. Run it manually when the database setup changes; it does not run during website builds or incoming requests. `npm run db:setup` (and the older `db:migrate` alias) prints these instructions and does not claim to execute the SQL.

## Local development

1. Run `npm install` from the repository root.
2. Copy `apps/api/.env.example` to `apps/api/.env` if you do not already have an environment file. Enter:

   ```dotenv
   NODE_ENV=development
   PORT=4000
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_your-secret-key
   JWT_SECRET=your-existing-long-random-secret
   PIN_PEPPER=your-existing-long-random-secret
   PUBLIC_ORIGIN=http://localhost:5173
   ```

   Get the first two Supabase values from **Connect → Server** or **Settings → API Keys**. CloudSent does not need the publishable key or JWKS URL because it uses its own admin PIN, rather than Supabase user accounts. Keep the existing `JWT_SECRET` and `PIN_PEPPER`; changing the pepper invalidates PIN hashes created with the old value. Older `DATABASE_URL`, `SUPABASE_DB_URL` and `API_PUBLIC_ORIGIN` values are no longer read and can be removed.

3. Run `npm run db:check` to confirm the connection and database setup.
4. If this is a new database, run `npm run admin:bootstrap` and choose an 8–12 digit PIN. That command sets or replaces the PIN in the **configured Supabase project**, so use it only when setting up or resetting the administrator.
5. Optionally run `npm run db:seed:demo` to add eight approved sample prayers. It skips samples already present and is disabled with `NODE_ENV=production`.
6. Run `npm run dev`. Open `http://localhost:5173`; the local website forwards `/api` requests to the local API on port 4000.

## Deploy everything to Vercel

1. Import this Git repository into **one Vercel project**. Keep the **Root Directory at the repository root**, not `apps/web` or `apps/api`.
2. The repository's `vercel.json` sets the build to `npm run build`, the website output to `apps/web/dist`, and API requests to `api/index.js`. Choose Node.js **24.x** in Vercel's project settings. No Render project is used.
3. Add these values under Vercel **Settings → Environment Variables**:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | Your Supabase project URL |
   | `SUPABASE_SECRET_KEY` | Your Supabase secret key (`sb_secret_...`) |
   | `JWT_SECRET` | The same value used locally |
   | `PIN_PEPPER` | The same value used when you set the admin PIN |
   | `PUBLIC_ORIGIN` | Your website URL, such as `https://cloudsent.vercel.app` |
   | `NODE_ENV` | `production` |

   Enter secrets as server environment variables, without a `VITE_` prefix. An `.env` file on your computer is not uploaded to Vercel. For preview deployments, use a separate Supabase project if you want to keep test changes separate from your real records.

4. Complete the Supabase SQL setup and admin bootstrap before using the deployed site, then deploy in Vercel. Open `/api/health` to check the connection, `/wall` for the public wall, and `/admin` for PIN login.

The dashboard refreshes every 30 seconds while visible and when returning to the tab. Actions and the Refresh button update it immediately. This replaces the old connection that needed an always-running server.

## Verification

`npm run build`, `npm run typecheck`, `npm run lint`, and `npm test` check the application. API tests use a disposable local PostgreSQL engine and mocked Supabase HTTP responses; they do not modify your Supabase project. `npm run db:check` is the separate live connection check after entering your credentials.

## Workspaces

- `apps/web` — React website, prayer wall and admin dashboard
- `apps/api` — shared API application, Supabase access and local administration scripts
- `api/index.js` — Vercel function entry point
- `supabase/setup.sql` — complete, repeatable database setup
- `packages/contracts` — shared request validation and response types
