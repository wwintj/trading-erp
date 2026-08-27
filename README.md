# Trading ERP

Trading ERP is currently at **Step 0.1: Project Bootstrap**. This baseline provides a Next.js application, a Prisma connection layer, MySQL development infrastructure, health endpoints, and placeholder pages. It intentionally contains no authentication or ERP business models.

## Requirements

- Node.js 24 LTS
- pnpm
- Docker with Docker Compose

## Local setup

1. Select Node.js 24:

   ```bash
   nvm use
   ```

2. Create local environment configuration and replace the development-only passwords:

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

5. Generate the Prisma client. The schema intentionally has no business models yet:

   ```bash
   pnpm db:generate
   ```

   When a later step introduces a schema migration, run:

   ```bash
   pnpm db:migrate
   ```

6. Start Next.js:

   ```bash
   pnpm dev
   ```

Open `http://localhost:3000`. The root route redirects to `/dashboard`.

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
