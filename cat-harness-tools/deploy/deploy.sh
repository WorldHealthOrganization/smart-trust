#!/usr/bin/env bash
# One-command deployment for the Folio Folio service.
#
# Deploys the viewer + MCP server behind Google OAuth on any Linux host.
# The ONLY secrets needed are Google OAuth Client ID + Secret, which you
# create once at https://console.cloud.google.com/apis/credentials.
#
# No secrets stored in the repo. The .env file (gitignored) holds:
#   - Google OAuth creds  (you provide once)
#   - MCP token           (auto-generated)
#   - Cookie secret       (auto-generated)
#
# Everything else comes from lean-mcp.config.json (version-controlled):
#   - Domain, image, email whitelist, viewer dir, update interval
#
# Architecture:
#   Internet → Caddy (auto TLS) → auth-gateway (dual OAuth) → folio-assistant
#
# Prerequisites: git, curl, python3, Docker, Docker Compose
#
# Usage:
#   git clone https://github.com/org/folio-assistant.git
#   cd folio
#   ./deploy/deploy-folio.sh
#
# After first deploy:
#   1. Point DNS: folio.OWNER.org → A record → server IP
#   2. Caddy auto-provisions TLS once DNS propagates (~5 min)
#   3. Self-updater cron polls every minute for new commits

set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(bash "$DEPLOY_DIR/../scripts/lib/harness-root.sh")"
CONFIG="$REPO_ROOT/lean-mcp.config.json"

if [ ! -f "$CONFIG" ]; then
    echo "✗ lean-mcp.config.json not found at repo root"
    exit 1
fi

# Parse folio config
DOMAIN=$(python3 -c "import json; print(json.load(open('$CONFIG')).get('folio',{}).get('domain','folio.example.org'))")

echo "=== Folio Folio Deployment ==="
echo ""
echo "  Domain:  $DOMAIN"
echo "  Viewer:  $(python3 -c "import json; print(json.load(open('$CONFIG')).get('folio',{}).get('viewer_dir','viewer'))")"
echo "  Emails:  $(python3 -c "import json; print(', '.join(json.load(open('$CONFIG')).get('authorized_emails',[])))")"
echo ""

# ── 1. Docker ────────────────────────────────────────────────────
if command -v docker &>/dev/null; then
    echo "▸ Docker: $(docker --version)"
else
    echo "▸ Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo "  ✓ Docker installed. You may need to log out/in for group membership."
fi

if docker compose version &>/dev/null; then
    echo "▸ Compose: $(docker compose version --short)"
else
    echo "✗ Docker Compose not available. Install docker-compose-plugin."
    exit 1
fi

# ── 2. GHCR auth (skip if image is public) ───────────────────────
echo ""
IMAGE=$(python3 -c "import json; print(json.load(open('$CONFIG')).get('image',''))")
if docker pull "$IMAGE:latest" --quiet 2>/dev/null; then
    echo "▸ Image is public — no GHCR auth needed"
else
    if [ -f "$HOME/.docker/config.json" ] && grep -q "ghcr.io" "$HOME/.docker/config.json" 2>/dev/null; then
        echo "▸ Already authenticated with GHCR"
    else
        echo "▸ GHCR authentication needed (image appears private)."
        echo "  Create a GitHub PAT with 'read:packages' scope:"
        echo "  https://github.com/settings/tokens/new"
        echo ""
        read -rp "  GitHub username: " GH_USER
        read -rsp "  GitHub PAT: " GH_TOKEN
        echo ""
        echo "$GH_TOKEN" | docker login ghcr.io -u "$GH_USER" --password-stdin
        echo "  ✓ Authenticated with GHCR"
    fi
fi

# ── 3. Generate config (folio mode) ──────────────────────────────
echo ""
if [ ! -f "$DEPLOY_DIR/.env" ]; then
    echo "▸ Generating deployment config..."
    "$DEPLOY_DIR/generate-config.sh" --folio
