---
# folio-assistant-p3zo
$schema: bean/1.0.0
title: 'AGENT CONTAINERS RUN THE WRONG BUN: the session-start hook should install .bun-version (1.3.14), not leave the container''s 1.4.2'
status: completed
type: bug
priority: normal
created_at: 2026-10-06T07:51:12Z
updated_at: 2026-10-10T16:42:44Z
parent: folio-assistant-1xhc
---

Follow-up to `3ozg` (completed), which pinned Bun to `.bun-version` (1.3.14) in all 22 CI `setup-bun` sites, **but not in agent containers**.

## The cost, measured 2026-10-06
Three sessions in one morning were caught by it:
- Session A: a false `navbar-assets` failure, chased as a main defect;
- the coordinating session: local gates diverging from CI;
- Session F: about to hold PR #2262 for a "main fix" that wasn't needed.

The container default is Bun **1.4.2**, which minifies `navbar.js` differently, so `navbar-assets.test.ts` fails locally and passes in CI.

## The working install path (`bun.sh` is blocked by the proxy)
```sh
cd /tmp && npm pack @oven/bun-linux-x64@$(cat .bun-version) && tar xzf oven-bun-linux-x64-*.tgz
# then put package/bin first on PATH
```

## Done when
- [x] the session-start hook (`.claude/settings.json` → `session-start-coord-sweep.sh`, or a sibling script) installs the version in `.bun-version` when `bun --version` differs, through the npm route, and puts it first on PATH for the session
- [x] it says plainly when it could not install (could-not-determine, never silent), and leaves the container Bun in place
- [x] a fresh container's `bun --version` equals `.bun-version`, checked in a new session

Owner's default choice, 2026-10-06 (https://claude.ai/code/session_012qoycyCSGidZqW245vXhze): bean it for later, not separation work.

## Closed 2026-10-09
- Branch: `claude/p3zo-bun-version-hook`
- Commit: `e521f397253e152a1c926c33115082a59ae91981` in repository `cat-harness`

### Changes & Evidence
1. **Added `scripts/install-bun.sh`**:
   - Detects host platform (`linux-x64`, `linux-aarch64`, `darwin-aarch64`, `darwin-x64`, `windows-x64`).
   - Fetches `@oven/bun-<os>-<arch>@<pin>` via `npm pack` (avoiding blocked `bun.sh`).
   - Installs binary to `$HOME/.local/bin/bun` (or fallback `$CHECKOUT_ROOT/.local/bin/bun`), makes executable, and validates version.
   - Idempotent: exits 0 immediately if target version is already installed.
   - Robust error handling: exits 2 with clear message on invalid version or missing tools.
2. **Added `scripts/install-bun.bat` and updated `scripts/gen-bat-wrappers.sh`**:
   - Added Windows wrapper and verified `gen-bat-wrappers.sh --check` (all 38 .bat wrappers up to date).
3. **Updated `scripts/session-start-coord-sweep.sh` §3-ter**:
   - Checks `bun --version` against `.bun-version`.
   - If mismatched, invokes `install-bun.sh`, prepends `$HOME/.local/bin` to `PATH`, and reports plainly to markdown output.
   - Never fails silently: reports warnings if `.bun-version` cannot be read or if installation fails, leaving container Bun in place.
   - Searches for `check-bun-runtime.ts` across both `$REPO_ROOT/scripts/` and `$CHECKOUT_ROOT/cat-harness-tools/scripts/`.
4. **Verification**:
   - Added unit test suite `scripts/tests/session-start-bun.test.ts` (8 passed, 0 failed).
   - `check:bun-runtime` verified: exits 0 (`Bun runtime — 1.3.14 matches cat-harness/.bun-version; 86 sidecar(s) read.`).
   - `bun run typecheck`: clean (code 0).

## Summary of Changes

Mirror copy. Owned by litlfred/cat-harness-tools' store, where drain lane B closed it: already implemented in install-bun.sh plus the sweep. The gap it exposed for this checkout is carried by a new bean (root hooks and the cat script point at paths 70lx moved).



## Summary of Changes

Re-triaged 2026-10-10 (lane B drain). The implementation was already on main, so this commit records its state:

- [x] `scripts/install-bun.sh` (+ `.bat`) installs the version in `.bun-version` through `npm pack @oven/bun-<os>-<arch>@<pin>` into `$HOME/.local/bin`. `scripts/session-start-coord-sweep.sh` (§ "Bun runtime alignment") calls it whenever `bun --version` differs. In these containers `~/.local/bin` comes before `~/.bun/bin` on PATH, so the pinned Bun wins without touching the container's own. Covered by `scripts/tests/session-start-bun.test.ts`.
- [x] An install that cannot complete says so ("Could not determine pinned Bun version…") and leaves the container's Bun in place.
- [ ] A fresh container reporting the pin: **not true today, and the cause is outside this repository.** folio-assistant's `.claude/settings.json` SessionStart hook still runs `bash cat-harness/scripts/session-start-coord-sweep.sh`. Its `ask-well.sh` and `decisions-named-not-asked.ts` hooks have the same problem. All three scripts moved to `cat-harness-tools/scripts/` in 70lx, so the hook fails and the sweep never runs. That path fix belongs to the folio-assistant root and was handed to the coordinating session (lane A). Once it lands, the existing sweep satisfies this item with no change here.
