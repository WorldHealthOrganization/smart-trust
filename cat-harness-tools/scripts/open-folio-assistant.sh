#!/usr/bin/env bash
#
# SessionStart hook: start the assistant server (if not running) and open browser.
#
# Reads port from lean-mcp.config.json (viewer_port) via folio-port.sh.
# If not running, prints start instructions. Then opens the assistant landing page.
#
set -uo pipefail

source "$(dirname "$0")/folio-port.sh"
PORT="$FOLIO_PORT"
URL="http://localhost:${PORT}/folio/"

# ── Check if server is already running ───────────────────────────
if curl -sf --max-time 2 "http://localhost:${PORT}/health" &>/dev/null; then
  echo '{"assistant_server": "running", "url": "'"$URL"'"}'
else
  echo '{"assistant_server": "not_running", "url": "'"$URL"'", "message": "Start with: ./scripts/start-folio-assistant.sh"}'
fi

# ── Open browser ─────────────────────────────────────────────────
if command -v xdg-open &>/dev/null; then
  nohup xdg-open "$URL" &>/dev/null &
elif command -v open &>/dev/null; then
  open "$URL"
fi

exit 0
