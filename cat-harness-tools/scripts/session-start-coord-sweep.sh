#!/usr/bin/env bash
# session-start-coord-sweep.sh — the shared, agent-generic session-start primer.
#
# Emits a markdown block to stdout that each agent CLI injects into context at
# session start. It is wired from the native SessionStart command hook of every
# CLI that supports one (Claude Code via .claude/settings.json; Gemini CLI and
# Antigravity via their hooks.json) — all invoking THIS one script, so there is a
# single source of priming logic. It is also CLI-independent: it works whether or
# not the `beans` CLI is on PATH.
#
# What it surfaces:
#   1. The beans work-plan (`beans prime` + `beans list`, or a beans/ fallback).
#   2. How far the default branch has moved since this branch diverged.
#   3. Recent sibling agent branches.
#   4. A generic recommended action.
#
# Heavy triage (reading every new commit / sibling PR) belongs in a background
# subagent, not here. Keep this fast and read-only.

set -uo pipefail

# ── -1. Is `origin`'s default branch `main`? ──────────────────────────────
# GitHub makes the first branch pushed to an empty repository its default;
# dth-hrh's became a feature branch that way (owner, 2026-10-14). The seeding
# that prevents it lives where a repository's first commit is made
# (`init-folio`, and `seed-main-if-remote-empty.ts`), because a repository
# that has this hook has already been pushed. What a session CAN do is notice,
# so the owner fixes it in settings before the next pull request targets the
# wrong base. One `ls-remote`; read-only; never fails the session.
SESSION_GIT_ROOT="$(git -C "${CLAUDE_PROJECT_DIR:-$PWD}" rev-parse --show-toplevel 2>/dev/null || true)"
if [ -n "$SESSION_GIT_ROOT" ] && git -C "$SESSION_GIT_ROOT" remote 2>/dev/null | grep -qx origin; then
  REMOTE_HEADS="$(timeout 20 git -C "$SESSION_GIT_ROOT" ls-remote --symref origin HEAD refs/heads/main 2>/dev/null || true)"
  REMOTE_DEFAULT="$(printf '%s\n' "$REMOTE_HEADS" | sed -n 's#^ref: refs/heads/\(.*\)[[:space:]]HEAD$#\1#p')"
  if [ -n "$REMOTE_DEFAULT" ] && [ "$REMOTE_DEFAULT" != "main" ] \
    && printf '%s\n' "$REMOTE_HEADS" | grep -q '[[:space:]]refs/heads/main$'; then
    REMOTE_URL="$(git -C "$SESSION_GIT_ROOT" remote get-url origin 2>/dev/null | sed -E 's#^git@github.com:#https://github.com/#; s#\.git$##; s#^https?://[^/]*/git/#https://github.com/#')"
    echo "## origin's default branch is \`$REMOTE_DEFAULT\`, not \`main\`"
    echo ""
    echo "- Pull requests and the site's publish step read the default branch. Ask the owner to set it to \`main\`: $REMOTE_URL/settings → Default branch."
    echo ""
  fi
fi

REPO_ROOT="$(bash "$(dirname "${BASH_SOURCE[0]}")/lib/harness-root.sh")"
# THE REPOSITORY ROOT, which `REPO_ROOT` is NOT.
#
# `REPO_ROOT` is `scripts/..` — the INSTANCE root (`cat-harness/`) since the
# split moved `scripts/` under it. That is right for every `$REPO_ROOT/scripts/…`
# below, and WRONG for the data directories that live at the repository root.
# Two call sites read it as the checkout and silently skipped (bean `46uh`):
#
#   - `cat-harness/memory/interaction.json` — the accessibility profile this sweep
#     prints FIRST by design, citing WCAG 2.2 SC 3.3.7. It has not printed
#     since the split, and it fails inside `if [ -f ]`, so the section simply
#     did not appear. A preference that reaches nobody is a preference the
#     person is asked for again.
#   - `beans/` in the CLI-absent fallback, which also globbed `beans/*.md`
#     when the defs are at `beans/defs/`. Doubly wrong, and invisible because
#     the fallback only runs when `beans` fails to install.
#
# The `## Running processes` block already compensated with an inline
# `$REPO_ROOT/..` — one call site knowing is how the other two went unnoticed.
# One name, one answer.
CHECKOUT_ROOT="$(cd "$REPO_ROOT/.." 2>/dev/null && pwd || echo "$REPO_ROOT")"
cd "$REPO_ROOT"

# Repo-scoped lock so parallel workspaces of the *same* repo don't all fetch at
# once, without serialising unrelated repos that share this generic script.
lock_id="$(printf '%s' "$REPO_ROOT" | cksum | cut -d' ' -f1)"
exec 200>"/tmp/folio-coord-sweep-${lock_id}.lock"
flock 200 2>/dev/null || true

