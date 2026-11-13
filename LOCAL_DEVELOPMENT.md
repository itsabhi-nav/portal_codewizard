# Local Development (no hosted Supabase needed)

The app can run fully locally using:

- **PostgreSQL** (installed via Homebrew, already running)
- **PostgREST** (installed via Homebrew)
- **A tiny proxy** (`scripts/local-supabase-proxy.js`) that maps Supabase's
  `/rest/v1/...` paths to PostgREST's root paths
- **Next.js** (the app itself)

This gives you a real database, real RLS, real APIs and real file generation —
no mock data and no hosted credentials required.

---

## One-time setup

```bash
# 1. PostgreSQL (already installed on this machine)
brew services start postgresql@14

# 2. PostgREST (already installed on this machine)
brew install postgrest

# 3. Dependencies
npm install
```

## Start everything

```bash
bash scripts/start-local.sh
```

The script will:

1. Create the local database (`codewizard_local` by default).
2. Apply `supabase/setup.sql` (all tables, RLS, functions, safe seed) — skipped
   when the schema already exists. Use `RESET_DB=1 bash scripts/start-local.sh`
   to drop and recreate the local database from scratch.
3. Create the `anon` / `authenticated` / `service_role` Postgres roles.
4. Generate JWT tokens for local authentication.
5. Write `.env.local` with the correct values.
6. Start PostgREST (port `3006`).
7. Start the local Supabase proxy (port `3005`).
8. Start the Next.js dev server (port `3200`).

Then open **http://localhost:3200** and log in with:

```
Username: admin
Password: CodeWizard@2026
```

> Change these in `.env.local` (`ADMIN_USERNAME` / `ADMIN_PASSWORD`) before any
> real use.

## Stop everything

Press `Ctrl+C` in the terminal running the script, then:

```bash
bash scripts/stop-local.sh
```

## Manual commands (if you prefer)

```bash
# Database
createdb codewizard_local
psql -d codewizard_local -f supabase/setup.sql

# PostgREST
PGRST_DB_URI="postgres://$(whoami)@localhost:5432/codewizard_local" \
PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
PGRST_JWT_SECRET="local-dev-jwt-secret-with-32-chars-min" \
PGRST_SERVER_PORT=3006 PGRST_DB_USE_LEGACY_GUCS=false postgrest &

# Proxy
PROXY_PORT=3005 BACKEND_PORT=3006 node scripts/local-supabase-proxy.js &

# App
npm run dev
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PGDATABASE` | `codewizard_local` | Local Postgres database |
| `PGUSER` | current user | Postgres user |
| `PGHOST` | `localhost` | Postgres host |
| `PGPORT` | `5432` | Postgres port |
| `BACKEND_PORT` | `3006` | PostgREST port |
| `PROXY_PORT` | `3005` | Port the app connects to |
| `APP_PORT` | `3200` | Next.js port |
| `JWT_SECRET` | `local-dev-jwt-secret-...` | JWT signing secret for local tokens |
| `RESET_DB` | `0` | Set to `1` to drop and recreate the local database |

## Notes

- The local database is **development only**. Use hosted Supabase for
  production (see `DEPLOYMENT.md`).
- RLS is enabled on every table. The `anon` role is blocked by default; the app
  uses the `service_role` key server-side, which bypasses RLS.
- Razorpay is disabled by default. Set `RAZORPAY_ENABLED=true` and add keys to
  test online renewals.