else
    echo "▸ .env already exists"
    echo "  To regenerate: ./deploy/generate-config.sh --folio"
    # Still refresh non-secret files
    source "$DEPLOY_DIR/.env"
    if [ -f "$DEPLOY_DIR/Caddyfile.folio.template" ]; then
        FOLIO_DOMAIN="${FOLIO_DOMAIN:-$DOMAIN}" \
        MCP_INTERNAL_PORT="${MCP_INTERNAL_PORT:-8080}" \
            envsubst '${FOLIO_DOMAIN} ${MCP_INTERNAL_PORT} ${FOLIO_DOMAIN}' \
            < "$DEPLOY_DIR/Caddyfile.folio.template" \
            > "$DEPLOY_DIR/Caddyfile"
    fi
    python3 -c "import json; [print(e) for e in json.load(open('$CONFIG')).get('authorized_emails',[])]" \
        > "$DEPLOY_DIR/authorized-emails.txt"
    # Refresh viewer
    VIEWER_DIR=$(python3 -c "import json; print(json.load(open('$CONFIG')).get('folio',{}).get('viewer_dir','viewer'))")
    if [ -d "$REPO_ROOT/$VIEWER_DIR" ]; then
        rm -rf "$DEPLOY_DIR/viewer"
        cp -r "$REPO_ROOT/$VIEWER_DIR" "$DEPLOY_DIR/viewer"
    fi
fi

# ── 4. Pull image + start ────────────────────────────────────────
echo ""
echo "▸ Pulling folio-assistant image..."
cd "$DEPLOY_DIR"
docker compose -f docker-compose.folio.yml pull folio-assistant || echo "  ⚠ Pull failed (image may not be built yet)"

echo ""
echo "▸ Starting services..."
docker compose -f docker-compose.folio.yml up -d

# ── 5. Set up self-update cron ────────────────────────────────────
echo ""
CRON_LINE="* * * * * $DEPLOY_DIR/self-update-folio.sh >> /var/log/folio-update.log 2>&1"
EXISTING_CRON=$(crontab -l 2>/dev/null || true)

if echo "$EXISTING_CRON" | grep -q "self-update-folio"; then
    echo "▸ Self-update cron already configured"
else
    (echo "$EXISTING_CRON"; echo "$CRON_LINE") | crontab -
    echo "▸ Self-update cron installed (polls every minute)"
fi

# ── Done ──────────────────────────────────────────────────────────
echo ""
echo "=== Folio deployment complete ==="
echo ""
echo "Services:"
docker compose -f docker-compose.folio.yml ps
echo ""
echo "Endpoints (once DNS is pointed):"
echo "  Viewer:       https://$DOMAIN/"
echo "  MCP (OAuth):  https://$DOMAIN/mcp"
echo "  MCP (token):  curl -H 'Authorization: Bearer \$TOKEN' https://$DOMAIN/mcp"
echo "  Health:       https://$DOMAIN/health"
echo ""
echo "Next steps:"
echo "  1. Point DNS: $DOMAIN → A record → $(curl -s ifconfig.me 2>/dev/null || echo '<server-ip>')"
echo "  2. Caddy auto-provisions TLS once DNS propagates"

# Check if OAuth creds are placeholder
source "$DEPLOY_DIR/.env" 2>/dev/null || true
if [ "${GOOGLE_CLIENT_ID:-}" = "FILL_ME_IN" ]; then
    echo ""
    echo "  ⚠ Google OAuth creds not set yet!"
    echo "    1. Create at: https://console.cloud.google.com/apis/credentials"
    echo "       Redirect URI: https://$DOMAIN/oauth2/callback"
    echo "    2. Edit $DEPLOY_DIR/.env"
    echo "    3. docker compose -f docker-compose.folio.yml restart oauth2-proxy"
fi

echo ""
echo "Logs:    docker compose -f docker-compose.folio.yml logs -f"
echo "Updates: tail -f /var/log/folio-update.log"