# ── 0. How to talk to the person here ───────────────────────────────────────
# Printed FIRST and before the work-plan, because it changes the form of every
# question that follows. A preference re-learned each session is a question
# asked twice, which is WCAG 2.2 SC 3.3.7 (Redundant Entry) — and for a user
# who types with difficulty, "just ask again" is not a small cost.
# See skills/conduct/conduct-core/interaction-modality.md.
INTERACTION="$CHECKOUT_ROOT/cat-harness/memory/interaction.json"
if [ -f "$INTERACTION" ]; then
  echo "## Interaction preferences"
  echo
  if command -v jq >/dev/null 2>&1; then
    # WHO is typing (owner 2026-10-06): entries are keyed by GitHub handle with
    # optional aliases, and a person may hold several Claude accounts, so match
    # every identity this session can see. No match is a THIRD state, not "no
    # preferences": say so and apply the strictest profile on record, so an
    # accommodation is never lost to an account switch.
    # The GitHub login first, resolved by the authentication Tool's own
    # resolver (`bun run cat auth:login`, auth_whoami's githubIdentity): the
    # handle is the key, and asking GitHub is the auth process's job.
    # Provider-neutral since bean f1e1 (owner 2026-10-10): `auth:login --all`
    # prints every identity the session can see — GitHub, GitLab CI, the agent
    # host's account, the user-level config, the git author — each bare and
    # as `provider:handle`, so an entry may alias `gitlab:<handle>` too.
    ID_KEYS=""
    if command -v bun >/dev/null 2>&1; then
      ID_KEYS=$(cd "$CHECKOUT_ROOT" && timeout 8 bun run --silent cat auth:login --all 2>/dev/null || true)
    fi
    WHO_IDS=$(printf '%s\n' "$ID_KEYS" "${CLAUDE_CODE_USER_EMAIL:-}" "${GITHUB_ACTOR:-}" $(printf '%s' "${CAT_HARNESS_PERSON:-}" | tr ',' ' ') "$(git config user.email 2>/dev/null)" "$(git config user.name 2>/dev/null)" | grep -v '^$' | jq -R . | jq -s .)
    jq -r --argjson ids "$WHO_IDS" '
      def line($k; $v): "- **\($k)** — profiles: \($v.profiles | join(", ") | if . == "" then "(none)" else . end)  \n  \($v.note // "")  \n  _source: \($v.source // "unrecorded")_";
      (.users // {}) as $u
      | [ $u | to_entries[] | select(([.key] + (.value.aliases // [])) as $names | any($ids[]; . as $i | $names | index($i))) ] as $hit
      | if ($hit | length) > 0 then
          (if ($hit | length) > 1
            then "**This session matches several people: " + ($hit | map(.key) | join(", ")) + ". Apply the STRICTEST of their profiles to every question, not the first one listed (set `CAT_HARNESS_PROFILE` or `CAT_HARNESS_PERSON` to say which):**"
            else "**This session is " + ($hit | map(.key) | join(", ")) + " — apply this to every question:**" end), ($hit[] | line(.key; .value))
        else
          ([ $u | to_entries[] | select((.value.profiles | length) > 0) ] | sort_by(-(.value.profiles | length))) as $strict
          | if ($strict | length) > 0 then
              "**Could not determine who is typing** (no entry matches this session'"'"'s login, GitHub actor or git author). Apply the STRICTEST profile on record until told otherwise:", line($strict[0].key; $strict[0].value)
            else
              "- Nobody on record has stated a preference."
            end
        end
    ' "$INTERACTION" 2>/dev/null || echo "- (could not parse $INTERACTION — read it by hand)"
  else
    echo "- jq not installed; read \`cat-harness/memory/interaction.json\` by hand."
  fi
  echo
fi
# The user-level store (bean f1e1, owner 2026-10-10): preferences that are not
# repository content live per machine, never committed. Same path rule as
# `userConfigPath` in src/core/identity.ts.
USER_ID_CONFIG="${CAT_HARNESS_USER_CONFIG:-${XDG_CONFIG_HOME:-$HOME/.config}/cat-harness/identity.json}"
if [ -f "$USER_ID_CONFIG" ] && command -v jq >/dev/null 2>&1; then
  USER_PREFS=$(jq -r 'select(.interaction) | .interaction | to_entries[] | "- **\(.key)**: \(.value | if type == "string" then . else tojson end)"' "$USER_ID_CONFIG" 2>/dev/null) \
    || USER_PREFS="- (could not parse $USER_ID_CONFIG — read it by hand)"
  if [ -n "$USER_PREFS" ]; then
    echo "## Interaction preferences — this machine's user config (not committed)"
    echo
    echo "$USER_PREFS"
    echo
  fi
fi

# ── 0b. WHICH LANGUAGE to talk to them in ───────────────────────────────────
# A separate question from the FORM above, and one that was decided by accident
# until bean `46uh`: the skills are English, the corpus is English, so an agent
# answered in English without ever asking whether that was right. Printed here
# so "never determined" is visible rather than silent.
# See skills/conduct/conduct-core/communication-language.md.
echo "## Communication language"
echo
if command -v jq >/dev/null 2>&1 && [ -f "$INTERACTION" ]; then
  LANGS=$(jq -r '(.users // {}) | to_entries[] | select(.value.language) | "- **\(.key)** speaks **\(.value.language)** _(source: \(.value.source // "unrecorded"))_"' "$INTERACTION" 2>/dev/null)
  if [ -n "$LANGS" ]; then
    echo "$LANGS"
  else
    echo "- No stated preference on record. Determine it from the person's own turns;"
    echo "  fall through to the instance's \`defaultLocale\` only after saying so."
  fi
else
  echo "- Could not read \`cat-harness/memory/interaction.json\` — determine from the conversation."
fi
echo
# The model's languages are ONE INPUT and never the answer: a model strong in a
# language the person cannot read is worse than the fallback. Only
# `human-validated` entries are ever read.
if [ -f "$CHECKOUT_ROOT/bootstrap/models/models.json" ] && command -v jq >/dev/null 2>&1; then
  MODELS=$(jq -r '[.models[]? | select(.validation == "human-validated")] | length' "$CHECKOUT_ROOT/bootstrap/models/models.json" 2>/dev/null || echo 0)
  if [ "$MODELS" = "0" ]; then
    echo "- No model declares human-validated languages, so that input is absent (not English)."
  else
    echo "- $MODELS model(s) declare human-validated languages — an INPUT to the choice, never the answer."
  fi
  echo
fi

# ── 1. Work-plan (beans) ────────────────────────────────────────────────────
# `beans/defs`, not `beans/` — the defs are one level down, as
# `beans/beans.json` declares. The old glob found nothing and reported an
# empty work plan, on the one path that exists for a container with no CLI.
BEANS_DIR="$CHECKOUT_ROOT/beans/defs"
echo "## Work-plan (beans) — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo
# Get the CLI in hand rather than reporting its absence — in two steps, cheap
# first.
#
# 1. `install-beans.sh` installs to ~/.local/bin, which a fresh container's PATH
#    often does not carry, so LOOK THERE before concluding the CLI is absent.
#    Reporting "not on PATH" when the binary is sitting in the standard install
#    location is how a session ends up parsing beans/ by hand all day.
# 2. Still missing? Install it. A fresh cloud container ships no `beans` at all,
#    and the fallback below — `beans/*.md` parsed by hand — is a flat list with
#    no priming, no milestone nesting and no `beans check`. That degraded view
#    was what every such session actually got, which is not the same as having
#    the work plan.
#
# Bounded and quiet: one `go install` over the module proxy, 180 s. A sandbox
# with no Go or no egress falls through to the reader below rather than failing
# the sweep — a session-start hook that exits non-zero takes the whole session's
# priming with it.
if ! command -v beans >/dev/null 2>&1 && [ -x "$HOME/.local/bin/beans" ]; then
  PATH="$HOME/.local/bin:$PATH"
  export PATH
fi

if ! command -v beans >/dev/null 2>&1 && [ -x "$REPO_ROOT/scripts/install-beans.sh" ]; then
  timeout 180 "$REPO_ROOT/scripts/install-beans.sh" >/dev/null 2>&1 || true
  # `go install` picks its bin dir from GOBIN/GOPATH, which may not be on this
  # shell's PATH, so look where it actually went before giving up on it.
  for candidate in "${GOBIN:-}" "${GOPATH:+$GOPATH/bin}" "$HOME/go/bin" "$HOME/.local/bin"; do
    [ -n "$candidate" ] || continue
    if [ -x "$candidate/beans" ]; then PATH="$candidate:$PATH"; export PATH; break; fi
  done
fi

if command -v beans >/dev/null 2>&1; then
  beans prime 2>/dev/null || true
  beans list 2>/dev/null || echo "_(beans list returned nothing)_"

  # The roadmap, not just the list. `beans list` is flat: on this repo it is
  # 100+ ids in creation order, which is data rather than a plan. `beans roadmap`
  # renders the milestone/epic structure an agent needs to say what is NEXT and
  # why — the judgement AGENTS.md asks for in every end-of-turn report.
  echo
  echo "### Roadmap (milestones and epics)"
  echo
  roadmap="$(timeout 20 beans roadmap 2>/dev/null || true)"
  if [ -n "$roadmap" ]; then
    printf '%s\n' "$roadmap"
  else
    echo "_(no milestones or epics yet — \`beans create \"…\" -t milestone\` opens one)_"
  fi
  echo

  # Commands for the PERSON, not the agent. An agent cannot run an interactive
  # TUI on someone's behalf, so the only useful thing to do with `beans tui` is
  # print it where they will see it. Paths follow the author's convention.
  cat <<'BEANCMDS'
### Beans — commands you can run yourself

| what you want | command |
|---|---|
| the interactive board | `beans tui` |
| the milestone roadmap | `beans roadmap` |
| everything open | `beans list -s todo -s in-progress` |
| one bean in full | `beans show <id>` |
| claim one | `beans update <id> -s in-progress` |
| open one | `beans create "title" -t task` |
| sanity-check the store | `beans check` |

BEANCMDS
  # Copy-paste line. Both the checkout path and the branch are COMPUTED, never
  # written in: a literal path or a session's branch name baked into a generic
  # platform script is the genericity failure this repo has paid for repeatedly
  # (see AGENTS.md on generate-readme.sh). BEANS_CHECKOUT_ROOT lets an author
  # whose clones live somewhere predictable get a line they can paste from any
  # directory; unset, it uses this checkout's real path.
  _repo_name="$(basename "$REPO_ROOT")"
  _checkout_dir="$REPO_ROOT"
  if [ -n "${BEANS_CHECKOUT_ROOT:-}" ]; then
    _checkout_dir="${BEANS_CHECKOUT_ROOT%/}/$_repo_name"
  fi
  _branch="$(git -C "$REPO_ROOT" symbolic-ref --short HEAD 2>/dev/null || true)"
  echo "Copy-paste, from a fresh shell:"
  echo
  echo '```sh'
  if [ -n "$_branch" ]; then
    echo "reset; cd $_checkout_dir && git fetch && git switch $_branch && git pull && beans tui"
  else
    # Detached HEAD: a `git switch` line here would name a branch that is not
    # what is checked out, which is worse than omitting it.
    echo "reset; cd $_checkout_dir && git fetch && git pull && beans tui"
  fi
  echo '```'
  echo
elif [ -d "$BEANS_DIR" ]; then
  # An IMPERATIVE, not a parenthetical. The old wording tucked the remedy
  # inside an aside, and a session on 2026-09-18 read it, carried on parsing
  # beans/ by hand, and did an entire session's durable work unclaimed —
  # which is the exact failure the work-plan exists to prevent.
  echo "> 🫘 **BEANS CLI IS NOT INSTALLED. Install it before doing durable work:**"
  echo ">"
  echo "> \`\`\`sh"
  echo "> cat-harness/scripts/install-beans.sh && export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo "> \`\`\`"
  echo ">"
  echo "> Until then the list below is parsed from \`beans/\` directly: titles and"
  echo "> statuses only, with no bodies, no priorities and no blocking relations —"
  echo "> so it cannot tell you what an item actually is or what it waits on."
  echo ">"
  echo "> **But you are NOT read-only.** \`cat-harness/scripts/beans-fallback.ts\` writes the same"
  echo "> store in the same layout, so work done here is claimed, not unclaimed:"
  echo ">"
  echo "> \`\`\`sh"
  echo "> bun run cat beans:fallback list --status todo"
  echo "> bun run cat beans:fallback show <id>"
  echo "> bun run cat beans:fallback claim <id>"
  echo "> bun run cat beans:fallback create \"<title>\" --status in-progress"
  echo "> bun run cat beans:fallback note <id> \"<what you found>\""
  echo "> \`\`\`"
  echo ">"
  echo "> There is no excuse for unclaimed durable work when the CLI is missing."
  echo
  found=0
  for f in "$BEANS_DIR"/*.md; do
    [ -f "$f" ] || continue
    found=1
    title=$(sed -n 's/^# //p' "$f" 2>/dev/null | head -1)
    status=$(grep -m1 -iE '^(status|state):' "$f" 2>/dev/null | sed 's/^[^:]*:[[:space:]]*//')
    printf -- '- %s%s\n' "${title:-$(basename "$f" .md)}" "${status:+ [$status]}"
  done
  if [ "$found" -eq 0 ]; then echo "_(no beans found in beans/)_"; fi
else
  echo "_(no beans/ store and no beans CLI — nothing to prime; see AGENTS.md)_"
fi
echo

# ── 2. Branch / default-branch delta ────────────────────────────────────────
CURRENT_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || echo DETACHED)"

# Resolve the default branch generically (origin/HEAD), fall back to main.
DEFAULT_BRANCH="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@')"
[ -n "$DEFAULT_BRANCH" ] || DEFAULT_BRANCH=main

# Fetch with an EXPLICIT refspec. `git fetch origin <branch>` writes FETCH_HEAD
# and updates refs/remotes/origin/<branch> only opportunistically — it does so
# when the configured remote.origin.fetch covers that branch, and silently does
# not when it doesn't. A clone whose refspec has been narrowed (this container
# had a qou clone pinned to one sibling branch) then answers every question
# below from a tracking ref that has not moved for days, while the fetch itself
# exits 0. See bean 9giz.
if ! git fetch origin "+refs/heads/$DEFAULT_BRANCH:refs/remotes/origin/$DEFAULT_BRANCH" >/dev/null 2>&1; then
  echo "## Coord sweep"
  echo
  echo "_origin/$DEFAULT_BRANCH fetch failed (offline?). Branch: \`$CURRENT_BRANCH\`._"
  exit 0
fi

NEW_ON_DEFAULT="$(git rev-list --count "HEAD..origin/$DEFAULT_BRANCH" 2>/dev/null || echo 0)"

echo "## Coord sweep"
echo
echo "**Branch:** \`$CURRENT_BRANCH\` · **origin/$DEFAULT_BRANCH ahead by:** $NEW_ON_DEFAULT commit(s) since divergence."
echo

if [ "${NEW_ON_DEFAULT:-0}" -gt 0 ] 2>/dev/null; then
  echo "**Recent landings on \`$DEFAULT_BRANCH\` (last 10):**"
  git log --oneline "HEAD..origin/$DEFAULT_BRANCH" 2>/dev/null | head -10 | sed 's/^/- /'
  echo
fi

# ── 3. Recent sibling agent branches ────────────────────────────────────────
# This reads the remote-tracking tree directly, so unlike §2 it cannot be
# repaired by fetching one branch harder: if the clone's refspec does not cover
# refs/heads/*, that tree is empty and "no siblings" means "never fetched any".
# An empty section is the same shape as a quiet repo, so say which one it is.
if git config --get-all remote.origin.fetch 2>/dev/null | grep -q 'refs/heads/\*'; then
  RECENT_SIBLINGS="$(git for-each-ref --sort=-committerdate \
    --format='%(refname:short) %(committerdate:relative) %(subject)' \
    refs/remotes/origin/claude 2>/dev/null \
    | grep -v "$CURRENT_BRANCH" \
    | head -8 || true)"

  if [ -n "$RECENT_SIBLINGS" ]; then
    echo "**Recent sibling \`claude/*\` branches:**"
    echo "$RECENT_SIBLINGS" | sed 's/^/- /'
    echo
  fi
else
  echo "**Sibling branches: not visible from this clone.**"
  echo
  echo "\`remote.origin.fetch\` does not cover \`refs/heads/*\`, so"
  echo "\`refs/remotes/origin/claude/*\` is whatever was fetched by name — not the"
  echo "set of sibling branches. Treat this section as unread, not as empty."
  echo
  echo "Restore it with:"
  echo '```sh'
  echo "git config --replace-all remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'"
  echo "git fetch origin --prune"
  echo '```'
  echo
fi

# ── 3-bis. CI health ────────────────────────────────────────────────────────
#
# docs-site.yml fired on every push to main and failed all 30 times over two
# months; the published site sat stale and nothing in the repo said so (bean
# xom7). A red workflow and a green one look identical from in here, so the
# outcome has to be printed where attention already goes — which is this file.
#
# Best-effort and bounded: one API call, short timeout, and a failure to reach
# the API prints as UNKNOWN rather than being omitted. An absent section reads
# as "fine", which is the defect this is here to fix.
if command -v bun >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/check-ci-health.ts" ]; then
  if ! timeout 25 bun run "$REPO_ROOT/scripts/check-ci-health.ts" --markdown 2>/dev/null; then
    echo "## CI health"
    echo
    echo "**Not checked — treat as unknown, not as green.** The health check did not"
    echo "complete (no network, no bun, or the API refused). Run it by hand:"
    echo
    echo '```sh'
    echo "bun run cat check:ci-health"
    echo '```'
    echo
  fi
fi

# ── 3-ter. Bun runtime vs the pin ───────────────────────────────────────────
#
# Bean `3ozg` pinned Bun at `.bun-version` and at all 22 `setup-bun` sites.
# Bean `p3zo`: agent containers default to 1.4.2 instead of `.bun-version` (1.3.14),
# causing local tool drift (e.g. navbar-assets minification differences).
# Check if bun --version matches .bun-version; if it differs, install the pinned
# version into $HOME/.local/bin/bun via npm pack, and prepend to PATH.
#
# THIS SECTION'S ORIGINAL PURPOSE IS THEREFORE DISCHARGED, and the claim it
# carried — that a mismatched bun rewrites 72 of 86 sidecars on every sweep,
# so discard them before committing — is retracted. Measured after merging
# #1452: 0 rewritten, where this container had produced 72.
#
# It is kept for the smaller facts that are still true, and that an agent
# cannot read off its own tree: that it is not running the bun CI will judge
# its push with, and that a checker changed here stamps its sidecar with the
# older local engine. `check:bun-runtime`'s module header carries both.
#
# NOTE THE INVERTED EXIT CONVENTION, which is why this does not copy the CI
# health block above. `check:bun-runtime` exits 1 on a real mismatch — the
# finding IS the news — and 2 when it cannot tell. Treating non-zero as
# "could not check", as the adjacent block correctly does for its own script,
# would swallow exactly the message this exists to deliver. So it keys on EMPTY
# OUTPUT instead, and an empty result is reported as unknown rather than matched.

# Ensure ~/.local/bin is first on PATH if bun was installed there previously
if [ -x "$HOME/.local/bin/bun" ]; then
  case ":$PATH:" in
    *":$HOME/.local/bin:"*) ;;
    *) PATH="$HOME/.local/bin:$PATH"; export PATH ;;
  esac
fi

bun_pin_file=""
if [ -f "$CHECKOUT_ROOT/.bun-version" ]; then
  bun_pin_file="$CHECKOUT_ROOT/.bun-version"
elif [ -f "$REPO_ROOT/.bun-version" ]; then
  bun_pin_file="$REPO_ROOT/.bun-version"
elif [ -f "$CHECKOUT_ROOT/cat-harness/.bun-version" ]; then
  bun_pin_file="$CHECKOUT_ROOT/cat-harness/.bun-version"
fi

pinned_bun=""
if [ -n "$bun_pin_file" ]; then
  pinned_bun="$(tr -d ' \t\r\n' < "$bun_pin_file" 2>/dev/null || true)"
fi

current_bun=""
if command -v bun >/dev/null 2>&1; then
  current_bun="$(bun --version 2>/dev/null | tr -d ' \t\r\n' || true)"
fi

if [ -z "$pinned_bun" ]; then
  echo "## Bun runtime alignment"
  echo
  echo "**Could not determine pinned Bun version:** \`.bun-version\` was not found or is empty."
  echo
elif [ "$current_bun" != "$pinned_bun" ]; then
  if [ -x "$REPO_ROOT/scripts/install-bun.sh" ]; then
    install_out=$(timeout 120 "$REPO_ROOT/scripts/install-bun.sh" "$pinned_bun" 2>&1 || true)
    if [ -x "$HOME/.local/bin/bun" ] && [ "$("$HOME/.local/bin/bun" --version 2>/dev/null | tr -d ' \t\r\n')" = "$pinned_bun" ]; then
      case ":$PATH:" in
        *":$HOME/.local/bin:"*) ;;
        *) PATH="$HOME/.local/bin:$PATH"; export PATH ;;
      esac
      echo "## Bun runtime aligned (folio-assistant-p3zo)"
      echo
      echo "Installed pinned Bun **${pinned_bun}** into \`$HOME/.local/bin/bun\` (replaced ${current_bun:-uninstalled})."
      echo "Prepend \`\$HOME/.local/bin\` first on PATH for this session."
      echo
      current_bun="$pinned_bun"
    elif [ -x "$CHECKOUT_ROOT/.local/bin/bun" ] && [ "$("$CHECKOUT_ROOT/.local/bin/bun" --version 2>/dev/null | tr -d ' \t\r\n')" = "$pinned_bun" ]; then
      case ":$PATH:" in
        *":$CHECKOUT_ROOT/.local/bin:"*) ;;
        *) PATH="$CHECKOUT_ROOT/.local/bin:$PATH"; export PATH ;;
      esac
      echo "## Bun runtime aligned (folio-assistant-p3zo)"
      echo
      echo "Installed pinned Bun **${pinned_bun}** into \`$CHECKOUT_ROOT/.local/bin/bun\` (replaced ${current_bun:-uninstalled})."
      echo "Prepend \`\$CHECKOUT_ROOT/.local/bin\` first on PATH for this session."
      echo
      current_bun="$pinned_bun"
    else
      echo "## Bun runtime alignment warning"
      echo
      echo "**Could not align Bun to pin ${pinned_bun}:** install script failed or produced unexpected version."
      echo "Output: \`${install_out}\`"
      echo "Container Bun (${current_bun:-uninstalled}) remains in place."
      echo
    fi
  else
    echo "## Bun runtime alignment warning"
    echo
    echo "**Could not align Bun to pin ${pinned_bun}:** \`cat-harness/scripts/install-bun.sh\` is missing."
    echo "Container Bun (${current_bun:-uninstalled}) remains in place."
    echo
  fi
