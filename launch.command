#!/bin/bash
set -euo pipefail

# =========================================================
# Wildfly Local Launcher
# - Starts the Vite frontend from the repo root
# - Uses the project's configured dev port (:8080)
# - Opens the app in your browser
#
# Notes:
# - This launches the app locally only.
# - It does NOT start a local Supabase stack.
# - The app expects VITE_SUPABASE_URL and
#   VITE_SUPABASE_PUBLISHABLE_KEY in .env or .env.local.
# =========================================================

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

APP_URL="http://127.0.0.1:8080"
LOG_DIR="$DIR/logs"
LOG_FILE="$LOG_DIR/frontend.log"

cleanup() {
  echo ""
  echo "🧹 Shutting down Wildfly..."
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ Missing required command: $1"
    exit 1
  fi
}

has_env_var() {
  local var_name="$1"
  local file
  for file in ".env.local" ".env"; do
    if [[ -f "$file" ]] && grep -Eq "^[[:space:]]*${var_name}=" "$file"; then
      return 0
    fi
  done
  return 1
}

echo "🚀 Starting Wildfly locally..."

if [[ ! -f "$DIR/package.json" ]]; then
  echo "❌ package.json not found. Put this launch.command in the Wildfly repo root."
  exit 1
fi

require_cmd npm
require_cmd curl
require_cmd lsof

mkdir -p "$LOG_DIR"

# Make sure we're in the right project shape.
if ! grep -q '"dev"[[:space:]]*:[[:space:]]*"vite"' "$DIR/package.json"; then
  echo "❌ This doesn't look like the expected Wildfly Vite project."
  echo "   package.json is missing the expected \"dev\": \"vite\" script."
  exit 1
fi

# Validate required Vite env vars used by the Supabase client.
if [[ ! -f "$DIR/.env" && ! -f "$DIR/.env.local" ]]; then
  echo "❌ Missing .env or .env.local in the project root."
  echo "   Wildfly expects VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY."
  exit 1
fi

if ! has_env_var "VITE_SUPABASE_URL"; then
  echo "❌ Missing VITE_SUPABASE_URL in .env or .env.local."
  exit 1
fi

if ! has_env_var "VITE_SUPABASE_PUBLISHABLE_KEY"; then
  echo "❌ Missing VITE_SUPABASE_PUBLISHABLE_KEY in .env or .env.local."
  exit 1
fi

echo "🧹 Cleaning up anything already using port 8080..."
lsof -ti :8080 | xargs kill -9 2>/dev/null || true

# Install dependencies if needed.
if [[ ! -d "$DIR/node_modules" ]]; then
  echo "📦 node_modules not found. Installing dependencies..."
  npm install
fi

echo "--- Starting frontend (Vite :8080) ---"
: > "$LOG_FILE"

npm run dev -- --host 0.0.0.0 --port 8080 > "$LOG_FILE" 2>&1 &
FRONTEND_PID=$!

echo "⏳ Waiting for Wildfly to be reachable at $APP_URL ..."
for i in {1..90}; do
  if curl -s -I "$APP_URL" >/dev/null 2>&1; then
    break
  fi

  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "❌ Wildfly exited unexpectedly. Last 100 lines of $LOG_FILE:"
    tail -n 100 "$LOG_FILE" || true
    exit 1
  fi

  sleep 1
done

if ! curl -s -I "$APP_URL" >/dev/null 2>&1; then
  echo "❌ Wildfly did not become reachable on port 8080."
  echo "   Last 100 lines of $LOG_FILE:"
  tail -n 100 "$LOG_FILE" || true
  exit 1
fi

echo ""
echo "✅ Wildfly is running:"
echo "   $APP_URL"
echo ""
echo "ℹ️  frontend log: $LOG_FILE"
echo ""

open "$APP_URL" >/dev/null 2>&1 || true

echo "🟢 Running. Leave this window open. Press Ctrl+C to stop."
while true; do sleep 1; done
