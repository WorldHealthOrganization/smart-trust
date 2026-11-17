#!/usr/bin/env bash
# Self-updater for the Folio deployment.
#
# Polls git for new commits on main. When found:
#   1. Pulls latest code
#   2. Regenerates Caddyfile, whitelist files, viewer + assistant files
#   3. Checks for new Docker image
#   4. Clears folio-assistant cached data and bounces all services
#
# Usage:
#   ./deploy/self-update-folio.sh
#   crontab: */1 * * * * /opt/folio/deploy/self-update-folio.sh >> /var/log/folio-update.log 2>&1

set -uo pipefail

REPO_ROOT="$(bash "$(dirname "$0")/../scripts/lib/harness-root.sh")"
DEPLOY_DIR="$REPO_ROOT/deploy"
LOCKFILE="/tmp/folio-update.lock"

# ── Prevent concurrent runs (atomic flock) ────────────────────────
exec 200>"$LOCKFILE"
if ! flock -n 200; then
    exit 0  # another run is active
fi

CHANGED=false
COMPOSE_FILE="docker-compose.folio.yml"

# ── 1. Check git for new commits ─────────────────────────────────
cd "$REPO_ROOT"
# Explicit refspec — a bare `git fetch origin main` updates FETCH_HEAD but only
# opportunistically refreshes refs/remotes/origin/main, so a clone with a
# narrowed refspec would compare against a stale ref and decide it is already
# up to date forever. See bean 9giz.
git fetch origin '+refs/heads/main:refs/remotes/origin/main' --quiet 2>/dev/null

LOCAL_SHA=$(git rev-parse HEAD 2>/dev/null)
REMOTE_SHA=$(git rev-parse origin/main 2>/dev/null)

if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
    echo "[$(date -Is)] Git: new commits on main ($LOCAL_SHA → $REMOTE_SHA)"

    # Clean pull: nuke everything except deploy/.env (the only secret on disk).
    git clean -xdf --exclude='deploy/.env'
    git checkout -- .
    git pull origin main --quiet

    # Regenerate non-secret files from committed config
    CONFIG="$REPO_ROOT/folio-assistant.config.json"
    if [ -f "$DEPLOY_DIR/.env" ] && [ -f "$CONFIG" ]; then
        source "$DEPLOY_DIR/.env"

        # Caddyfile from folio template
        if [ -f "$DEPLOY_DIR/Caddyfile.folio.template" ]; then
            FOLIO_DOMAIN="${FOLIO_DOMAIN:-${FOLIO_DOMAIN}}" \
            MCP_INTERNAL_PORT="${MCP_INTERNAL_PORT}" \
                envsubst '${FOLIO_DOMAIN} ${MCP_INTERNAL_PORT} ${FOLIO_DOMAIN}' \
                < "$DEPLOY_DIR/Caddyfile.folio.template" \
                > "$DEPLOY_DIR/Caddyfile"
        fi

        # Whitelist files are committed directly — no generation needed.
        # They're mounted read-only into the auth-gateway container from deploy/.
        # The auth-gateway re-reads them on every request.

        # Refresh viewer files from repo
        VIEWER_DIR=$(python3 -c "import json; print(json.load(open('$CONFIG')).get('folio',{}).get('viewer_dir','viewer'))")
        VIEWER_SRC="$REPO_ROOT/$VIEWER_DIR"
        VIEWER_DST="$DEPLOY_DIR/viewer"
        if [ -d "$VIEWER_SRC" ]; then
            rm -rf "$VIEWER_DST"
            cp -r "$VIEWER_SRC" "$VIEWER_DST"
            echo "[$(date -Is)] Viewer files refreshed from $VIEWER_DIR/"
        fi

        # Refresh assistant files
        ASSISTANT_SRC="$REPO_ROOT/assistant"
        ASSISTANT_DST="$DEPLOY_DIR/assistant"
        if [ -d "$ASSISTANT_SRC" ]; then
            rm -rf "$ASSISTANT_DST"
            cp -r "$ASSISTANT_SRC" "$ASSISTANT_DST"
            echo "[$(date -Is)] Assistant files refreshed"
        fi
    fi

    CHANGED=true
fi

# ── 2. Check Docker image for new digest ─────────────────────────
cd "$DEPLOY_DIR"

RUNNING_DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' folio-assistant 2>/dev/null | cut -d@ -f2 || echo "none")

if docker compose -f "$COMPOSE_FILE" pull folio-assistant --quiet 2>/dev/null; then
    source "$DEPLOY_DIR/.env" 2>/dev/null || true
    IMAGE="${FOLIO_IMAGE:-ghcr.io/org/folio-assistant/folio-assistant}:latest"
    NEW_DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' "$IMAGE" 2>/dev/null | cut -d@ -f2 || echo "unknown")

    if [ "$RUNNING_DIGEST" != "$NEW_DIGEST" ] && [ "$NEW_DIGEST" != "unknown" ]; then
        echo "[$(date -Is)] Docker: new image digest ($RUNNING_DIGEST → $NEW_DIGEST)"
        CHANGED=true
    fi
fi

# ── 3. Restart if anything changed (clear cache + bounce) ────────
if [ "$CHANGED" = true ]; then
    echo "[$(date -Is)] Clearing cached data and restarting services..."

    # Stop folio-assistant to clear any in-memory/on-disk cache
    docker compose -f "$COMPOSE_FILE" stop folio-assistant 2>/dev/null || true

    # Remove the container so it starts fresh (no stale oleans/lake cache)
    docker compose -f "$COMPOSE_FILE" rm -f folio-assistant 2>/dev/null || true

    # Bring everything back up
    docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
    echo "[$(date -Is)] Services restarted with fresh state."
else
    # Silent — nothing to do
    :
fi