fi

bun_rt_script=""
if [ -f "$REPO_ROOT/scripts/check-bun-runtime.ts" ]; then
  bun_rt_script="$REPO_ROOT/scripts/check-bun-runtime.ts"
elif [ -f "$CHECKOUT_ROOT/cat-harness-tools/scripts/check-bun-runtime.ts" ]; then
  bun_rt_script="$CHECKOUT_ROOT/cat-harness-tools/scripts/check-bun-runtime.ts"
elif [ -f "$CHECKOUT_ROOT/../cat-harness-tools/scripts/check-bun-runtime.ts" ]; then
  bun_rt_script="$CHECKOUT_ROOT/../cat-harness-tools/scripts/check-bun-runtime.ts"
fi

if command -v bun >/dev/null 2>&1 && [ -n "$bun_rt_script" ]; then
  bun_rt_out=$(timeout 20 bun run "$bun_rt_script" --markdown 2>/dev/null || true)
  if [ -n "$bun_rt_out" ]; then
    printf '%s\n' "$bun_rt_out"
    echo
  else
    echo "## Bun runtime vs the pin"
    echo
    echo "**Could not check — treat as unknown, not as matched.** \`bun\` is present but"
    echo "\`check:bun-runtime\` produced nothing. Run it by hand:"
    echo
    echo '```sh'
    echo "bun run cat check:bun-runtime"
    echo '```'
    echo
  fi
