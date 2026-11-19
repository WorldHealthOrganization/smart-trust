#!/usr/bin/env bash
# sign.sh: sign commits, tags and files with one ed25519-sk key on a YubiKey.
#
# A thin wrapper. OpenSSH (8.2+), git (2.34+) and the gh CLI already do the
# work; this runs their steps in the right order, so setup is one command and
# each signature is one touch of the key (cat-harness-tools#1730).
#
# It follows the cat-harness `signing` skill: the private key never leaves the
# YubiKey and never goes in a repo. Only the public key is published, in the
# repo's `.signing/allowed_signers`, which is what verifiers trust.
#
#   sign.sh setup [--email E] [--no-github] [--pin]
#       Make the key (once), set git to sign every commit and tag with it,
#       register it with GitHub as a signing key (so commits show Verified),
#       and add it to this repo's allowed_signers file.
#   sign.sh restore
#       On a new machine: copy the key handle off the YubiKey (ssh-keygen -K).
#   sign.sh file PATH...
#       Write PATH.sig next to each file.
#   sign.sh verify [PATH...]
#       Check each PATH against its PATH.sig. With no PATH, check every
#       tracked *.sig in the repo. Exits 1 if any check fails.
#
# Environment:
#   SIGN_KEY       private key handle (default ~/.ssh/id_ed25519_sk_sign)
#   SIGN_ALLOWED   allowed_signers file (default <repo>/.signing/allowed_signers)
#   SIGN_NAMESPACE signature namespace for files (default "file")
set -euo pipefail

KEY="${SIGN_KEY:-$HOME/.ssh/id_ed25519_sk_sign}"
NAMESPACE="${SIGN_NAMESPACE:-file}"

die() { echo "sign: $*" >&2; exit 1; }
say() { echo "sign: $*" >&2; }

repo_root() { git rev-parse --show-toplevel 2>/dev/null || pwd; }
allowed_file() { echo "${SIGN_ALLOWED:-$(repo_root)/.signing/allowed_signers}"; }

need() { command -v "$1" >/dev/null 2>&1 || die "$1 is not installed. $2"; }

usage() { sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; }

# The public key text: "<type> <base64>", without the comment.
pubkey() { [ -f "$KEY.pub" ] || die "no public key at $KEY.pub (run: sign.sh setup)"; awk '{print $1" "$2}' "$KEY.pub"; }

add_allowed() { # FILE PRINCIPAL
  local file="$1" who="$2" pk; pk="$(pubkey)"
  mkdir -p "$(dirname "$file")"; touch "$file"
  if grep -qF "$pk" "$file"; then say "key already in $file"; return; fi
  printf '%s namespaces="git,%s" %s\n' "$who" "$NAMESPACE" "$pk" >>"$file"
  say "added key for $who to $file"
}

cmd_setup() {
  local email="" github=1 pin=()
  while [ $# -gt 0 ]; do
    case "$1" in
      --email) email="$2"; shift 2 ;;
      --no-github) github=0; shift ;;
      --pin) pin=(-O verify-required); shift ;;
      *) die "setup: unknown option $1" ;;
    esac
  done
  need ssh-keygen "Install OpenSSH 8.2 or later."
  need git ""
  [ -n "$email" ] || email="$(git config --get user.email || true)"
  [ -n "$email" ] || die "setup: no email. Pass --email or set git config user.email."

  if [ -f "$KEY" ]; then
    say "using existing key $KEY"
  else
    say "making a new key on the YubiKey. Touch it when it blinks."
    mkdir -p "$(dirname "$KEY")"
    ssh-keygen -t ed25519-sk -O resident -O application=ssh:signing "${pin[@]}" \
      -C "$email" -f "$KEY" -N "" \
      || die "could not make the key. Is the YubiKey plugged in, with firmware 5.2.3 or later?"
  fi

  local global_allowed="$HOME/.config/git/allowed_signers"
  git config --global gpg.format ssh
  git config --global user.signingkey "$KEY"
  git config --global commit.gpgsign true
  git config --global tag.gpgsign true
  git config --global gpg.ssh.allowedSignersFile "$global_allowed"
  add_allowed "$global_allowed" "$email"
  say "git now signs every commit and tag with $KEY"

  if [ "$github" = 1 ]; then
    if ! command -v gh >/dev/null 2>&1; then
      say "gh is not installed, so the key was not registered with GitHub. Add $KEY.pub at https://github.com/settings/ssh/new as a Signing Key."
    elif gh api user/ssh_signing_keys --jq '.[].key' 2>/dev/null | grep -qF "$(pubkey)"; then
      say "key already registered with GitHub"
    else
      gh ssh-key add "$KEY.pub" --type signing --title "YubiKey signing ($(hostname))" \
        || say "gh could not add the key. Run: gh auth refresh -s admin:ssh_signing_key, then sign.sh setup again."
    fi
  fi

  if git rev-parse --show-toplevel >/dev/null 2>&1; then
    add_allowed "$(allowed_file)" "$email"
    say "commit $(allowed_file) so others can verify your files"
  fi
}

