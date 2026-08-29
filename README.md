# Trading ERP

Trading ERP is currently at **Step 0.7: Purchase Contract PDF Export**. It provides a Next.js application, Prisma with MySQL, Better Auth email/password sign-in, database-backed sessions, the built-in `admin`/`user` roles, authenticated self-service password changes, Company, Supplier, and Product master data, and Purchase Contracts with line items, Draft/Final/Cancelled status handling, and formal PDF export for Final contracts.

## Requirements

- Node.js 24 LTS
- pnpm
- Docker with Docker Compose

## System dependencies

On a new Ubuntu VPS, install or verify the operating-system dependencies before deploying the application:

```bash
./scripts/install-system-deps.sh
```

The script remains the stable deployment entry point for operating-system dependencies. The application currently has no required OS-level packages, so it performs a safe dependency check and exits successfully. Purchase Contract PDF export uses a bundled open-source Noto Serif CJK SC font family and does not require an apt-installed Chinese font.

## Local setup

1. Select Node.js 24:

   ```bash
   nvm use
   ```

2. Create local environment configuration. Replace the development-only database passwords and generate a private Better Auth secret of at least 32 characters:

   ```bash
   cp .env.example .env
   ```

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Start MySQL:

   ```bash
   docker compose up -d mysql
   ```

5. Apply the committed migrations and generate the Prisma client:

   ```bash
   pnpm db:migrate
   pnpm db:generate
   ```

6. Create the first administrator with Better Auth's official version-matched CLI. Omit `--password` so it is entered interactively and never stored in shell history:

   ```bash
   pnpm dlx auth@1.7.1 create-admin \
     --config src/lib/auth-config.ts \
     --email admin@example.com \
     --name "Admin" \
     --role admin
   ```

7. Start Next.js:

   ```bash
   pnpm dev
   ```

Open `http://localhost:3000`. The root route redirects unauthenticated visitors to `/login` and authenticated users to `/dashboard`.

Public sign-up is disabled. Administrators create accounts through Better Auth's server-side Admin plugin tooling; there is no public registration flow or user-management screen in this step.

Authenticated users can open `/account` from the dashboard to change their password. A successful change revokes their other sessions while preserving the current session. Passwords must contain 8–128 characters; no composition rules are imposed.

Authenticated users can view the single Company configuration at `/company`. Administrators can create or edit it; regular users have read-only access.

Authenticated users can list and view suppliers at `/suppliers`. Administrators can create and edit suppliers; regular users have read-only access.

Authenticated users can list and view products at `/products`. Administrators can create and edit products; regular users have read-only access.

Authenticated users can list and view purchase contracts at `/purchase-contracts`. Administrators can create and edit Draft contracts, finalize or reopen them, or cancel Draft/Final contracts; regular users have read-only access. Both roles can export a formal PDF while a contract is Final; Draft and Cancelled contracts cannot be exported.

Purchase Contract PDF export uses the matched bundled `assets/fonts/NotoSerifCJKsc-Regular.otf` and `assets/fonts/NotoSerifCJKsc-Bold.otf` faces, so a new VPS does not need a system Chinese-font package. Both are official Noto Serif CJK SC releases from the [Noto CJK project](https://github.com/notofonts/noto-cjk/tree/main/Serif/OTF/SimplifiedChinese), distributed under the SIL Open Font License 1.1 stored unmodified at `assets/fonts/LICENSE-Noto-CJK`. Set the optional `PURCHASE_CONTRACT_PDF_FONT_PATH` environment variable to use a different readable regular body font file; this is an advanced override, while Bold emphasis continues to use the bundled Noto Serif CJK SC Bold face and therefore may no longer be a matched family. An invalid or required-glyph-incomplete override fails safely without falling back.

## Production migration

Production and staging deployments must apply committed migrations with:

```bash
pnpm db:deploy
```

Do not use `prisma db push` or `prisma migrate dev` as a production migration strategy.

## Health endpoints

- `GET /api/health/live` checks only that the application is running.
- `GET /api/health/ready` runs a lightweight `SELECT 1` database check.

The ready endpoint returns HTTP 503 with a non-sensitive response when MySQL is unavailable.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Playwright uses a local Next.js development server. Install its Chromium runtime once if it is not already available:

```bash
pnpm exec playwright install chromium
```

Without a local MySQL server, Playwright retains non-database smoke coverage for the login page and fail-closed dashboard/account/company/supplier/product/purchase-contract redirects. Real sign-in, session persistence, sign-out, password change, Company CRUD, Supplier CRUD, Product CRUD, Purchase Contract transactions/status transitions, PDF export with MySQL snapshots and bundled Noto Serif CJK SC rendering, and readiness integration must be verified after deployment.

## Database development

MySQL data is stored in the `mysql_data` Docker named volume. The server binds only to `127.0.0.1` for local development and uses `utf8mb4` with `utf8mb4_0900_ai_ci`.

Future persisted values for money, quantity, unit price, and exchange rate must use an appropriate MySQL `DECIMAL` type. Do not use `FLOAT` or `DOUBLE` for those business values.

## Development principles

1. Iterate in small, testable steps.
2. Prefer current requirements over speculative future needs.
3. Do not implement future modules early.
4. Never persist money or quantity using floating-point database types.
5. Never commit secrets to Git.
6. Complete the checks for each step before continuing.
