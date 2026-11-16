#!/usr/bin/env bash
#
# Launch the SageMath MCP server (stdio transport).
#
# Registered in the project .mcp.json as the "sage" server. This wrapper just
# locates a Python 3 and execs src/sage-mcp-server.py — all backend selection
# (native `sage` vs Docker) and the lazy ~2 GB image pull happen inside that
# script, and ONLY on the first actual Sage tool call. Registering this server
# costs nothing; if you never call a Sage tool, nothing is downloaded.
#
# Override the image with $SAGE_DOCKER_IMAGE; disable the Docker fallback with
# SAGE_NO_DOCKER=1; force a command with $SAGE_CMD.
#
set -euo pipefail

REPO_ROOT="$(bash "$(dirname "${BASH_SOURCE[0]}")/lib/harness-root.sh")"
SCRIPT="$REPO_ROOT/src/sage-mcp-server.py"

PY="$(command -v python3 || command -v python || true)"
if [[ -z "$PY" ]]; then
  echo "sage-mcp: no python3/python on PATH" >&2
  exit 1
fi

exec "$PY" "$SCRIPT" --stdio
