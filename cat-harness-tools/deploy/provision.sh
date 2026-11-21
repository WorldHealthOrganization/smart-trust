#!/usr/bin/env bash
# Provision a Hetzner Cloud server for the Folio Folio deployment.
#
# Requires: hcloud CLI (https://github.com/hetznercloud/cli)
#   brew install hcloud  OR  apt install hcloud-cli
#   hcloud context create folio  # then paste your API token
#
# What this does:
#   1. Creates a server per lean-mcp.config.json hetzner settings
#   2. Installs Docker + Compose via cloud-init
#   3. Clones the repo, runs generate-config.sh --folio, starts services
#   4. Sets up self-update cron (polls every minute)
#   5. Prints the IP for DNS setup
#
# After running:
#   - Point folio.OWNER.org A record to the printed IP
#   - SSH in and fill in OAuth creds in deploy/.env
#   - Caddy auto-provisions TLS once DNS propagates
#
# Usage:
#   ./deploy/provision-hetzner.sh

set -euo pipefail

REPO_ROOT="$(bash "$(dirname "$0")/../scripts/lib/harness-root.sh")"
CONFIG="$REPO_ROOT/lean-mcp.config.json"

# ── Parse config ──────────────────────────────────────────────────
DOMAIN=$(python3 -c "import json; print(json.load(open('$CONFIG')).get('folio',{}).get('domain','folio.example.org'))")
REPO_URL=$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null | sed 's|git@github.com:|https://github.com/|' || echo "https://github.com/org/folio-assistant.git")

SERVER_NAME="folio-folio"
SERVER_TYPE=$(python3 -c "import json; print(json.load(open('$CONFIG')).get('hetzner',{}).get('server_type','cx22'))")
IMAGE=$(python3 -c "import json; print(json.load(open('$CONFIG')).get('hetzner',{}).get('image','ubuntu-24.04'))")
LOCATION=$(python3 -c "import json; print(json.load(open('$CONFIG')).get('hetzner',{}).get('location','fsn1'))")

echo "=== Hetzner Lean MCP Provisioning ==="
echo "  Server:   $SERVER_NAME ($SERVER_TYPE)"
echo "  Domain:   $DOMAIN"
echo "  Repo:     $REPO_URL"
echo "  Location: $LOCATION"
echo ""

# ── Check hcloud CLI ─────────────────────────────────────────────
if ! command -v hcloud &>/dev/null; then
    echo "✗ hcloud CLI not found."
    echo "  Install: https://github.com/hetznercloud/cli"
    echo "  Then: hcloud context create folio"
    exit 1
fi

# ── Check for existing server ────────────────────────────────────
if hcloud server describe "$SERVER_NAME" &>/dev/null; then
    echo "⚠ Server '$SERVER_NAME' already exists."
    IP=$(hcloud server ip "$SERVER_NAME")
    echo "  IP: $IP"
    echo "  To rebuild: hcloud server rebuild $SERVER_NAME --image $IMAGE"
    echo "  To delete:  hcloud server delete $SERVER_NAME"
    exit 0
fi

# ── Cloud-init script ────────────────────────────────────────────
CLOUD_INIT=$(cat <<'CLOUDINIT'
#!/bin/bash
set -euxo pipefail

# ── Install Docker ────────────────────────────────────────────────
curl -fsSL https://get.docker.com | sh

# ── Install envsubst (part of gettext-base) ──────────────────────
apt-get install -y gettext-base python3

# ── Clone repo ────────────────────────────────────────────────────
git clone REPO_URL_PLACEHOLDER /opt/folio
cd /opt/folio

# ── Generate config (non-interactive folio mode, OAuth creds need manual fill) ─
./deploy/generate-config.sh --folio --ci

# ── Authenticate with GHCR (read-only, public images don't need this) ─
# If the image is private, you'll need to: docker login ghcr.io

# ── Start services ────────────────────────────────────────────────
cd deploy
docker compose -f docker-compose.folio.yml pull
docker compose -f docker-compose.folio.yml up -d

# ── Set up self-update cron (every minute) ────────────────────────
CRON_LINE="* * * * * /opt/folio/deploy/self-update-folio.sh >> /var/log/folio-update.log 2>&1"
(crontab -l 2>/dev/null || true; echo "$CRON_LINE") | crontab -

# ── Log rotation for update log ──────────────────────────────────
cat > /etc/logrotate.d/folio-update <<'LOGROTATE'
/var/log/folio-update.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
LOGROTATE

echo "=== Provisioning complete ==="
CLOUDINIT
)

# Substitute repo URL into cloud-init
CLOUD_INIT="${CLOUD_INIT//REPO_URL_PLACEHOLDER/$REPO_URL}"

# ── Create server ────────────────────────────────────────────────
echo "▸ Creating server..."
hcloud server create \
    --name "$SERVER_NAME" \
    --type "$SERVER_TYPE" \
    --image "$IMAGE" \
    --location "$LOCATION" \
    --user-data "$CLOUD_INIT"

IP=$(hcloud server ip "$SERVER_NAME")

echo ""
echo "=== Server created ==="
echo ""
echo "  IP:     $IP"
echo "  SSH:    ssh root@$IP"
echo "  Cost:   ~€4.50/mo (~\$5/mo)"
echo ""
echo "Next steps:"
echo "  1. Point DNS: $DOMAIN → A record → $IP"
echo "  2. Wait ~3 min for cloud-init to finish"
echo "  3. SSH in: ssh root@$IP"
echo "  4. Edit /opt/folio/deploy/.env — fill in OAuth credentials:"
echo "     Google: https://console.cloud.google.com/apis/credentials"
echo "       Redirect URI: https://$DOMAIN/auth/google/callback"
echo "     GitHub: https://github.com/settings/developers"
echo "       Callback URL: https://$DOMAIN/auth/github/callback"
echo "  5. Restart: cd /opt/folio/deploy && docker compose -f docker-compose.folio.yml restart"
echo "  6. Caddy auto-provisions TLS once DNS propagates (~5 min)"
echo ""
echo "Self-updater cron runs every minute. Check logs:"
echo "  ssh root@$IP tail -f /var/log/folio-update.log"
