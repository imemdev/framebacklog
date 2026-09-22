#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

PORT="${PORT:-3000}"
APP_URL="${FRAMEBACKLOG_URL:-${APP_URL:-http://localhost:${PORT}}}"
SERVER_PID=""

if [[ ! "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1 || PORT > 65535 )); then
  printf 'Invalid PORT: %s (expected 1–65535).\n' "$PORT" >&2
  exit 2
fi

if ! command -v node >/dev/null 2>&1; then
  printf 'Node.js is required. Install the version specified in README.md.\n' >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  printf 'pnpm is required. Enable Corepack and install dependencies as described in README.md.\n' >&2
  exit 1
fi

if [[ ! -x "$PROJECT_ROOT/node_modules/.bin/next" ]]; then
  printf 'Dependencies are missing. Run `pnpm install --frozen-lockfile` first.\n' >&2
  exit 1
fi

if [[ ! -f "$PROJECT_ROOT/.env.local" ]] && [[ -z "${BETTER_AUTH_SECRET:-}" ]]; then
  printf 'Local configuration is missing. Run `cp .env.example .env.local`, then set\n'
  printf 'BETTER_AUTH_SECRET to a random value of at least 32 characters.\n'
  exit 1
fi

if command -v lsof >/dev/null 2>&1; then
  LISTENING_PID="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true)"
  if [[ -n "$LISTENING_PID" ]]; then
    printf 'Port %s is already in use (PID %s). Stop that server or choose another port, for example PORT=3001 %s.\n' \
      "$PORT" "$LISTENING_PID" "$0" >&2
    exit 1
  fi
fi

# pnpm's local migration script reads DATA_DIR from the process environment.
# Load .env.local with Next's own dotenv-compatible loader first so migration
# owner preparation and the Next.js server use the same local database directory.
node -e '
  const { createRequire } = require("node:module");
  const nextRequire = createRequire(require.resolve("next/package.json"));
  nextRequire("@next/env").loadEnvConfig(process.cwd());
  const { spawnSync } = require("node:child_process");
  for (const args of [
    ["db:migrate"],
    ["exec", "tsx", "scripts/ensure-local-owner.ts"],
  ]) {
    const result = spawnSync("pnpm", args, {
      env: process.env,
      stdio: "inherit",
    });
    if (result.error) {
      console.error(result.error.message);
      process.exit(1);
    }
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
'

signal_process_tree() {
  local process_pid="$1"
  local signal_name="$2"
  local child_pid

  if command -v pgrep >/dev/null 2>&1; then
    while IFS= read -r child_pid; do
      [[ -n "$child_pid" ]] && signal_process_tree "$child_pid" "$signal_name"
    done < <(pgrep -P "$process_pid" 2>/dev/null || true)
  fi

  kill -"$signal_name" "$process_pid" 2>/dev/null || true
}

cleanup() {
  local process_pid="$SERVER_PID"

  trap - EXIT INT TERM HUP
  if [[ -n "$process_pid" ]] && kill -0 "$process_pid" 2>/dev/null; then
    printf '\nStopping the FrameBacklog development server and its child processes...\n'
    signal_process_tree "$process_pid" TERM

    for _ in {1..50}; do
      kill -0 "$process_pid" 2>/dev/null || break
      sleep 0.1
    done

    if kill -0 "$process_pid" 2>/dev/null; then
      signal_process_tree "$process_pid" KILL
    fi

    wait "$process_pid" 2>/dev/null || true
  fi
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

export PORT
printf 'Starting FrameBacklog at %s\n' "$APP_URL"
pnpm dev &
SERVER_PID=$!

APP_READY=0
for _ in {1..90}; do
  if curl --silent --show-error --fail --max-time 1 "$APP_URL" >/dev/null 2>&1; then
    APP_READY=1
    break
  fi

  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    if wait "$SERVER_PID"; then
      SERVER_PID=""
      printf 'The development server exited before becoming ready.\n' >&2
      exit 1
    else
      SERVER_STATUS=$?
      SERVER_PID=""
      exit "$SERVER_STATUS"
    fi
  fi

  sleep 1
done

if (( APP_READY == 0 )); then
  printf 'The app did not respond at %s within 90 seconds.\n' "$APP_URL" >&2
  exit 1
fi

if [[ "${FRAMEBACKLOG_NO_BROWSER:-0}" != "1" ]]; then
  if [[ "$(uname -s)" == "Darwin" ]] && command -v open >/dev/null 2>&1; then
    open "$APP_URL" >/dev/null 2>&1 || printf 'Could not open a browser automatically; open %s manually.\n' "$APP_URL"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$APP_URL" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then
    open "$APP_URL" >/dev/null 2>&1 &
  else
    printf 'Open %s in your browser.\n' "$APP_URL"
  fi
fi

printf 'FrameBacklog is running. Press Ctrl+C here (or close this terminal) to stop its server processes.\n'
if wait "$SERVER_PID"; then
  SERVER_STATUS=0
else
  SERVER_STATUS=$?
fi
SERVER_PID=""
exit "$SERVER_STATUS"
