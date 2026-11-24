#!/usr/bin/env bash
# Make elan/lake/lean visible to subprocesses that DON'T source bashrc/lean-env.sh.
#
# Problem: in remote-execution containers, elan installs binaries into
# /root/.elan/bin/, which is NOT on the default PATH for non-interactive
# subprocesses (MCP tool subprocs, hook scripts, ad-hoc Bash invocations).
# Sourcing scripts/lib/lean-env.sh works for scripts that source it, but
# every other call site has to re-export PATH or hit "lake: command not
# found".
#
# Fix: symlink elan/lake/lean/leanc/leanmake into /usr/local/bin/, which
# IS on the default PATH for every spawned shell, including minimal-env
# MCP subprocesses. Plus drop an /etc/profile.d/elan.sh for login shells.
#
# Idempotent — safe to re-run on every SessionStart. Detects stale
# symlinks (pointing elsewhere) and replaces them; leaves non-symlink
# files alone (don't clobber a legit install).
#
# Toolchain install is handled by a separate script
# (scripts/setup-lean-toolchain.sh), wired alongside this one in the
# SessionStart hook chain. This script does NOT invoke that one.
#
# Exit codes:
#   0 — always; failures (e.g. read-only /usr/local) are best-effort and
#       reported on stderr but do not fail the SessionStart hook chain.

set -uo pipefail

# Acquire global lock to prevent symlink races across agent workspaces
exec 200>"/tmp/qou-elan-symlinks.lock"
flock 200

ELAN_HOME="${ELAN_HOME:-$HOME/.elan}"
LOCAL_BIN="/usr/local/bin"
BINS=(elan lake lean leanc leanmake)

# If elan isn't installed, nothing to symlink. Bail quietly.
if [ ! -d "$ELAN_HOME/bin" ]; then
  exit 0
fi

# Symlink each binary if missing OR if stale (existing symlink to wrong
# target). Leave non-symlink files alone (someone else installed it).
linked=0
fixed=0
failed=0
for b in "${BINS[@]}"; do
  src="$ELAN_HOME/bin/$b"
  dst="$LOCAL_BIN/$b"
  [ -e "$src" ] || continue
  if [ -L "$dst" ]; then
    # Existing symlink — check target and replace if stale.
    cur=$(readlink "$dst" 2>/dev/null || true)
    if [ "$cur" != "$src" ]; then
      if rm -f "$dst" && ln -s "$src" "$dst" 2>/dev/null; then
        fixed=$((fixed+1))
      else
        echo "setup-elan-symlinks: failed to replace stale symlink at $dst" >&2
        failed=$((failed+1))
      fi
    fi
  elif [ ! -e "$dst" ]; then
    if ln -s "$src" "$dst" 2>/dev/null; then
      linked=$((linked+1))
    else
      echo "setup-elan-symlinks: failed to create symlink at $dst (read-only $LOCAL_BIN?)" >&2
      failed=$((failed+1))
    fi
  fi
done

# Drop a profile.d entry for login shells (belt + suspenders; the
# symlinks above are what actually makes MCP subprocs work).
profile_d="/etc/profile.d/elan.sh"
if [ ! -e "$profile_d" ] && [ -w "/etc/profile.d" ]; then
  cat > "$profile_d" <<EOF
# Added by scripts/setup-elan-symlinks.sh — make elan visible to all shells
export ELAN_HOME="\${ELAN_HOME:-$ELAN_HOME}"
case ":\$PATH:" in
  *":\$ELAN_HOME/bin:"*) ;;
  *) export PATH="\$ELAN_HOME/bin:\$PATH" ;;
esac
EOF
  chmod 644 "$profile_d" 2>/dev/null || true
fi

if [ "$linked" -gt 0 ] || [ "$fixed" -gt 0 ] || [ "$failed" -gt 0 ]; then
  echo "setup-elan-symlinks: linked=$linked fixed=$fixed failed=$failed" >&2
fi

# Always exit 0 (best-effort — SessionStart hooks should not block the
# session on a single symlink failure).
exit 0
