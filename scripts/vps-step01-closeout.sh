#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/trading-erp"
PORT="3100"
NODE_BIN="/home/ubuntu/.nvm/versions/node/v24.18.0/bin/node"
NODE_DIR="/home/ubuntu/.nvm/versions/node/v24.18.0/bin"
PM2_BIN="/home/ubuntu/.nvm/versions/node/v24.16.0/bin/pm2"

export PATH="${NODE_DIR}:${PATH}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

echo "===== Trading ERP Step 0.1 VPS Closeout ====="

test "$(whoami)" = "ubuntu" || fail "Run this script as ubuntu."
cd "$APP_DIR"

command -v git >/dev/null || fail "git not found"
command -v node >/dev/null || fail "node not found"
command -v pnpm >/dev/null || fail "pnpm not found"
command -v mysql >/dev/null || fail "mysql client not found"
command -v curl >/dev/null || fail "curl not found"
command -v openssl >/dev/null || fail "openssl not found"
test -x "$NODE_BIN" || fail "Node 24.18.0 binary not found"
test -x "$PM2_BIN" || fail "Existing PM2 binary not found"

if ss -lnt | awk '{print $4}' | grep -qE ":${PORT}$"; then
  if "$PM2_BIN" describe trading-erp >/dev/null 2>&1; then
    echo "Existing trading-erp PM2 process detected; stopping it for verification."
    "$PM2_BIN" stop trading-erp >/dev/null
    sleep 1
  else
    fail "Port ${PORT} is already in use by another process."
  fi
fi

echo "Node: $(node -v)"
echo "pnpm: $(pnpm -v)"
echo "PM2: $($PM2_BIN -v)"
echo "Branch: $(git branch --show-current)"
echo "Commit: $(git rev-parse HEAD)"

echo
echo "===== MySQL ====="
read -rsp "Enter MySQL root password (input hidden): " MYSQL_ROOT_PASSWORD
echo

MYSQL_HOST_ARGS=()
if MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "SELECT 1" >/dev/null 2>&1; then
  MYSQL_HOST_ARGS=()
elif MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -h127.0.0.1 -e "SELECT 1" >/dev/null 2>&1; then
  MYSQL_HOST_ARGS=(-h127.0.0.1)
else
  unset MYSQL_ROOT_PASSWORD
  fail "MySQL root authentication failed."
fi

ERP_DB_PASSWORD="$(openssl rand -hex 24)"

MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot "${MYSQL_HOST_ARGS[@]}" <<SQL
CREATE DATABASE IF NOT EXISTS trading_erp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'trading_erp'@'127.0.0.1' IDENTIFIED BY '${ERP_DB_PASSWORD}';
ALTER USER 'trading_erp'@'127.0.0.1' IDENTIFIED BY '${ERP_DB_PASSWORD}';
GRANT ALL PRIVILEGES ON trading_erp.* TO 'trading_erp'@'127.0.0.1';

CREATE USER IF NOT EXISTS 'trading_erp'@'localhost' IDENTIFIED BY '${ERP_DB_PASSWORD}';
ALTER USER 'trading_erp'@'localhost' IDENTIFIED BY '${ERP_DB_PASSWORD}';
GRANT ALL PRIVILEGES ON trading_erp.* TO 'trading_erp'@'localhost';

FLUSH PRIVILEGES;
SQL

unset MYSQL_ROOT_PASSWORD

cat > .env <<EOF
APP_NAME="Trading ERP"
APP_URL="http://127.0.0.1:${PORT}"
DATABASE_URL="mysql://trading_erp:${ERP_DB_PASSWORD}@127.0.0.1:3306/trading_erp"
EOF
chmod 600 .env
unset ERP_DB_PASSWORD

echo "Database and .env configured."

echo
echo "===== Dependencies / Quality Gates ====="
pnpm install --frozen-lockfile
pnpm db:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm build

echo
echo "===== Real production health check ====="
LOG_FILE="/tmp/trading-erp-step01.log"
rm -f "$LOG_FILE"

nohup pnpm exec next start -H 127.0.0.1 -p "$PORT" >"$LOG_FILE" 2>&1 &
TEMP_PID=$!

cleanup_temp() {
  kill "$TEMP_PID" >/dev/null 2>&1 || true
  wait "$TEMP_PID" >/dev/null 2>&1 || true
}
trap cleanup_temp EXIT

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health/live" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

LIVE_CODE="$(curl -sS -o /tmp/trading-erp-live.json -w '%{http_code}' "http://127.0.0.1:${PORT}/api/health/live" || true)"
READY_CODE="$(curl -sS -o /tmp/trading-erp-ready.json -w '%{http_code}' "http://127.0.0.1:${PORT}/api/health/ready" || true)"

echo "Live HTTP: $LIVE_CODE"
cat /tmp/trading-erp-live.json 2>/dev/null || true
echo
echo "Ready HTTP: $READY_CODE"
cat /tmp/trading-erp-ready.json 2>/dev/null || true
echo

if [ "$LIVE_CODE" != "200" ] || [ "$READY_CODE" != "200" ]; then
  echo "===== Application log ====="
  tail -100 "$LOG_FILE" || true
  fail "Health verification failed."
fi

cleanup_temp
trap - EXIT

echo
echo "===== PM2 ====="
if "$PM2_BIN" describe trading-erp >/dev/null 2>&1; then
  "$PM2_BIN" delete trading-erp >/dev/null
fi

PATH="${NODE_DIR}:${PATH}" NODE_ENV="production" \
  "$PM2_BIN" start "$APP_DIR/node_modules/next/dist/bin/next" \
  --name trading-erp \
  --cwd "$APP_DIR" \
  --interpreter "$NODE_BIN" \
  -- start -H 127.0.0.1 -p "$PORT"

"$PM2_BIN" save
sleep 3

FINAL_LIVE="$(curl -sS -o /tmp/trading-erp-final-live.json -w '%{http_code}' "http://127.0.0.1:${PORT}/api/health/live" || true)"
FINAL_READY="$(curl -sS -o /tmp/trading-erp-final-ready.json -w '%{http_code}' "http://127.0.0.1:${PORT}/api/health/ready" || true)"

[ "$FINAL_LIVE" = "200" ] || fail "Final live health check failed."
[ "$FINAL_READY" = "200" ] || fail "Final ready health check failed."

echo
echo "===== Final Summary ====="
echo "Branch      : $(git branch --show-current)"
echo "Commit      : $(git rev-parse HEAD)"
echo "Port        : 127.0.0.1:${PORT}"
echo "Database    : trading_erp"
echo "PM2 App     : trading-erp"
echo "Live HTTP   : ${FINAL_LIVE}"
echo "Ready HTTP  : ${FINAL_READY}"
echo
echo "Trading ERP Step 0.1 VPS closeout PASS."
