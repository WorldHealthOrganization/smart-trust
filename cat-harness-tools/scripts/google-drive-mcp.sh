#!/usr/bin/env bash
#
# Launch the Google Drive MCP server (stdio transport).
#
# Registered in the project .mcp.json as the "google-drive" server.
# This wrapper just locates a Python 3 interpreter and execs
# src/google-drive-mcp.py — all auth resolution (service account /
# OAuth / gcloud ADC) and Drive API initialisation happen lazily on
# the FIRST actual tool call.  Registering this server in .mcp.json
# costs nothing; if you never call a Drive tool, no credentials are
# read and no network requests are made.
#
# Credential setup (one-time, outside the repo):
#
#   Option A — Service account (recommended for CI / headless agents):
#     1. Create a service account in Google Cloud Console.
#     2. Grant it "Editor" access by sharing the target Drive folder
#        with the service account email.
#     3. Download the JSON key file.
#     4. export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa-key.json
#        (add to ~/.bashrc or the agent's environment).
#
#   Option B — OAuth2 (interactive, for personal use):
#     1. Create OAuth2 credentials in Google Cloud Console
#        (application type: Desktop).
#     2. Download and save to:
#        ~/.config/google-drive-mcp/credentials.json
#     3. On first tool call the server opens a browser consent page
#        once; the token is cached at
#        ~/.config/google-drive-mcp/token.json.
#
#   Option C — gcloud Application Default Credentials:
#     gcloud auth application-default login
#
# Configure the target Drive folder via harness.config.json:
#   { "googleDrive": { "folderPath": "MyProject/folio-pdfs" } }
# or via environment variable:
#   export GDRIVE_FOLDER_PATH="MyProject/folio-pdfs"
#
# Override the Drive root folder ID (e.g. for Shared Drives):
#   export GDRIVE_ROOT_FOLDER_ID="<folder-id>"
#
set -euo pipefail

REPO_ROOT="$(bash "$(dirname "${BASH_SOURCE[0]}")/lib/harness-root.sh")"
SCRIPT="$REPO_ROOT/src/google-drive-mcp.py"

PY="$(command -v python3 || command -v python || true)"
if [[ -z "$PY" ]]; then
  echo "google-drive-mcp: no python3/python on PATH" >&2
  exit 1
fi

# Read GDRIVE_FOLDER_PATH from harness.config.json if not already set
if [[ -z "${GDRIVE_FOLDER_PATH:-}" ]]; then
  CONFIG="$REPO_ROOT/harness.config.json"
  if [[ -f "$CONFIG" ]]; then
    GDRIVE_FOLDER_PATH="$(
      python3 -c "
import json, sys
cfg = json.load(open('$CONFIG'))
base = (cfg.get('googleDrive') or {}).get('folderPath','')
print(base)
" 2>/dev/null || true)"
    export GDRIVE_FOLDER_PATH
  fi
fi

exec "$PY" "$SCRIPT" --stdio
