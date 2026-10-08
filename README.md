# CloudSent()

CloudSent is a digital prayer wall. One Vercel project hosts the React website and its API; Supabase stores the records.

Requests follow this path: **website → Vercel API → Supabase**. The API connects over HTTPS using `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. It uses the Supabase JavaScript client on the server because CloudSent manages its own administrator username/password login. No PostgreSQL connection string is needed. The server key stays in the API and is never included in the browser bundle.

## Database setup

1. In Supabase, open **SQL Editor** and run the entire repository file `supabase/setup.sql`.
2. This creates all tables and the functions used by the API. It also works with earlier CloudSent tables, keeping prayers, administrator IDs, and review history. The password-login upgrade invalidates old sessions; old PIN hashes are retired and cannot be used to sign in. It grants the server role access while blocking direct browser access to CloudSent tables and functions.
3. Keep the **public** schema enabled in Supabase's Data API settings (the default). CloudSent's API uses that service to reach the tables.

The setup is safe to run again. Run it manually when the database setup changes; it does not run during website builds or incoming requests. `npm run db:setup` (and the older `db:migrate` alias) prints these instructions and does not claim to execute the SQL.

## Administrator access

The public navigation has no Admin link. Open `/secretlang` manually to sign in; the dashboard and settings are under `/secretlang/dashboard` and `/secretlang/tools`. Old `/admin` website routes show the not-found page. The private pages are not linked from public pages or the footer.

For an **existing Supabase database**, run `supabase/migrations/004_admin_password_login.sql` in SQL Editor, then run `npm run admin:bootstrap` locally. For a new database, use `supabase/setup.sql` instead. The scripts do not install a default account. Do not place actual passwords in this repository or save them in SQL queries.

This is a fixed, manually provisioned database account, not Supabase Auth. The API still checks every admin request, enforces failed-login delays and IP limits, uses an HTTP-only cookie (Secure on Vercel), and requires a CSRF token for admin changes. The API's `/api/admin/...` paths remain private through authentication, not through URL secrecy. Hiding the website link is only a convenience: someone can still discover the route by inspecting the website bundle. Knowing the URL does not grant access.

To reset the account, run `npm run admin:bootstrap` again. No username or password belongs in `.env`; keep its existing server secrets. The setup command writes to whichever Supabase project your local environment names, so check the project before confirming.

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

   Get the first two Supabase values from **Connect → Server** or **Settings → API Keys**. CloudSent does not need the publishable key or JWKS URL because it uses its own admin login, rather than Supabase user accounts. Keep the existing `JWT_SECRET` and `PIN_PEPPER`. Despite its legacy name, `PIN_PEPPER` is now used only for signed device cookies and private abuse-rate keys—not administrator passwords. Older `DATABASE_URL`, `SUPABASE_DB_URL` and `API_PUBLIC_ORIGIN` values are no longer read and can be removed.

3. Run `npm run db:check` to confirm the connection and database setup.
4. Run `npm run admin:bootstrap` in your terminal. Choose a username and a password/passphrase with at least 15 characters (at most 72 UTF-8 bytes). Password entry is masked and requires confirmation. This sets or replaces the one administrator account in the **configured Supabase project** and invalidates existing admin sessions. The database stores the username and a salted bcrypt password hash, never the readable password. There is no default password or public sign-up.
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
   | `PIN_PEPPER` | The existing device-cookie and abuse-rate secret |
   | `PUBLIC_ORIGIN` | Your website URL, such as `https://cloudsent.vercel.app` |
   | `NODE_ENV` | `production` |

   Enter secrets as server environment variables, without a `VITE_` prefix. An `.env` file on your computer is not uploaded to Vercel. For preview deployments, use a separate Supabase project if you want to keep test changes separate from your real records.

4. Complete the Supabase SQL setup and admin bootstrap before using the deployed site, then deploy in Vercel. Open `/api/health` to check the connection, `/wall` for the public wall, and `/secretlang` for username/password login.

The dashboard refreshes every 30 seconds while visible and when returning to the tab. Actions and the Refresh button update it immediately. This replaces the old connection that needed an always-running server.

## School display

Open `/view` on the school display and use your browser's full-screen mode (F11 on Windows). It shows five drifting prayer columns, a QR code on the right, and the JPCS DLSL copyright below, without menus or filters. Prayer placement is randomized per visit and stays steady through unchanged automatic refreshes. With fewer than five prayers, existing cards repeat to fill all five columns; no extra records are created. Card sizes adjust to the available space and prayer count. On small portrait screens the QR panel moves below the wall while the wall keeps five columns.

The display shows the latest 48 approved public prayers, checks for updates every 30 seconds while visible, and refreshes when the connection returns or the tab becomes visible. If a refresh fails, the last loaded prayers remain visible until reconnection. Motion follows the viewer's reduced-motion preference.

The QR code is generated locally using [qrcode.react](https://github.com/zpao/qrcode.react) and links to the homepage of the address where `/view` is open. Use your deployed Vercel address at school: a QR code pointing at `localhost` will not open your computer's website on students' phones. No database or environment changes are required for this page.

To preview a full wall, open `/view?demo=1`. It shows 40 fictional sample prayers across all six colors, clearly labeled as a preview. This mode does not call the API, poll for updates, or add anything to Supabase. Remove `?demo=1` to return to the live wall. The QR code still links to the real website homepage, not the sample display.

## Verification

`npm run build`, `npm run typecheck`, `npm run lint`, and `npm test` check the application. API tests use a disposable local PostgreSQL engine and mocked Supabase HTTP responses; they do not modify your Supabase project. `npm run db:check` is the separate live connection check after entering your credentials.

## Workspaces

- `apps/web` — React website, prayer wall and admin dashboard
- `apps/api` — shared API application, Supabase access and local administration scripts
- `api/index.js` — Vercel function entry point
- `supabase/setup.sql` — complete, repeatable database setup
- `packages/contracts` — shared request validation and response types
