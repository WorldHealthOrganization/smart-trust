#!/usr/bin/env bash
# Install Playwright's Chromium and, only when some are missing, the system
# libraries it needs. ONE copy for every workflow and action that installs a
# browser (layer-pr-checks.yml, layer-post-merge-regen.yml, pr-tests.yml, the
# ci-setup action); they call this instead of
# `playwright install --with-deps chromium`.
#
# Usage: install.sh <playwright command...>
#   e.g. install.sh node_modules/.bin/playwright
#        install.sh npx --yes playwright
#
# Why (2026-11-11): from ~13:59Z runners could not resolve archive.ubuntu.com
# or security.ubuntu.com, and `--with-deps` ran `apt-get update && apt-get
# install` on EVERY run, so apt exited 100 and whole PR tiers failed before a
# test ran, although the runner image already carries every library Chromium
# needs. Three steps:
#
#   1. The browser itself, from Playwright's CDN (not apt). Always run; any
#      failure fails the step, as before.
#   2. `playwright install-deps --dry-run chromium`, which simulates the apt
#      install (`apt-get install -s`, no network) and prints "All system
#      dependencies are installed." and exits 0 only when nothing is missing.
#      Then apt is not touched at all. Any other answer (missing packages, an
#      older Playwright whose dry run only prints the command, a simulation
#      error) counts as "may be missing" and goes on to step 3: the check can
#      skip apt, never skip a needed install.
#   3. `playwright install-deps chromium` with apt retrying each fetch
#      (Acquire::Retries) and up to three attempts with back-off. If every
#      attempt fails the step fails: a missing library is a real failure.
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <playwright command...>" >&2
  exit 2
fi
pw=("$@")

echo "::group::Playwright Chromium (browser download)"
"${pw[@]}" install chromium
echo "::endgroup::"

if [ "$(uname -s)" != Linux ]; then
  echo "not Linux: no system libraries to install"
  exit 0
fi

dry="$(mktemp)"
trap 'rm -f "$dry"' EXIT
status=0
"${pw[@]}" install-deps --dry-run chromium >"$dry" 2>&1 || status=$?
cat "$dry"
if [ "$status" -eq 0 ] && grep -qx 'All system dependencies are installed\.' "$dry"; then
  echo "Chromium's system libraries are all present: apt skipped"
  exit 0
fi
echo "::notice title=Playwright system libraries::the dry run did not confirm every library is present (exit $status); installing through apt"

as_root() {
  if [ "$(id -u)" -eq 0 ]; then "$@"; else sudo -n "$@"; fi
}
# install-deps runs its own apt-get, so the retries go in apt's configuration.
printf 'Acquire::Retries "5";\nAcquire::http::Timeout "30";\nAcquire::https::Timeout "30";\n' \
  | as_root tee /etc/apt/apt.conf.d/80-playwright-retries >/dev/null \
  || echo "::warning::could not write apt retry configuration; installing without it"

# Each attempt is BOUNDED (2026-11-14: on smart-ips-pilgrimage#81 apt stalled
# after fetching archive.ubuntu.com's InRelease files and logged nothing for
# 59 minutes; Acquire::*::Timeout did not fire, so attempt 1 ran into the
# job's 60-minute timeout and attempts 2 and 3 never happened). `timeout` runs
# as root because install-deps hands the work to a root apt-get, which a
# non-root `timeout` could not signal; PATH is passed so `node` still resolves
# under sudo's secure_path. A stalled attempt then counts as a failed one and
# the back-off below retries it.
attempt_timeout="${PLAYWRIGHT_DEPS_ATTEMPT_TIMEOUT:-600}"
bounded() {
  if [ "$(id -u)" -eq 0 ]; then
    timeout --kill-after=30 "$attempt_timeout" "$@"
  else
    sudo -n env "PATH=$PATH" timeout --kill-after=30 "$attempt_timeout" "$@"
  fi
}

attempts=3
for attempt in $(seq 1 "$attempts"); do
  echo "::group::playwright install-deps chromium (attempt $attempt of $attempts, at most ${attempt_timeout}s)"
  if bounded "${pw[@]}" install-deps chromium; then
    echo "::endgroup::"
    exit 0
  fi
  echo "::endgroup::"
  if [ "$attempt" -lt "$attempts" ]; then
    wait_s=$((attempt * 30))
    echo "::warning::install-deps attempt $attempt failed; retrying in ${wait_s}s"
    sleep "$wait_s"
  fi
done
echo "::error title=Playwright system libraries::Chromium's system libraries are missing and apt failed $attempts times"
exit 1