fi

# ── 3b. Declared directories exist ──────────────────────────────────────────
# A declared-but-absent directory is the bean `dh4f` defect: absent and empty
# are indistinguishable to a consumer, so the declaration turns a real gap into
# a clean run. The sharp case is ingestion — the corpus checklist greps
# `library/` and not `uploads/`, so a missing `library/` reads as "nobody has
# ingested anything". Cheap, quiet, and idempotent: it creates only what is
# missing and writes a keep-marker only into a directory that would otherwise
# be empty.
if command -v bun >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/harness-dirs.ts" ]; then
  dirs_out=$(timeout 20 bun run "$REPO_ROOT/scripts/harness-dirs.ts" 2>/dev/null || true)
  # Print only when it actually did something — a clean run is not news, and
  # the sweep is already long. "Could not check" is not silence either: an
  # empty result means bun or the declaration failed, and that is said.
  if [ -z "$dirs_out" ]; then
    echo "## Declared directories"
    echo
    echo "Could not check (bun present but \`cat-harness/scripts/harness-dirs.ts\` produced nothing)."
    echo "Run it by hand: \`bun run cat harness:dirs\`."
    echo
  elif ! printf '%s' "$dirs_out" | grep -q '0 created\.'; then
    echo "## Declared directories — created what was missing"
    echo
    echo '```'
    printf '%s\n' "$dirs_out"
    echo '```'
    echo
  fi