cmd_restore() {
  need ssh-keygen "Install OpenSSH 8.2 or later."
  local dir; dir="$(mktemp -d)"
  (cd "$dir" && ssh-keygen -K) || die "could not read resident keys from the YubiKey"
  local found; found="$(ls "$dir"/id_ed25519_sk_rk_signing* 2>/dev/null | grep -v '\.pub$' | head -1 || true)"
  [ -n "$found" ] || found="$(ls "$dir"/id_ed25519_sk_rk* 2>/dev/null | grep -v '\.pub$' | head -1 || true)"
  [ -n "$found" ] || die "no ed25519-sk resident key on this YubiKey"
  mkdir -p "$(dirname "$KEY")"
  mv "$found" "$KEY"; mv "$found.pub" "$KEY.pub"; chmod 600 "$KEY"; rm -rf "$dir"
  say "restored key handle to $KEY. Now run: sign.sh setup --no-github"
}

cmd_file() {
  [ $# -gt 0 ] || die "file: name at least one file"
  [ -f "$KEY" ] || die "no key at $KEY (run: sign.sh setup)"
  local f
  for f in "$@"; do
    [ -f "$f" ] || die "file: $f does not exist"
    rm -f "$f.sig"
    say "signing $f (touch the YubiKey)"
    ssh-keygen -Y sign -q -f "$KEY" -n "$NAMESPACE" "$f" || die "could not sign $f"
  done
}

verify_one() { # SUBJECT ALLOWED -> 0 ok, 1 bad
  local f="$1" allowed="$2" sig="$1.sig" who
  if [ ! -f "$f" ]; then echo "FAIL $f: file missing"; return 1; fi
  if [ ! -f "$sig" ]; then echo "FAIL $f: no $sig"; return 1; fi
  who="$(ssh-keygen -Y find-principals -s "$sig" -f "$allowed" 2>/dev/null | head -1 || true)"
  if [ -z "$who" ]; then echo "FAIL $f: signed by a key not in $allowed"; return 1; fi
  if ssh-keygen -Y verify -f "$allowed" -I "$who" -n "$NAMESPACE" -s "$sig" <"$f" >/dev/null 2>&1; then
    echo "OK   $f (signed by $who)"
  else
    echo "FAIL $f: signature does not match"; return 1
  fi
}

cmd_verify() {
  need ssh-keygen "Install OpenSSH 8.2 or later."
  local allowed; allowed="$(allowed_file)"
  [ -f "$allowed" ] || die "no allowed_signers file at $allowed"
  local subjects=() s
  if [ $# -gt 0 ]; then
    subjects=("$@")
  else
    local root; root="$(repo_root)"
    while IFS= read -r s; do [ -n "$s" ] && subjects+=("$root/${s%.sig}"); done \
      < <(git -C "$root" ls-files -- '*.sig' 2>/dev/null)
  fi
  if [ ${#subjects[@]} -eq 0 ]; then echo "no signed files found"; return 0; fi
  local bad=0
  for s in "${subjects[@]}"; do verify_one "${s%.sig}" "$allowed" || bad=$((bad + 1)); done
  if [ "$bad" -gt 0 ]; then echo "$bad of ${#subjects[@]} signatures failed"; return 1; fi
  echo "all ${#subjects[@]} signatures verified"
}

case "${1:-}" in
  setup) shift; cmd_setup "$@" ;;
  restore) shift; cmd_restore "$@" ;;
  file) shift; cmd_file "$@" ;;
  verify) shift; cmd_verify "$@" ;;
  -h|--help|help|"") usage ;;
  *) die "unknown command $1 (try: sign.sh help)" ;;
esac
