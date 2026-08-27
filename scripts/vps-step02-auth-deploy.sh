#!/usr/bin/env bash
set -euo pipefail
umask 077

APP_DIR="/opt/trading-erp"
PORT="3100"
BASE_URL="http://127.0.0.1:${PORT}"
NODE_BIN="/home/ubuntu/.nvm/versions/node/v24.18.0/bin/node"
NODE_DIR="/home/ubuntu/.nvm/versions/node/v24.18.0/bin"
PM2_BIN="/home/ubuntu/.nvm/versions/node/v24.16.0/bin/pm2"

export PATH="${NODE_DIR}:${PATH}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

cleanup_files() {
  rm -f /tmp/trading-erp-auth-cookies.txt \
        /tmp/trading-erp-auth-login.json \
        /tmp/trading-erp-auth-session.json \
        /tmp/trading-erp-auth-signout.json \
        /tmp/trading-erp-auth-session-after-signout.json \
        /tmp/trading-erp-live.json \
        /tmp/trading-erp-ready.json
}

trap cleanup_files EXIT

echo "===== Trading ERP Step 0.2 Authentication Deploy ====="

test "$(whoami)" = "ubuntu" || fail "Run this script as ubuntu."
test -d "$APP_DIR/.git" || fail "$APP_DIR is not a Git repository."
test -f "$APP_DIR/.env" || fail "$APP_DIR/.env is missing. Step 0.1 must be deployed first."
test -x "$NODE_BIN" || fail "Node 24.18.0 binary not found."
test -x "$PM2_BIN" || fail "Existing PM2 binary not found."

cd "$APP_DIR"

command -v git >/dev/null || fail "git not found"
command -v pnpm >/dev/null || fail "pnpm not found"
command -v curl >/dev/null || fail "curl not found"
command -v openssl >/dev/null || fail "openssl not found"

BRANCH="$(git branch --show-current)"
[ "$BRANCH" = "main" ] || fail "Expected main branch, found $BRANCH."

if [ -n "$(git status --porcelain)" ]; then
  fail "Working tree is not clean."
fi

echo "Branch: $BRANCH"
echo "Commit: $(git rev-parse HEAD)"
echo "Node: $(node -v)"
echo "pnpm: $(pnpm -v)"
echo "PM2: $($PM2_BIN -v)"

echo
echo "===== Authentication Environment ====="

if ! grep -q '^BETTER_AUTH_SECRET=' .env; then
  AUTH_SECRET="$(openssl rand -hex 32)"
  printf '\nBETTER_AUTH_SECRET="%s"\n' "$AUTH_SECRET" >> .env
  unset AUTH_SECRET
  echo "Generated BETTER_AUTH_SECRET."
else
  echo "Existing BETTER_AUTH_SECRET preserved."
fi

if ! grep -q '^BETTER_AUTH_URL=' .env; then
  printf 'BETTER_AUTH_URL="%s"\n' "$BASE_URL" >> .env
  echo "Set BETTER_AUTH_URL=${BASE_URL}."
else
  echo "Existing BETTER_AUTH_URL preserved."
fi

chmod 600 .env

if ! grep -q '^APP_NAME=' .env || ! grep -q '^APP_URL=' .env || ! grep -q '^DATABASE_URL=' .env; then
  fail ".env is missing one or more Step 0.1 variables."
fi