fi

# ── 3c. Running process instances ───────────────────────────────────────────
# Bean `vlhk`. 54 proposals merged in one four-hour window and the declared
# `workflow-state` graph held only `.gitkeep` — not one session recorded a
# running instance, so a reviewer could not classify a single session by lane.
# The owner settled it 2026-09-20: the processes are REAL and the instance is
# recorded, which makes "none recorded" a finding rather than the silence it
# had been for 54 merges.
#
# It is deliberately NOT a failure. Plenty of turns are legitimately outside
# any process; the point is that the sweep SAYS so, so the agent answers which
# rather than never being asked. A directory that cannot be read is a third
# state and says so, because "no instances" and "could not look" are the two
# things this check exists to keep apart.
wf_dir="$CHECKOUT_ROOT/beans/workflows"
echo "## Running processes"
echo
if [ ! -d "$wf_dir" ]; then
  echo "**Could not check — treat as unknown, not as none.** No \`beans/workflows/\`"
  echo "directory. Run \`bun run cat harness:dirs\` to create what the declaration names."
else
  wf_n=$(find "$wf_dir" -maxdepth 1 -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
  if [ "$wf_n" = "0" ]; then
    echo "**No instance recorded.** If this turn runs a process, start it"
    echo "(\`workflow_start\`) so the state is committed and a sibling session reads the"
    echo "same position — \`skills/process/workflow/process-state.md\` §\"Naming it is not the same"
    echo "as recording it\". If it does not, say so in the turn report."
  else
    echo "$wf_n instance(s) recorded:"
    echo
    echo '```'
    find "$wf_dir" -maxdepth 1 -name '*.json' -exec basename {} \; 2>/dev/null | sort
    echo '```'
  fi
fi
echo

# ── 3d. Sibling sessions waiting on a person ────────────────────────────────
# Bean `rq8s`. Four sessions were stopped holding a question in the owner's own
# terms, and the only reason anybody learned that was an agent querying the
# session API by hand. The signal is not missing -- `session_status` carries
# `REQUIRES_ACTION` and `task_summary` carries the question verbatim -- so the
# defect is that NOTHING AGES OR AGGREGATES IT.
#
# `check:session-staleness` does both, and this sweep cannot run it, which is
# the finding rather than an omission. Probed 2026-09-21 from inside a session
# container: no session credential in the environment,
# `api.anthropic.com/v1/sessions` -> 401, `claude.ai/api/code/sessions` -> 403.
# `list_sessions` is an MCP tool the AGENT holds, not an endpoint a shell can
# call. Wiring a fetch in here would produce a check that examines nothing and
# reports a clean run over everything -- the `dh4f` defect, in the tool written
# to stop one.
#
# So the input is asked for by NAME, and NOT asking is `unknown` rather than
# "no sessions are waiting". Same shape as `## Running processes` above: the
# sweep cannot decide it, so it makes sure the question is put.
echo "## Sibling sessions waiting on a person"
echo
cat <<'SESSIONS'
**Not checked by this script, and that is not "none".** The listing comes from
an MCP tool only an agent holds (`list_sessions`), so a shell cannot fetch it:
probed 2026-09-21, `api.anthropic.com/v1/sessions` → 401 and
`claude.ai/api/code/sessions` → 403. A fetch wired in here would examine
nothing and report every session clean.

**Run it yourself, once, early in the turn:**

1. Call `list_sessions` (`mine: true`, `limit: 50` or more).
2. Save the payload and pipe it in — the reader takes either a `{"ccr":{"data":[…]}}`
   envelope or a bare array:

   ```sh
   bun run cat check:session-staleness <listing.json>
   ```

3. **Report what it says, including the `task_summary` it prints.** A count
   cannot be acted on; these questions are usually answerable in a sentence.
   If you could not obtain the listing, say `unknown` — never "none waiting".

Three classes, each with its threshold's basis, in `src/sessions/staleness.ts`:
a session in `REQUIRES_ACTION` past 72 h; a `FAILED` session carrying `unread`
past 24 h; and one whose bucket says `BLOCKED` while its status says `IDLE`,
which is NAMED separately because waiting and abandoned cannot be told apart
from the listing.

A run that read a listing leaves a **last-checked mark** on the state branch
(owner ruling 2026-10-10, bean `rq8s`); commit it with the store, so the next
sweep can tell "checked" from "skipped". The mark as this sweep reads it:
SESSIONS
echo
# The mark, read back. Bean `rq8s`: without it a skipped step is
# indistinguishable from a clean one once the terminal scrolls. Every answer
# but a mark is said as itself -- an unmounted store is "could not determine",
# never "not checked".
mark_out="$(cd "$CHECKOUT_ROOT" && timeout 20 bun run "$REPO_ROOT/scripts/sweep-mark.ts" --read session-staleness --root "$CHECKOUT_ROOT" 2>&1)" || true
echo "> ${mark_out:-Could not determine: the mark reader printed nothing.}"
echo

# ── 3.5 The state-branch mount ──────────────────────────────────────────────
# Bean `2h76` part 4. Printed BEFORE the recommended action because it changes
# whether the work-plan above can be believed.
#
# The proposal names the failure this guards: if the fetch fails silently and
# `beans list` comes back empty, the agent reads "no work" — an unreachable
# work-plan and an empty one are indistinguishable from here, and the agent
# acts on the first reading. So the mount prints its own finding, loudly, and
# `state-mount.ts` also exits non-zero so a wrapper cannot swallow it.
#
# No declaration is tip-keyed yet, so today this says "not enabled" and costs
# one process. Guarded on `bun` because this sweep is CLI-independent by
# design and must still work where only git is present.
#
# The REMOTE MOUNTS go first (bean `nn8e`, #2462): `bootstrap/` and
# `bootstrap-tools/` are no longer submodules, and `state-mount.ts` cannot even
# load without `bootstrap-tools`. `mount-from-lock.ts` replays the committed
# lock with `node:*` only, so it runs on a fresh clone.
if command -v bun >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/mount-from-lock.ts" ]; then
  lock_out="$(cd "$CHECKOUT_ROOT" && bun run "$REPO_ROOT/scripts/mount-from-lock.ts" --root "$CHECKOUT_ROOT" 2>&1)" || true
  case "$lock_out" in
    *"not-enabled"*|*"— OK"*) ;;
    *) printf '%s\n\n' "$lock_out" ;;
  esac
