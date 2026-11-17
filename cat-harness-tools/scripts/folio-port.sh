#!/usr/bin/env bash
#
# Source this file to get FOLIO_PORT from lean-mcp.config.json.
#
# Usage (in any script):
#   source "$(dirname "$0")/folio-port.sh"
#   echo "http://localhost:${FOLIO_PORT}/viewer/"
#
REPO_ROOT="$(bash "$(dirname "${BASH_SOURCE[0]}")/lib/harness-root.sh")"
_CONFIG="$REPO_ROOT/lean-mcp.config.json"

if [ -f "$_CONFIG" ] && command -v python3 &>/dev/null; then
  FOLIO_PORT=$(python3 -c "import json; print(json.load(open('$_CONFIG')).get('viewer_port', 8080))" 2>/dev/null || echo 8080)
elif [ -n "${VIEWER_PORT:-}" ]; then
  FOLIO_PORT="$VIEWER_PORT"
else
  FOLIO_PORT=8080
fi

export FOLIO_PORT