AUTH_SECRET_LENGTH="$(sed -n 's/^BETTER_AUTH_SECRET="\?\([^"[:space:]]*\)"\?$/\1/p' .env | head -n1 | awk '{print length}')"
if [ -z "$AUTH_SECRET_LENGTH" ] || [ "$AUTH_SECRET_LENGTH" -lt 32 ]; then
  fail "BETTER_AUTH_SECRET is missing or shorter than 32 characters."
fi

echo ".env authentication configuration ready (secret not displayed)."

echo
echo "===== Dependencies / Migration / Build ====="
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:deploy
pnpm lint
pnpm typecheck
pnpm test
pnpm build

echo
echo "===== Initial Administrator ====="
echo "Enter the first administrator details."
echo "Leave the email blank only if an administrator already exists and you want to skip creation."
read -rp "Admin email: " ADMIN_EMAIL

ADMIN_CREATED=0
if [ -n "$ADMIN_EMAIL" ]; then
  read -rp "Admin display name [Admin]: " ADMIN_NAME
  ADMIN_NAME="${ADMIN_NAME:-Admin}"

  echo
  echo "Better Auth will now prompt for the administrator password interactively."
  echo "Use at least 15 characters. The password will not be placed in shell history or Git."
  echo

  pnpm dlx auth@1.7.1 create-admin \
    --config src/lib/auth-config.ts \
    --email "$ADMIN_EMAIL" \
    --name "$ADMIN_NAME" \
    --role admin

  ADMIN_CREATED=1
else
  echo "Initial administrator creation skipped."
fi

echo
echo "===== PM2 Restart ====="

if ! "$PM2_BIN" describe trading-erp >/dev/null 2>&1; then
  fail "PM2 app trading-erp does not exist. Step 0.1 must be deployed first."
fi

"$PM2_BIN" restart trading-erp --update-env
"$PM2_BIN" save

for _ in $(seq 1 30); do
  if curl -fsS "${BASE_URL}/api/health/live" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

LIVE_CODE="$(curl -sS -o /tmp/trading-erp-live.json -w '%{http_code}' "${BASE_URL}/api/health/live" || true)"
READY_CODE="$(curl -sS -o /tmp/trading-erp-ready.json -w '%{http_code}' "${BASE_URL}/api/health/ready" || true)"

echo "Live HTTP:  $LIVE_CODE"
echo "Ready HTTP: $READY_CODE"
[ "$LIVE_CODE" = "200" ] || fail "Live health check failed."
[ "$READY_CODE" = "200" ] || fail "Ready health check failed."

echo
echo "===== Real Authentication Integration Test ====="

if [ "$ADMIN_CREATED" -eq 1 ]; then
  read -rsp "Re-enter the administrator password for login/session/sign-out verification: " ADMIN_PASSWORD
  echo

  COOKIE_JAR="/tmp/trading-erp-auth-cookies.txt"
  rm -f "$COOKIE_JAR"

  LOGIN_CODE="$({
    printf '%s\0%s' "$ADMIN_EMAIL" "$ADMIN_PASSWORD" |
      "$NODE_BIN" -e '
        const chunks = [];
        process.stdin.on("data", (chunk) => chunks.push(chunk));
        process.stdin.on("end", () => {
          const input = Buffer.concat(chunks).toString("utf8");
          const split = input.indexOf("\0");
          const email = input.slice(0, split);
          const password = input.slice(split + 1);
          process.stdout.write(JSON.stringify({ email, password }));
        });
      '
  } | curl -sS \
      -c "$COOKIE_JAR" \
      -H 'Content-Type: application/json' \
      -H "Origin: ${BASE_URL}" \
      --data-binary @- \
      -o /tmp/trading-erp-auth-login.json \
      -w '%{http_code}' \
      "${BASE_URL}/api/auth/sign-in/email" || true)"

  unset ADMIN_PASSWORD

  echo "Login HTTP: $LOGIN_CODE"
  [ "$LOGIN_CODE" = "200" ] || {
    cat /tmp/trading-erp-auth-login.json 2>/dev/null || true
    echo
    fail "Real email/password login failed."
  }

  SESSION_CODE="$(curl -sS \
    -b "$COOKIE_JAR" \
    -H "Origin: ${BASE_URL}" \
    -o /tmp/trading-erp-auth-session.json \
    -w '%{http_code}' \
    "${BASE_URL}/api/auth/get-session" || true)"

  echo "Session HTTP: $SESSION_CODE"
  [ "$SESSION_CODE" = "200" ] || fail "Session lookup failed."

  if ! grep -q '"user"' /tmp/trading-erp-auth-session.json; then
    cat /tmp/trading-erp-auth-session.json 2>/dev/null || true
    echo
    fail "Authenticated session was not returned."
  fi

  DASHBOARD_CODE="$(curl -sS \
    -b "$COOKIE_JAR" \
    -o /dev/null \
    -w '%{http_code}' \
    "${BASE_URL}/dashboard" || true)"

  echo "Authenticated dashboard HTTP: $DASHBOARD_CODE"
  [ "$DASHBOARD_CODE" = "200" ] || fail "Authenticated dashboard check failed."

  SIGNOUT_CODE="$(curl -sS \
    -b "$COOKIE_JAR" \
    -c "$COOKIE_JAR" \
    -X POST \
    -H 'Content-Type: application/json' \
    -H "Origin: ${BASE_URL}" \
    --data '{}' \
    -o /tmp/trading-erp-auth-signout.json \
    -w '%{http_code}' \
    "${BASE_URL}/api/auth/sign-out" || true)"

  echo "Sign Out HTTP: $SIGNOUT_CODE"
  [ "$SIGNOUT_CODE" = "200" ] || fail "Sign out failed."

  AFTER_CODE="$(curl -sS \
    -b "$COOKIE_JAR" \
    -H "Origin: ${BASE_URL}" \
    -o /tmp/trading-erp-auth-session-after-signout.json \
    -w '%{http_code}' \
    "${BASE_URL}/api/auth/get-session" || true)"

  echo "Post-sign-out session HTTP: $AFTER_CODE"
  [ "$AFTER_CODE" = "200" ] || fail "Post-sign-out session lookup failed."

  if grep -q '"user"' /tmp/trading-erp-auth-session-after-signout.json; then
    cat /tmp/trading-erp-auth-session-after-signout.json 2>/dev/null || true
    echo
    fail "Session still appears authenticated after sign out."
  fi

  echo "Real login -> session -> dashboard -> sign-out verification PASS."
else
  echo "Skipped because initial administrator creation was skipped."
fi

echo
echo "===== Final PM2 Status ====="
"$PM2_BIN" list

echo
echo "===== Final Summary ====="
echo "Branch      : $(git branch --show-current)"
echo "Commit      : $(git rev-parse HEAD)"
echo "Port        : 127.0.0.1:${PORT}"
echo "Database    : trading_erp"
echo "PM2 App     : trading-erp"
echo "Live HTTP   : ${LIVE_CODE}"
echo "Ready HTTP  : ${READY_CODE}"
if [ "$ADMIN_CREATED" -eq 1 ]; then
  echo "Auth test   : PASS"
else
  echo "Auth test   : SKIPPED"
fi

echo
echo "Trading ERP Step 0.2 authentication deployment PASS."