fi
if command -v bun >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/state-mount.ts" ]; then
  mount_out="$(cd "$CHECKOUT_ROOT" && bun run "$REPO_ROOT/scripts/state-mount.ts" 2>&1)" || true
  if [ -n "$mount_out" ]; then
    printf '%s\n\n' "$mount_out"
  fi
fi

# ── 3.55 Bean tags ──────────────────────────────────────────────────────────
# Bean `ujiv` (cat-harness#88). Every bean is a `bean/1.0.0` node kind and says
# so in its front matter, but `beans update` drops the `$schema` key and
# `beans create` never writes it. So the tag is put back here, AFTER the mount
# above has put the store on disk, and again by the pre-commit hook and by
# `state:push`. Quiet unless it changed something or could not run.
# Beside this script, not under `$REPO_ROOT`: that is the HARNESS root, and
# since 70lx the scripts live in cat-harness-tools.
retag_script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/beans-retag.ts"
if command -v bun >/dev/null 2>&1 && [ -f "$retag_script" ]; then
  retag_out="$(cd "$CHECKOUT_ROOT" && bun run "$retag_script" --quiet 2>&1)" || true
  if [ -n "$retag_out" ]; then
    printf '%s\n\n' "$retag_out"
  fi
fi

# ── 3.6 The seeds' freshness ────────────────────────────────────────────────
# Bean `9ofm`, row C. Owner, 2026-10-03: wire it here rather than into CI.
#
# Reading the branch is the whole job, so this needs the network — which is
# why it is HERE and not a gate: `check:declared-dirs` and `audit:coverage`
# are offline by construction, and a gate that can go red because a fetch
# failed teaches people to re-run gates until they pass. This sweep already
# does network work and already tolerates-and-reports.
#
# `--brief` prints the finding and nothing else, and nothing at all when every
# seed is current. The full report lists every differing path, and the
# superseded `cat/cat-harness/state` alone carried 159 of them — in a sweep
# whose whole job is to be read, that would bury the rest of it.
#
# Unlike 3.5 this is NOT a reason to disbelieve the work-plan above: `main` is
# still the store, so a stale seed breaks nothing today. It breaks the
# cutover. The printed block says so, so a reader does not over-read it.
if command -v bun >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/state-drift.ts" ]; then
  drift_out="$(cd "$CHECKOUT_ROOT" && bun run "$REPO_ROOT/scripts/state-drift.ts" --brief 2>&1)" || true
  if [ -n "$drift_out" ]; then
    printf '%s\n\n' "$drift_out"
  fi
fi

# ── 4. Recommended action (generic) ─────────────────────────────────────────
cat <<'EOF'
**Recommended action:**

1. **Install the beans CLI if the section above says it is missing** —
   `cat-harness/scripts/install-beans.sh && export PATH="$HOME/.local/bin:$PATH"`. Do this
   FIRST: claiming and creating beans is not possible without it, and a
   session that skips it does its work unclaimed.
2. If you'll do durable work, claim a bean
   (`beans update <id> --status in-progress`) or open one
   (`beans create "<title>"`, after the exact-title existence check in
   AGENTS.md) — see also `work-plan/skills/work-plan/bean-coordination.md`, whose
   "A claim is branch-local" says what a claim does NOT buy you.
3. If the default branch moved, dispatch a **background** subagent to triage the
   new landings + sibling activity above — don't do it in the foreground.
   Escalate only if it surfaces something actionable against the work-plan.
4. **Run the session-staleness check** described above — `list_sessions`, then
   `bun run cat check:session-staleness`. It is the only step here whose input this
   script cannot produce, so it is the only one that silently reports nothing
   when skipped. A session that has held a question for days is the cheapest
   thing in this sweep to fix and the only one nobody else will notice.
EOF
