#!/usr/bin/env bash
# Uptime monitor: probes the production endpoints and posts an alert to ntfy
# on failure (and a recovery notice on the next success).
# Cron suggestion (every 5 min):
#   */5 * * * * /home/mundeez/DevWorkz/nkuku-companion-app/infra/scripts/uptime-check.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# Pull only the vars we need (full `source` breaks on SMTP_FROM's <> chars)
env_get() { grep -E "^$1=" "$REPO_ROOT/.env" 2>/dev/null | tail -1 | cut -d= -f2-; }
NTFY_BASE_URL="$(env_get NTFY_BASE_URL)"
NTFY_AUTH_TOKEN="$(env_get NTFY_AUTH_TOKEN)"

BASE="${NKUKU_UPTIME_BASE:-https://nkuku.zeendeefood.solutions}"
NTFY="${NTFY_BASE_URL:-https://ntfy.zeendeefood.solutions}"
TOPIC="${NTFY_OPS_TOPIC:-nkuku-alerts}"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/nkuku-uptime"
mkdir -p "$STATE_DIR"

alert() {
  # $1 = title, $2 = body, $3 = priority — publishes JSON to ntfy
  curl -sS -m 10 -X POST "$NTFY" \
    -H "Authorization: Bearer ${NTFY_AUTH_TOKEN:-}" \
    -H "Content-Type: application/json" \
    -d "{\"topic\":\"$TOPIC\",\"title\":\"$1\",\"message\":\"$2\",\"priority\":${3:-4},\"tags\":[\"warning\"]}" \
    >/dev/null 2>&1 || true
}

probe() { # name, url → updates state file, alerts on transitions
  local name="$1" url="$2"
  local statefile="$STATE_DIR/$name"
  local code
  code=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$url" || echo 000)
  local prev="ok"; [ -f "$statefile" ] && prev=$(cat "$statefile")
  if [ "$code" = "200" ]; then
    if [ "$prev" != "ok" ]; then
      alert "Nkuku $name recovered" "$url is responding again (HTTP $code)" 3
    fi
    echo ok > "$statefile"
  else
    if [ "$prev" = "ok" ]; then
      alert "Nkuku $name DOWN" "$url returned HTTP $code at $(date -u +%H:%M:%SZ)" 5
    fi
    echo "fail-$code" > "$statefile"
  fi
}

probe api   "$BASE/health?deep=1"
probe web   "$BASE/"
probe login "$BASE/login"
