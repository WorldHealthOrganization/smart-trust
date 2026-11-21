#!/usr/bin/env python3
"""Run a harnessed repository's gates in a mounted index and record each exit code.

Usage: run-gates.py <index-root> <out.json> [--instance <name>]... [--record <file.json>]...

Generalised from folio-assistant-core's `.github/scripts/run-gates.py`
(14ed7ad) for `layer-pr-checks.yml`, the reusable workflow every harnessed
repository calls (owner, 2026-10-14: "1" -- one reusable workflow, not a copy
per repository). The gate set is DERIVED, never listed per repository, so a
gate added anywhere is run with no edit here. Owner, 2026-10-14: "A harnessed
repo should run not just core but all of the checks in the dependency
harness":

- **graph**: the harness's consistency checks, run over each OWN instance
  (`GRAPH_GATES` below is the only list, and it is a list of harness
  commands, not of any repository's gates).
- **declared**: for every instance in the own instances' transitive `needs`
  (from their declarations), and the own instances themselves, every script
  of its `package.json` -- `scripts` and `checkoutScripts` alike -- whose
  name starts `check:` or ends `:check`, named `<owning-instance>:<script>`.
- **checkout scripts**: the few declared scripts that judge the root's own
  files (`CHECKOUT_SCRIPTS` below), run for every caller under the same name,
  whether or not its dependency harness includes the declaring instance.

The OWN instances are the `--instance` arguments; with none, the instance the
repository declares at its root (a folio or an index with a declaration of
its own), or else every instance its `index.config.json` mounts (an IG
repository that is an index over smart-base and declares nothing itself).

Each gate's exit code, the tail of its output, and its command are written to
<out.json>. This script exits 0 whatever the gates did: the compare step
judges head against base, so a gate already red on main does not fail a PR
that did not break it. `GATE_JOBS` (default 1) runs that many at once.
Each gate's wall time is recorded as `seconds`.

`GATE_SHARD=i/N` (bean `lpcs`, step 3) runs only shard `i` of `N`: the gates
whose position in the SORTED derived set is `i-1` modulo `N`. The slice is a
function of the gate names alone, so the N shards of one side are disjoint and
their union is the whole set; unset, or `1/1`, is the whole set, as before.
The workflow gives each shard its own machine and checkout, so shards never
race; within a shard, `GATE_JOBS` > 1 runs gates side by side, and a gate whose
script holds the whole tree for its run (`TREE_TOOLS`: publish-check.ts hashes it
around its writer, the standalone probes copy it or `git init` inside it), or
runs a script that does (`skill:register:check` runs `subgraph:jsonld:check`),
runs alone after the pool drains, so a neighbour's write is never blamed on it. The skipped gates and the
`--record`ed results go in shard 1 only, so a merged side holds each once.
Beside <out.json> the run writes `gates-shard.json` -- the shard, `N`, the size
of the whole set, and the names it ran -- from which the compare job proves
every shard is present and that together they cover the set
(`merge-shards.py`). A malformed `GATE_SHARD` exits 2: guessing a slice could
silently drop gates. `--list` honours it too, and adds a `shard` field.

`--record <file.json>` merges results a workflow step already produced, in the
same shape (`{name: {command, exit, tail}}`, or `{name: {command, skipped}}`),
into <out.json>: the `derive:publish` build that runs before the gates is
judged by the compare job like one of them, so a build the PR breaks is a NEW
failure rather than a line in a log. A missing or unreadable file records the
step as `exit 2` ("could not determine"), never as nothing.

A declared gate that cannot determine anything here is not run, and is
written with a `skipped` reason in place of `exit` (owner, 2026-10-15, "b1"):
one that judges the remote's live state (`LIVE_STATE_SCRIPTS`), and one that
needs an argument or artefact this runner never supplies (`NEEDS_INPUT_SCRIPTS`).

A gate whose input this runner DOES have is given it instead
(`SUPPLIED_INPUTS`): `check:corpus-gate` gets `--since $GATE_DIFF_BASE`, the
PR's diff base, `translation:catalogue:check` gets `--base` the same commit,
and `check:test-budgets` the junit report at `$GATE_JUNIT`
that the tests step wrote. Either is skipped, with its reason, only on a side
that holds no such input.

`GATE_CONE` wires in the CI cone (`scripts/ci-cone.ts`, bean `4rbc`;
cat-harness-tools#398). Unset, nothing changes. Every declared gate run as
exactly `bun run cat <script>` is asked about, in one `ci-cone.ts decide-all`,
before any gate runs:

- `skip` (a pull request): a gate whose read set, recorded by a green traced
  run on the caller's main, is unchanged here (every path's state, every
  replayed git answer, and the script's `f017` fingerprint) is NOT run. It is
  written with `skipped: "inputs unchanged since <sha> ..."` and
  `unchanged: <sha>`, never an `exit`, so it can never read as a pass.
- `record` (a push to the caller's main): the same, and then every candidate
  that did not skip runs under `strace` by `ci-cone.ts run`, after every other
  gate: the pooled ones GATE_JOBS at once, a record a neighbour's writes may
  have met dropped and its gate run again alone (`run_traced`), the alone ones
  one at a time. The shard's
  records go to `cone-records.json` beside <out.json>. A gate that skipped
  keeps the record it matched, so main traces only what changed (bean `4rbc`,
  "a cheaper record on main").

Anything the cone cannot answer (no `ci-cone.ts` at this side's pin, no
record, no `strace`, a runner other than `bun run cat`, an error) runs the
gate, as without the cone. A skip also names the record's FOOTPRINT, the
top-level entries of the root its read set lies in, derived from the record and never
declared (owner, 2026-10-07: "derived is BEST"); a gate whose footprint is its
own instance's directory alone is reported as own-tree (cat-harness-tools#398,
2b). The footprint never skips a gate on its own: see `footprint`.
"""
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor

# Beside this file, found by its path: the tests and `python3 -I` put no
# script directory on sys.path.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# No __pycache__/ beside the module: this directory is often a MOUNTED layer,
# whose bytes a mount digest pins, and a caller passing `-I` cannot be asked
# for PYTHONDONTWRITEBYTECODE (bean cat-tools-sm8r item 4).
sys.dont_write_bytecode = True
from gate_diagnostics import diagnostics, producer  # noqa: E402

# Scoped to the instance where the check takes a scope (kg-audit, kg-export,
# import-direction). check-tools and declaration-resolution read the whole
# checkout; the base/head comparison is what attributes a change in them to
# this PR.
GRAPH_GATES = {
    "kg-audit": "bun cat-harness-tools/scripts/kg-audit.ts --instance {path}",
    "kg-export": "bun cat-harness-tools/scripts/kg-export.ts --instance {path} --out {tmp}/{instance}.jsonld",
    "import-direction": "bun cat-harness-tools/scripts/check-import-direction.ts --gate {instance}",
}
CHECKOUT_GATES = {
    "check-tools": "bun cat-harness-tools/scripts/check-tools.ts",
    "declaration-resolution": "bun cat-harness-tools/scripts/check-declaration-resolution.ts",
}
# Declared scripts that judge the ROOT's own files, run for EVERY caller, not
# only for one whose dependency harness happens to include the declaring
# instance. Script name -> the instance that declares it; the gate keeps the
# name the derived set gives it (`<instance>:<script>`), and is run once.
#   - index-config:inline:check (cat-harness-tools#222, bean `ymvt`): red
#     while index.config.json still imports a legacy `<name>.config.json`.
#     cat-harness, bootstrap and bootstrap-tools do not need cat-harness-tools,
#     so the derived set never reached them (owner, 2026-10-15: every
#     harnessed repository's PR checks run it).
#   - skill:commands:check and agent-memory:check (bean `t5zb`): check each
#     repository's own `.claude/commands/` and `.claude/agents/` + memory
#     projections, including `cat-harness` which does not need
#     `cat-harness-tools`.
CHECKOUT_SCRIPTS = {
    "agent-memory:check": "cat-harness-tools",
    "index-config:inline:check": "cat-harness-tools",
    "skill:commands:check": "cat-harness-tools",
}
# The index's own gates that read every mounted layer (`index-gates.json`, the
# one list, shared with pr-tests.yml): run for every caller too, so a layer
# below the declaring instance (cat-harness, bootstrap, bootstrap-tools) is
# judged on them with its head swapped in. A caller above it already derives
# them under the same names, so for it nothing changes but their diagnostics.
INDEX_GATES_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index-gates.json")


def index_scripts(path=INDEX_GATES_JSON):
    """script -> declaring instance, from `index-gates.json`; {} when it is absent or unreadable."""
    try:
        gates = json.load(open(path))["gates"]
    except (OSError, ValueError, KeyError, TypeError):
        return {}
    return {script: name.split(":", 1)[0] for name, script in gates.items()
            if isinstance(script, str) and ":" in name}


TIMEOUT_S = 1200
# The caller's own instances, for the checks that judge only their files
# (`scripts/lib/gate-own.ts` GATE_OWN_ENV). Owner ruling 2026-11-05, "Move the
# checks": a check of a layer's own committed files runs only in the
# repository that commits them. `check:schema-nodes` walked every declared
# `schemas/` in the root, the mounted layers' included, so a defect on
# cat-harness-tools main (#1478) was a new failure in every root mounting it
# (smart-ra#228). Given this, it judges only the caller's own `schemas/`.
GATE_OWN_ENV = "CAT_GATE_OWN_INSTANCES"
GATE_OWN_PATHS_ENV = "CAT_GATE_OWN_PATHS"
GATE_FOREIGN_PATHS_ENV = "CAT_GATE_FOREIGN_PATHS"
# Gates that judge the REMOTE's live state, not the checkout: which workflows
# are red on the default branch, whether a commit has a run, which advisories
# the registry knows today. Base and head run minutes apart, so one can flip
# between them with no change in the PR (fhir-harness#67: check:ci-health went
# red on head because a workflow on main failed in between). The compare job
# would charge that to the PR; these are reported by the session-start sweep
# and their own workflows instead. check:merged belongs here too: it fetches
# the remote's CURRENT base, merges it in a worktree and reruns every gate --
# the pre-merge check an agent runs, which this job already does on the PR's
# merge commit. On a runner it has no git identity, and in an index root it
# merges an unrelated base, so it exits 2 (smart-immunizations#35).
# post-merge:regen:check belongs here for the same reason (gates.ts
# OWN_SCRIPT_EXEMPTIONS, bean ey1c): checkPostMergeRegen reads loadGates and
# runs the :check half of every repairable writer/check pair in the gate set,
# so running it inside run-gates.py runs the gates inside the gates until the
# 1200 s timeout kills it (measured on smart-immunizations run 38819372825:
# 1200.0 s in shard 1/4, bean lpcs). Its subject is main after a merge, run by
# layer-post-merge-regen.yml.
# check:prs-have-runs lists the index's OPEN pull requests and asks whether
# each has a CI run: a fact about other PRs at the moment the job runs, so it
# moved between base and head on fhir-harness#83 (an unrelated folio-assistant
# PR was "too-new" on base and "no-run" on head).
# check:quiet-claims asks GitHub which beans an OPEN pull request or an
# unmerged branch names (`check-quiet-claim-liveness.ts`): the same kind of
# fact about other PRs. On smart-base run 38866215814 it hit the 1200 s
# timeout and exited 2 on head, judging nothing, while holding one of the
# shard's four slots for twenty minutes (cat-harness-tools#397).
LIVE_STATE_SCRIPTS = {
    "check:ci-health",
    "check:head-has-run",
    "check:dependency-advisories",
    "check:merged",
    "check:prs-have-runs",
    "check:quiet-claims",
    "health:check",
    "post-merge:regen:check",
    "secrets:check",
    # Asks upstream (`git ls-remote --tags`) whether a newer release exists:
    # the answer changes when a project upstream tags a release, not with any
    # diff, so a PR's head and its cached base answer disagree on every open PR
    # the day a release lands (a content layer, 2026-11-11: PlantUML 1.2026.10 made 20
    # committee PRs red). `gates.ts` already lists it `scheduled`; the
    # `upstream-pins.yml` watchdog in folio-assistant runs it weekly and keeps
    # its tracking issue, and a bump PR follows from that.
    "check:upstream-pins",
}
# Gates that judge the MACHINE they run on, not the checkout: a CI runner
# installs only what the gates need, so on it they report every other tool as
# missing (folio-assistant-core#287, run 41309041686).
RUNNER_STATE_SCRIPTS = {
    "software:check": "judges the software installed on the machine it runs on; a CI runner is not a workstation",
}
# Sweep forms: a script named `check:` that is NOT a gate. `gates.ts` declares
# it `kind: "report"` because it makes ADVISORY findings fatal on purpose, for a
# person sweeping coverage; the gating form beside it is what CI runs. Run here,
# an advisory (an editorial call) would fail every layer's main QA.
# Q-FMR-12 (owner, 2026-11-02): the navbar gate is not strict in CI.
SWEEP_ONLY_SCRIPTS = {
    "check:navbar-consistency:strict": "the --strict sweep that fails on advisories; CI gates on `check:navbar-consistency:check`",
}
# QA reports, not merge gates (owner, 2026-11-13: "bpmn and svg dont need to
# render to merge. that QA report"): a stale diagram drawing is reported by the
# QA refresh and the publish, never a reason to refuse a merge. The committed
# knowledge graph's JSON-LD is the opposite (compare-gates.py ALWAYS_GREEN).
QA_REPORT_SCRIPTS = {
    "render:bpmn:check": "a QA report, not a merge gate: the diagram SVGs (owner, 2026-11-13)",
}
# Gates that cannot determine anything in LAYER mode (`MODE=layer`), where the
# caller is swapped into the index without its .git and the layers are mounted
# at their own tips rather than at the index's lock (folio-assistant-core#287).
# The index's own run, where both hold, runs them.
LAYER_MODE_SCRIPTS = {
    "book:check": "reads bootstrap's COMMITTED tree (git ls-files --cached), and a mount in the index is never committed, so it sees no README",
    "check:draft-beans": "reads the root's default branch, and layer mode swaps the caller in without its .git",
    "check:standalone": "rehearses bootstrap-tools standing alone, which only its own checkout can; in the index the copy's git init fails",
    "mount:lock:check": "compares the mounts with the index's lock, and layer mode mounts each layer at its own tip, not at the lock",
    "mount:remote:check": "compares the mounts with the index's lock, and layer mode mounts each layer at its own tip, not at the lock",
    "readme-sections:check": "reads the COMMITTED tree (git ls-files --cached), and a mount in the index is never committed, so every section reads empty",
    "readmes:check": "reads the COMMITTED tree (git ls-files --cached), and a mount in the index is never committed, so every directory reads empty",
}
# cat-harness-tools#1701: the same four bootstrap-tools gates in INDEX mode,
# when the corpus they read is a lock mount the root's git does not account
# for. Each lists its subjects with git (`git-files.ts`: `gitFiles` /
# `committedFiles`), and smart-ips-pilgrimage's index root gitignores its
# mounts, so in its main run (42455839636) git listed nothing under
# `bootstrap/`: book:check "has no README.md" (exit 2), readme-sections:check
# and readmes:check judged every generated section/README against an empty
# corpus (exit 1), and check:standalone copied nothing and its `git init` ran
# in a directory never made (exit 1). None of it is this root's: the mounted
# bytes are pinned by the lock (and checked by `mount:lock:check`), and
# bootstrap/bootstrap-tools' own CI judges their READMEs. Skipped only when
# git DETERMINES it holds none of the subject's files and the subject is not
# one of the caller's own instances; a root that tracks them (bootstrap's own
# checkout, an index that commits it) runs them exactly as before, and a root
# git cannot answer for runs them too. Keyed by the declaring instance, so a
# script of the same name another instance declares is untouched.
UNTRACKED_CORPUS_SCRIPTS = {
    ("bootstrap-tools", "book:check"): ("bootstrap",),
    ("bootstrap-tools", "readme-sections:check"): ("bootstrap",),
    ("bootstrap-tools", "readmes:check"): ("bootstrap", "bootstrap-tools"),
    ("bootstrap-tools", "check:standalone"): ("bootstrap", "bootstrap-tools"),
}


def untracked_by_root(root, rel):
    """True when `rel` exists under `root` and the root's git accounts for none
    of its files (`git ls-files --cached --others --exclude-standard`, the set
    `git-files.ts` reads); None when git cannot answer; False otherwise."""
    if not os.path.isdir(os.path.join(root, rel)):
        return None
    try:
        r = subprocess.run(
            ["git", "-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", rel],
            capture_output=True, timeout=60,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if r.returncode != 0:
        return None
    return r.stdout.strip(b"\0") == b""


def untracked_corpus_reason(root, declarer, script, own):
    """The reason a committed-tree gate has no subject in this root, or None."""
    subjects = UNTRACKED_CORPUS_SCRIPTS.get((declarer, script))
    if not subjects or own is None or any(s in own for s in subjects):
        return None
    if not all(untracked_by_root(root, s) is True for s in subjects):
        return None
    return (f"reads the files git accounts for under {', '.join(f'{s}/' for s in subjects)}, and in this root "
            f"{'they are' if len(subjects) > 1 else 'it is'} a lock mount git does not track, so it would judge an "
            f"empty corpus; the pinned bytes are mount:lock:check's, and {', '.join(subjects)}' own CI judges them "
            "(cat-harness-tools#1701)")


# `check:<layer>-standalone` rehearses <layer> with only its own closure laid
# out beside it, so in another layer's index nothing the caller holds reaches
# it: its answer is a function of the lower layers' pins and the runner. That
# layer's own CI judges it (pr-tests.yml "Standalone (no new failures)"), so it
# runs only in a root whose own instances include that layer (the layer itself,
# or an index that holds it as its own). In any other root, in layer OR index
# mode, it is skipped as `other-layer` (smart-ra#213, a folio index whose run
# is not layer mode, where tools' list churned on every re-pin;
# cat-harness-tools#1299).
STANDALONE_GATE = re.compile(r"^check:(.+)-standalone$")


# Gates that judge an INPUT this runner never supplies: run bare, each prints
# its usage and exits 2 ("could not determine") on base and head alike, so it
# judges nothing about the PR -- and where base exits 1 for another reason,
# compare-gates.py rightly counts 1 -> 2 as NEW (smart-immunizations#35). Each
# entry was confirmed by reading the script and running it with no argument;
# the workflow that does supply the input runs it there.
NEEDS_INPUT_SCRIPTS = {
    "check:context-leak": "needs --dir <built context>, --tools <tools/list JSON> or --prompt <file>; bare, nothing to scan and exit 2",
    "check:duplicate-ids": "needs a built site directory; bare, it prints its usage and exits 2",
    "check:escaped-markup": "needs a built site directory (or --source <dir>); bare, it prints its usage and exits 2",
    "check:qa-corpus": "needs one of --dir <tree>, --ref <ref> or --github; bare, it prints its usage and exits 2",
    "check:session-staleness": "reads a session's state as JSON on stdin; bare, it reads nothing and cannot determine",
    "check:maintained-artefacts": "needs a built site directory; bare, it prints its usage and exits 2",
    # cat-harness-tools#1701: a merge-steward check of ONE six-line merge
    # request, given as a file or on stdin; bare it prints its usage and exits 2.
    "merge:request:check": "needs a merge request file (or - for stdin); bare, it prints its usage and exits 2",
    "folio:shim:check": "needs a folio root with a folio/schema/builders.ts shim; the index root has none, so it cannot determine",
    "ingest:ig-chrome:check": "needs --layer <dir> checkouts of each fhir.template in the chain; bare, it prints could not determine and exits 2",
    "publish:check": "needs the name of a package script that writes; bare, it exits 2",
    "wireframe:check": "needs --use, --topic and --surface; bare, a usage error and exit 2",
}
# The `PREREQUISITE_FILES` skip for `uml:overview:check` and
# `readme:subgraphs:check` (cat-harness-tools#281) was dropped in bean `rn24`:
# a content root's `qa:refresh` now claims its hosted instance's KG-QA tree,
# `qa:working-copy` runs `glossary:page` when `skill:register` is skipped as
# `readsState`, and the PlantUML jar fetches from Maven Central.


# Gates whose input this runner DOES have, given it when it has it: the
# workflow passes the PR's diff base (`GATE_DIFF_BASE`) and the junit report
# its tests step wrote (`GATE_JUNIT`). Run bare they printed their usage and
# exited 2 (smart-ra#65, run 38640286019). Each returns (extra arguments, None)
# to run, or (None, reason) when this side holds no such input; a reason is a
# skip, reported, never a pass.
def corpus_gate_input(env):
    base = env.get("GATE_DIFF_BASE", "").strip()
    if not base:
        return None, ("needs --since <ref>, and this run has no PR diff in the root's own history "
                      "(layer mode swaps the caller in without its .git; GATE_DIFF_BASE is unset)")
    return ["--since", base], None


def catalogue_input(env):
    # `--base`, two dots, never the script's `origin/main...HEAD` default: the
    # root is checked out at depth 1-2, and a three-dot range needs a merge base
    # that clone does not have, so the bare gate exited 2 ("could not
    # determine") on every layer PR (smart-immunizations#66, run 39619275196).
    base = env.get("GATE_DIFF_BASE", "").strip()
    if not base:
        return None, ("needs --base <sha>, and this run has no PR diff in the root's own history "
                      "(layer mode swaps the caller in without its .git; GATE_DIFF_BASE is unset)")
    return ["--base", base], None


def junit_cases(path):
    """The number of <testcase> elements in a junit report, or None when it will not read."""
    import xml.etree.ElementTree as ET
    try:
        return sum(1 for _ in ET.parse(path).getroot().iter("testcase"))
    except (OSError, ET.ParseError):
        return None


def test_budgets_input(env):
    path = env.get("GATE_JUNIT", "").strip()
    if not path:
        return None, "needs a junit report path, and GATE_JUNIT is unset"
    cases = junit_cases(path)
    if cases is None:
        return None, f"needs a junit report, and {path} is absent or will not parse"
    if cases == 0:
        # check-test-budgets.ts exits 2 on a report of no cases (bean 6tkl):
        # index mode runs no tests unless test-path is given.
        return None, "the tests step ran no test cases on this side, so there is nothing to budget"
    return [path], None


SUPPLIED_INPUTS = {
    "check:corpus-gate": corpus_gate_input,
    "check:test-budgets": test_budgets_input,
    "translation:catalogue:check": catalogue_input,
}


# Scripts `gates.ts` declares `kind: "report"`: check scripts CI deliberately
# does not gate, each with its reason there (`ScriptExemption`). Asked of
# gates.ts itself (`--report-scripts`, its SCRIPT_EXEMPTIONS: its own table,
# each present instance's declared `gateExemptions.scripts` and the index's),
# so the two cannot drift. A hand list here missed one: check:draft-beans is
# `report` because a PR checkout has no `origin/main` (exit 2), but only
# LAYER_MODE_SCRIPTS skipped it, so an instance that is its own index (INDEX
# mode) still ran it as a gate.
#
# Except the `report` scripts THIS file wires as gates on purpose, each with
# what it needs: the ones it supplies an input (SUPPLIED_INPUTS:
# check:test-budgets reads the shard's junit report) and the ones it runs over
# the tree as mounted (AS_MOUNTED_SCRIPTS: separation:cutover:check). Skipping
# those would stop judging them silently.
#
# gates.ts that cannot answer (absent, or exits non-zero, or prints no JSON
# object) is said on stderr, and then no script is skipped as a report: the
# gate runs and reports what it reports, rather than this guessing at a skip.
_REPORTS = {}


def report_scripts(root):
    """script -> why, for every script gates.ts calls `kind: "report"` in `root`."""
    if root in _REPORTS:
        return _REPORTS[root]
    tools = instances_in(root).get("cat-harness-tools", "cat-harness-tools")
    src = os.path.join(tools, "scripts", "gates.ts")
    out, why = {}, None
    if not os.path.isfile(os.path.join(root, src)):
        why = "is absent"
    else:
        try:
            r = subprocess.run(["bun", src, "--report-scripts"], cwd=root, capture_output=True, text=True, timeout=300)
            got = json.loads(r.stdout.strip().splitlines()[-1]) if r.returncode == 0 and r.stdout.strip() else None
            if isinstance(got, dict):
                out = {s: f'gates.ts declares it `kind: "report"`: {reason}' for s, reason in got.items()}
            else:
                why = f"exited {r.returncode} with no JSON object ({(r.stderr or '').strip()[-200:]})"
        except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as e:
            why = f"could not be asked ({e.__class__.__name__})"
    if why:
        print(f"run-gates: {src} --report-scripts {why}, so no script is skipped as a gates.ts `report`", file=sys.stderr)
    _REPORTS[root] = out
    return out


def gate_args(script, env=None):
    """(extra arguments, skip reason) for a declared gate: ([], None) for one that needs none."""
    fn = SUPPLIED_INPUTS.get(script)
    return fn(os.environ if env is None else env) if fn else ([], None)


def skip_reason(root, script, env=None, own=None, declarer=None):
    """(kind, why) a declared gate cannot determine anything in this run, or (None, None) to run it.

    `own` is the caller's own instances; None means unknown, and then no
    standalone gate is skipped. `declarer` is the instance whose package.json
    declares the script (None: unknown)."""
    if script in LIVE_STATE_SCRIPTS:
        return "live-state", "judges the remote's live state, not the checkout"
    if script in NEEDS_INPUT_SCRIPTS:
        return "needs-input", NEEDS_INPUT_SCRIPTS[script]
    if script in RUNNER_STATE_SCRIPTS:
        return "runner-state", RUNNER_STATE_SCRIPTS[script]
    if script in SWEEP_ONLY_SCRIPTS:
        return "sweep-only", SWEEP_ONLY_SCRIPTS[script]
    if script in QA_REPORT_SCRIPTS:
        return "qa-report", QA_REPORT_SCRIPTS[script]
    if script in LAYER_MODE_SCRIPTS and (os.environ if env is None else env).get("MODE") == "layer":
        return "layer-mode", LAYER_MODE_SCRIPTS[script]
    reports = report_scripts(root)
    if script in reports and script not in SUPPLIED_INPUTS and script not in AS_MOUNTED_SCRIPTS:
        return "report", reports[script]
    why = untracked_corpus_reason(root, declarer, script, own)
    if why:
        return "untracked-corpus", why
    m = STANDALONE_GATE.match(script)
    if m and own is not None and m.group(1) not in own:
        return "other-layer", (f"rehearses {m.group(1)} with only its own closure, which holds nothing of this caller; "
                              f"{m.group(1)}'s own CI judges it")
    return None, None


def read_json(path):
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def is_declaration(d, name):
    """A `<name>.json` that declares the instance: the harness's schema, or --
    bootstrap's own layers, which declare `name` and `needs` with no
    `$schema` -- a bare `name` matching the file."""
    if not isinstance(d, dict):
        return False
    schema = d.get("$schema")
    if schema is None:
        return d.get("name") == name
    return str(schema).startswith("cat-harness-declaration") and d.get("name", name) == name


def instances_in(root):
    """name -> directory (relative to root, '.' for the root), from declarations on disk."""
    found = {}
    for entry in sorted(os.listdir(root)):
        if entry.endswith(".json") and is_declaration(read_json(os.path.join(root, entry)), entry[:-5]):
            found[entry[:-5]] = "."
    for entry in sorted(os.listdir(root)):
        d = os.path.join(root, entry)
        if os.path.isdir(d) and not entry.startswith(".") and is_declaration(read_json(os.path.join(d, f"{entry}.json")), entry):
            found.setdefault(entry, entry)
    return found


def own_instances(root, given, known):
    if given:
        return given
    at_root = [n for n, p in known.items() if p == "."]
    if at_root:
        return at_root
    config = read_json(os.path.join(root, "index.config.json")) or {}
    entries = config.get("instances") or config.get("layers", [])
    return [i["name"] for i in entries if i.get("name") in known]


def closure(own, known, root):
    seen, todo = [], list(own)
    while todo:
        n = todo.pop(0)
        if n in seen or n not in known:
            continue
        seen.append(n)
        decl = read_json(os.path.join(root, known[n], f"{n}.json")) or {}
        todo.extend(decl.get("needs", []) or [])
    return seen


def script_runner(root):
    """The command that resolves a script name against every instance's
    declared scripts: the root's own `cat` script where it has one (the
    folio-assistant index), else the harness runner it would call. A root with
    no `cat` script (smart-ra) turned `bun run cat X` into /usr/bin/cat X, so
    every declared gate "failed" on both sides and was judged on nothing."""
    pkg = read_json(os.path.join(root, "package.json")) or {}
    if "cat" in (pkg.get("scripts") or {}):
        return "bun run cat"
    return "bun cat-harness-tools/scripts/run-script.ts"


def declares_script(root, path, script):
    """Does the instance mounted at `path` declare `script` (`scripts` or
    `checkoutScripts` of its package.json)? A manifest that cannot be read
    answers yes: the runner then reports what `bun run cat` reports, rather
    than this guessing at a skip."""
    pkg = read_json(os.path.join(root, path, "package.json"))
    if pkg is None:
        return True
    return script in {**(pkg.get("scripts") or {}), **(pkg.get("checkoutScripts") or {})}


def declared_gates(root, name, path, runner, env=None, own=None):
    """(gate name -> command, gate name -> (command, skip reason, skip kind))."""
    pkg = read_json(os.path.join(root, path, "package.json")) or {}
    scripts = {**pkg.get("scripts", {}), **pkg.get("checkoutScripts", {})}
    # Through the index's own runner, as the index's CI runs them: it resolves
    # a name against every instance's declared scripts.
    run, skipped = {}, {}
    for s in sorted(scripts):
        if not (s.startswith("check:") or s.endswith(":check")):
            continue
        extra, why = gate_args(s, env)
        command = " ".join([runner, s, *(shlex.quote(a) for a in extra or [])])
        kind = "input-absent" if why else None
        if not why:
            kind, why = skip_reason(root, s, env, own, name)
        if why:
            skipped[f"{name}:{s}"] = (command, why, kind)
        else:
            run[f"{name}:{s}"] = command
    return run, skipped


def parse_shard(value):
    """(i, n) from a `GATE_SHARD` of the form `i/N`, 1 <= i <= N; (1, 1) when unset or empty.
    Raises ValueError on anything else."""
    v = (value or "").strip()
    if not v:
        return 1, 1
    m = re.fullmatch(r"([0-9]+)/([0-9]+)", v)
    if not m:
        raise ValueError(f"GATE_SHARD={v!r} is not of the form i/N")
    i, n = int(m.group(1)), int(m.group(2))
    if n < 1 or not 1 <= i <= n:
        raise ValueError(f"GATE_SHARD={v!r}: need 1 <= i <= N")
    return i, n


def shard_names(names, i, n, timings=None, alone=(), jobs=1):
    """The names shard i of n runs.

    With no `timings`, those whose index in sorted(names) is i-1 mod n, returned
    in the order `names` gives them, so n == 1 runs exactly today's order.

    With `timings` (gate name -> seconds, from an earlier run's gates.json),
    the shards are balanced by time instead of by count (cat-harness-tools#397:
    on smart-base run 38866215814 the count split gave one head shard 2267 s of
    gates and another 626 s, and the slowest shard is the run's wall time).

    The time balanced is each shard's expected WALL time, not its summed
    seconds: `jobs` pooled gates run at once, so they cost a shard their sum
    over `jobs` (and never less than the longest of them), while an `alone`
    gate runs after the pool drains and costs its whole seconds. Summed
    seconds put every shard near 600 s on folio-assistant-core run
    41260767852, yet the shard holding the 500 s alone
    `check:cat-harness-tools-standalone` took 9.5 min and others 4-5 min.

    Longest first, each gate goes to the shard whose expected wall time grows
    least; a gate with no timing counts as the median, and ties go by name and
    then shard number, so every shard of a side computes the same partition
    from the same file. Still returned in the order `names` gives them.
    """
    if not timings or n == 1:
        mine = {x for k, x in enumerate(sorted(names)) if k % n == i - 1}
        return [x for x in names if x in mine]
    jobs = max(1, int(jobs))
    alone = set(alone)
    known = sorted(t for t in (timings.get(x) for x in names) if t is not None)
    fallback = known[len(known) // 2] if known else 1.0
    cost = {x: timings.get(x, fallback) for x in names}
    pooled = [0.0] * n  # summed seconds of pooled gates
    longest = [0.0] * n  # the longest pooled gate
    serial = [0.0] * n  # summed seconds of alone gates

    def wall(k, x=None):
        p, m, a = pooled[k], longest[k], serial[k]
        if x is not None:
            if x in alone:
                a += cost[x]
            else:
                p, m = p + cost[x], max(m, cost[x])
        return max(p / jobs, m) + a

    owner = {}
    for x in sorted(names, key=lambda x: (-cost[x], x)):
        k = min(range(n), key=lambda s: (wall(s, x), s))
        owner[x] = k
        if x in alone:
            serial[k] += cost[x]
        else:
            pooled[k] += cost[x]
            longest[k] = max(longest[k], cost[x])
    return [x for x in names if owner[x] == i - 1]


def gate_jobs():
    """`GATE_JOBS`, the gates run at once within one shard; 1 when unset.

    For the split, 1 under `GATE_CONE=record` too: a push traces its alone
    gates one at a time, and a pooled one met by a neighbour's writes runs
    again alone (`run_traced`), so the summed-seconds split stays the safe
    split there."""
    if os.environ.get("GATE_CONE", "").strip() == "record":
        return 1
    return max(1, int(os.environ.get("GATE_JOBS", "1") or "1"))


def read_timings(path):
    """gate name -> seconds from a gates.json an earlier run wrote (`GATE_TIMINGS`),
    or None when unset, absent or unreadable: then the shards split by count."""
    if not path:
        return None
    got = read_json(path)
    if not isinstance(got, dict):
        return None
    out = {k: float(v["seconds"]) for k, v in got.items() if isinstance(v, dict) and isinstance(v.get("seconds"), (int, float))}
    return out or None


# The tools that hold the whole tree for the length of a run, by file name:
# a script whose body runs one, or that runs a script that does, is "alone".
# A list of HARNESS tools, not of any repository's gates (like GRAPH_GATES).
TREE_TOOLS = {
    # Hashes every file of every instance before and after its writer and
    # calls any committed file that moved stale.
    "publish-check.ts": "hashes the tree around its writer",
    # Copies the layer's closure, found by `layerRootsIn` over the shared
    # tree, then tests the copy: a file a neighbour is writing, or an instance
    # a neighbour has hidden, is what it tests.
    "check-standalone.ts": "copies the closure out of the shared tree",
    # `git init`s bootstrap/ and bootstrap-tools/ IN the shared tree for its
    # whole run. `layerRootsIn` skips a directory with its own `.git`, so
    # every neighbour that discovers instances meanwhile sees no bootstrap:
    # check:cat-harness-standalone then copies a closure without it and five
    # `render-exemption.test.ts` tests fail (measured, folio-assistant index).
    "rehearse-bootstrap-standalone.ts": "git-inits bootstrap/ in the shared tree",
}

# What a script source runs through the runner: it spawns `bun run cat ...`
# (`spawnSync("bun", ["run", "cat", ...args])`), and the names it passes are
# its STEPS' `verify` lists (skill-register.ts, kind-register.ts). Read with
# comments and strings told apart, so a name in a comment is not a call.
_SOURCE_TOKEN = re.compile(r"""("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|/\*.*?\*/|//[^\n]*""", re.S)
_SPAWNS_RUNNER = re.compile(r"""["']run["']\s*,\s*["']cat["']""")
_VERIFY_LIST = re.compile(r"\bverify\s*:\s*\[([^\]]*)\]")
_QUOTED = re.compile(r"""["']([^"'\s]+)["']""")
_BODY_CALL = re.compile(r"\bbun run cat ([\w:.-]+)")


def _code_of(path):
    """A TypeScript source with its comments removed, or "" when unreadable."""
    try:
        with open(path) as f:
            src = f.read()
    except (OSError, UnicodeDecodeError):
        return ""
    return _SOURCE_TOKEN.sub(lambda m: m.group(1) or " ", src)


def invoked_scripts(root, base, body):
    """Script names a script body runs through the runner: `bun run cat <name>`
    in the body itself, and the `verify` names of any `.ts` it runs whose code
    spawns the runner. `base` is the declaring instance's directory."""
    names = set(_BODY_CALL.findall(body))
    try:
        words = shlex.split(body)
    except ValueError:
        words = body.split()
    for w in words:
        if not w.endswith(".ts"):
            continue
        for d in (root, os.path.join(root, base)):
            code = _code_of(os.path.join(d, w))
            if code:
                if _SPAWNS_RUNNER.search(code):
                    for listed in _VERIFY_LIST.findall(code):
                        names.update(_QUOTED.findall(listed))
                break
    return names


def tree_snapshotting(root):
    """Gate names that run alone, after the pool drains: those whose script
    runs a `TREE_TOOLS` tool, directly or through the scripts it runs.

    Under `GATE_JOBS` > 1 a neighbour gate that writes a committed file inside
    publish-check's window (`check:avatar-coverage` rewrites
    `avatar-coverage.qa-results.json`) is blamed on the writer, so the verdict
    depends on scheduling (smart-immunizations#61, run 38824729436: head red,
    base green, same pins). The direct body is not enough: `skill:register:check`
    runs `subgraph:jsonld:check`, and `kind:register:check` runs
    `avatars:css:check` and its siblings, each a publish-check, from inside
    their own process -- pooled, they wrote cat-harness/ns/subgraph/v1.jsonld
    beside other gates, and shards rebalanced from recorded timings gave the
    same pins different verdicts (smart-immunizations#65, run 39474513021
    against 39478293845; folio-assistant-core#166, run 39475237100:
    `kind:register:check` "1 stale artefact", green alone). So the set is the
    fixed point of "runs a tree tool, or runs a script that is alone",
    over every instance's declared scripts."""
    known = instances_in(root)
    bodies = {}  # (instance, script) -> (directory, body)
    by_name = {}  # script -> [(instance, script)], every instance declaring it
    for n, p in known.items():
        pkg = read_json(os.path.join(root, p, "package.json")) or {}
        for s, body in {**pkg.get("scripts", {}), **pkg.get("checkoutScripts", {})}.items():
            bodies[(n, s)] = (p, str(body))
            by_name.setdefault(s, []).append((n, s))
    alone = {k for k, (_, body) in bodies.items() if any(t[:-3] in body for t in TREE_TOOLS)}
    calls = {k: invoked_scripts(root, p, body) for k, (p, body) in bodies.items()}
    grew = True
    while grew:
        names = {s for _, s in alone}
        new = {k for k in bodies if k not in alone and calls[k] & names}
        alone |= new
        grew = bool(new)
    return {f"{n}:{s}" for n, s in alone}


# ── The CI cone (bean `4rbc`, cat-harness-tools#398) ─────────────────────
#
# The tracer, the record format and the exact-match decision are ci-cone.ts's
# own, reused here, never copied. Not through gate-shell.sh, as bean `lpcs`
# plan 3 first proposed: that wrapper answers a skip with exit 0, which this
# runner would record as a pass, and it starts one process per gate (about
# 0.48 s each, measured in bean `4rbc`); `decide-all` asks once.
CONE_CLI = "cat-harness-tools/scripts/ci-cone.ts"
CONE_RECORDS = os.path.join("build", "ci-cone", "records.json")
# ci-cone.ts `RUNNER`: what it runs, traced or not. A gate whose command is
# anything else is not the command a record was made from.
CONE_RUNNER = "bun run cat"
CONE_TIMEOUT_S = 900


def cone_mode(env):
    """(mode, note): mode is "", "skip" or "record". Anything else is off, and says so."""
    v = (env.get("GATE_CONE") or "").strip()
    if v in ("", "skip", "record"):
        return v, None
    return "", f"GATE_CONE={v!r} is neither skip nor record, so the cone is off and every gate runs"


def cone_cli(root, env):
    """The ci-cone.ts command line, or None when this side's pin has none. `GATE_CONE_CLI` replaces it (tests)."""
    given = (env.get("GATE_CONE_CLI") or "").strip()
    if given:
        return shlex.split(given)
    if not os.path.isfile(os.path.join(root, CONE_CLI)):
        return None
    return ["bun", CONE_CLI]


def cone_scripts(gates, runner):
    """gate name -> script, for the declared gates whose command is exactly `bun run cat <script>`."""
    if runner != CONE_RUNNER:
        return {}
    out = {}
    for name, command in gates.items():
        if name.startswith("graph:") or ":" not in name:
            continue
        script = name.split(":", 1)[1]
        if command == f"{CONE_RUNNER} {script}":
            out[name] = script
    return out


# ── Tracing several gates at once (owner pick Q-ACT-1 A, 2026-11-10) ─────
#
# A push traced its gates one at a time, so a shard of a main run took the SUM
# of its gates (who-iris run 42885346093: 69 gates, 1,064 s, 948 s wall) though
# GATE_JOBS=4. The pooled candidates are now traced GATE_JOBS at once; the
# `alone` (tree-tool) ones still run last and one at a time. What makes a
# record taken beside neighbours sound: every traced run reports what it
# touched inside the checkout (`CI_CONE_TOUCHED_OUT`: its reads, the
# directories it listed, its writes, creates, deletes and renames, and whether
# it ran git) and writes its record to its own file (`CI_CONE_RECORD_OUT`). A
# run whose time overlapped a neighbour that wrote a path it read, wrote into a
# directory it listed, wrote anything while it ran git, or whose writes are not
# known, keeps NO record and is run again alone, and that alone run is its
# verdict and its record. Records hash a path's state after the run, so a
# neighbour's write would otherwise be stored as a state the gate never read.
# The other records are kept with `ci-cone.ts keep`, which stores them exactly
# as a lone run would. A side whose ci-cone.ts predates this traces one at a
# time, as before, and so does any run without `GATE_CONE_PARALLEL=1`.
CONE_PARALLEL_MARKS = ("CI_CONE_TOUCHED_OUT", "CI_CONE_RECORD_OUT", '"keep"')


def cone_parallel(root, env):
    """Whether to trace gates side by side: only when `GATE_CONE_PARALLEL=1`
    asks for it and this side's ci-cone.ts can. Off by default: on who-iris
    main one long gate whose writes were unknown sent all 49 pooled gates of a
    shard back to run alone, so the step took longer than tracing one at a
    time (cat-harness-tools#1859)."""
    if (env.get("GATE_CONE_PARALLEL") or "").strip() != "1":
        return False
    if (env.get("GATE_CONE_CLI") or "").strip():
        return True
    try:
        with open(os.path.join(root, CONE_CLI)) as f:
            src = f.read()
    except OSError:
        return False
    return all(m in src for m in CONE_PARALLEL_MARKS)


def _dirs_above(path):
    """The directories a write to `path` changes the listing of: its parent, up to the root ("")."""
    head = path
    while "/" in head:
        head = head.rsplit("/", 1)[0]
        yield head
    yield ""


def cone_clashes(touched, spans):
    """name -> why, for each traced run a neighbour may have disturbed.

    `touched`: name -> what ci-cone.ts reported the run touched, or
    {"undetermined": why}. `spans`: name -> (start, end) on one clock; two runs
    are neighbours when their spans overlap."""
    def known(t):
        return isinstance(t, dict) and "undetermined" not in t
    out = {}
    names = sorted(touched)
    for a in names:
        ta = touched[a]
        a0, a1 = spans[a]
        for b in names:
            if b == a:
                continue
            b0, b1 = spans[b]
            if b1 <= a0 or a1 <= b0:
                continue
            tb = touched[b]
            if not known(tb):
                out[a] = f"{b} ran beside it and what it wrote is not known ({(tb or {}).get('undetermined', 'no report')})"
                break
            w = set(tb.get("writes") or [])
            if not w:
                continue
            if not known(ta):
                out[a] = f"what it read is not known, and {b} wrote beside it"
                break
            reads = set(ta.get("reads") or [])
            listed = set(ta.get("listed") or [])
            hit = sorted(w & reads)
            if hit:
                out[a] = f"{b} wrote {hit[0]}, which it read"
                break
            hit = sorted(p for p in w if any(d in listed for d in _dirs_above(p)))
            if hit:
                out[a] = f"{b} wrote {hit[0]} into a directory it listed"
                break
            if ta.get("git"):
                out[a] = f"it ran git, and {b} wrote {sorted(w)[0]} beside it"
                break
    return out


def run_traced(root, cli, traced, jobs, tmp, alone):
    """Run the traced gates: side by side when the cone allows it, else one at a
    time. Returns the outcomes, as `run` gives them, keyed by gate name."""
    outcomes = {}
    pool_names = [n for n in traced if n not in alone]
    lone = [n for n in traced if n not in pool_names]
    if jobs > 1 and len(pool_names) > 1 and cone_parallel(root, os.environ):
        work = os.path.join(tmp, "cone-parallel")
        os.makedirs(work, exist_ok=True)
        files = {n: (os.path.join(work, f"{i}.touched.json"), os.path.join(work, f"{i}.record.json")) for i, n in enumerate(pool_names)}
        spans = {}

        def one(name):
            touched_out, record_out = files[name]
            env = {**os.environ, "CI_CONE_TOUCHED_OUT": touched_out, "CI_CONE_RECORD_OUT": record_out}
            t0 = time.monotonic()
            got = run(root, name, shlex.join([*cli, "run", traced[name]]), env=env)
            spans[name] = (t0, time.monotonic())
            return got

        with ThreadPoolExecutor(max_workers=jobs) as pool:
            for got in pool.map(one, pool_names):
                outcomes[got[0]] = got
        touched = {n: read_json(files[n][0]) or {"undetermined": "it reported nothing"} for n in pool_names}
        for n, t in touched.items():
            if isinstance(t, dict) and t.get("writes"):
                print(f"::warning::{n} wrote inside the checkout while judging ({', '.join(t['writes'][:3])}; a rewrite with the same content counts): a gate should write nothing", flush=True)
        clashes = cone_clashes(touched, spans)
        keep = [files[n][1] for n in pool_names if n not in clashes and os.path.isfile(files[n][1])]
        if keep:
            k = run(root, "cone:keep", shlex.join([*cli, "keep", *keep]))
            print(k[3], flush=True)
        # A gate that failed beside others was not asked again there: its
        # verdict comes from a run alone (ci-cone.ts, CI_CONE_TOUCHED_OUT).
        failed = [n for n in pool_names if n not in clashes and outcomes[n][2] != 0]
        print(f"ci cone: traced {len(pool_names)} gate(s) {jobs} at a time; {len(clashes)} met a neighbour's writes and {len(failed)} failed, and run again alone", flush=True)
        for n, why in sorted(clashes.items()):
            print(f"ci cone: {n} runs again alone: {why}", flush=True)
            lone.append(n)
        for n in failed:
            print(f"ci cone: {n} runs again alone: it failed beside other gates", flush=True)
            lone.append(n)
    else:
        lone = list(traced)
    for name in lone:
        outcomes[name] = run(root, name, shlex.join([*cli, "run", traced[name]]))
    return outcomes


def strace_works():
    if shutil.which("strace") is None:
        return False
    try:
        return subprocess.run(["strace", "-f", "-qq", "-o", os.devnull, "true"], capture_output=True, timeout=60).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def cone_decide(root, scripts, env):
    """(script -> decision, None), or (None, why) when the cone could not answer at all."""
    cli = cone_cli(root, env)
    if cli is None:
        return None, f"{CONE_CLI} is absent at this side's pin"
    fd, out = tempfile.mkstemp(prefix="cone-decisions-", suffix=".json")
    os.close(fd)
    os.unlink(out)
    try:
        p = subprocess.run([*cli, "decide-all", out, *scripts], cwd=root, capture_output=True, text=True, timeout=CONE_TIMEOUT_S)
    except (OSError, subprocess.TimeoutExpired) as e:
        return None, f"ci-cone.ts decide-all did not finish ({e.__class__.__name__})"
    got = read_json(out)
    if os.path.exists(out):
        os.unlink(out)
    if p.returncode != 0 or not isinstance(got, dict) or not isinstance(got.get("decisions"), dict):
        tail = (p.stdout + p.stderr).strip()[-300:]
        return None, f"ci-cone.ts decide-all exited {p.returncode} without decisions: {tail}"
    return got["decisions"], None


def cone_skip(decision):
    """The record's sha when `decision` is a well-formed skip, else None: anything malformed runs."""
    if not isinstance(decision, dict) or decision.get("skip") is not True:
        return None
    sha = decision.get("sha")
    return sha if isinstance(sha, str) and sha else None


def read_records(root):
    got = read_json(os.path.join(root, CONE_RECORDS))
    return got if isinstance(got, dict) and isinstance(got.get("checks"), dict) else None


def footprint(record):
    """The top-level entries of the root that a ci-cone record's read set lies
    in (an instance's directory, or a root-level file such as `package.json`;
    `.` for the root itself), from its `reads` and the cwd of each replayed
    git call.

    DERIVED from the record, so it cannot drift from what the run read (2b,
    cat-harness-tools#398). It is reported, and it never skips a gate by
    itself: a trace covers only the path THAT run took, on that run's content
    (bean `4rbc`, "the caveat"), so "read only cat-harness-tools/ on main" says
    nothing about a run on other content. The exact match is what licenses a
    skip, and once it holds, base and head agree for an own-tree gate. Nor do
    the non-caller trees of a layer PR's two sides stay equal on their own:
    `derive:publish` and the state mount write into them from the caller's
    content."""
    out = set()
    paths = list((record or {}).get("reads", {}))
    for key in (record or {}).get("git", {}):
        try:
            paths.append(json.loads(key)[0])
        except (ValueError, TypeError, IndexError):
            out.add("?")
    for p in paths:
        out.add(p.split("/", 1)[0] if p else ".")
    return sorted(out)


def own_tree(fp, instance_dir):
    """Whether a footprint is one instance's own directory and nothing else."""
    return instance_dir not in (".", "") and fp == [instance_dir]


def prune_records(root, scripts):
    """Forget the restored records of `scripts`: each is about to run again, and
    only that run may record it. A stale record would outlive a red run."""
    got = read_records(root)
    if got is None:
        return
    for s in scripts:
        got["checks"].pop(s, None)
    with open(os.path.join(root, CONE_RECORDS), "w") as f:
        json.dump(got, f, indent=1)


def cone_plan(root, gates, runner, caller, env):
    """Ask the cone about `gates` before any of them runs.

    Returns (mode, note, cands, unchanged, traced): `cands` gate name -> script
    asked about; `unchanged` gate name -> its SKIPPED entry; `traced` gate
    name -> script to run under the tracer (record mode only)."""
    mode, note = cone_mode(env)
    cands = cone_scripts(gates, runner) if mode else {}
    if mode and not cands:
        return "", f"no gate here runs as `{CONE_RUNNER} <script>` (runner: {runner}), so the cone has nothing to ask", {}, {}, {}
    tracer = mode == "record" and strace_works()
    if mode == "record" and not tracer:
        # Still decided: a gate whose record matches needs no new one.
        note = "strace does not run here, so this run records nothing"
    if not mode:
        return "", note, {}, {}, {}
    decisions, why = cone_decide(root, sorted(set(cands.values())), env)
    if decisions is None:
        return "", f"{why}; every gate runs", {}, {}, {}
    records = (read_records(root) or {"checks": {}})["checks"]
    known = instances_in(root)
    caller_dir = known.get(caller, caller) if caller else None
    unchanged, traced = {}, {}
    for name, script in cands.items():
        d = decisions.get(script)
        sha = cone_skip(d)
        if sha is not None:
            fp = footprint(records.get(script))
            owner = known.get(name.split(":", 1)[0], "")
            why = d["why"] if isinstance(d.get("why"), str) and d["why"] else f"inputs unchanged since {sha}"
            if own_tree(fp, owner):
                why += f"; reads only {owner}/ (own tree{', not the caller' if caller_dir and owner != caller_dir else ''})"
            unchanged[name] = {"command": gates[name], "skipped": why, "unchanged": sha, "footprint": fp}
        elif tracer and isinstance(d, dict) and d.get("candidate") is True:
            traced[name] = script
    if mode == "record":
        prune_records(root, [s for n, s in cands.items() if n not in unchanged])
    return mode, note, cands, unchanged, traced


def findings(text, root=None):
    """Every finding `text` prints, in order (repeats kept): the `diagnostics`
    compare-gates.py judges. One parser, `gate_diagnostics.py`, shared with
    run-root-gates.py; this name is kept for its callers (#1457).

    Without them a gate already red on main judged nothing: a PR that made one
    more file stale passed, because the gate was "failing on main too". That is
    how folio-assistant main stayed red on `libraries:check`,
    `bpmn:checklist:check`, `render:bpmn:check` and `kind:json-schemas:check`
    while each layer's own PRs added to them (2026-11-04), and how
    folio-assistant-core#630 added a wrong-direction reference unjudged.
    """
    return diagnostics(text, root)


# cat-harness-tools#1701: the gates that judge the mounts AS LAID DOWN from
# the root's lock. In the shards they ran over the prepared tree, i.e. after
# the prepare job's derive:publish (and the qa:refresh it runs) had written
# pages and QA results into the mounted layers, and those writes reached the
# shards in the snapshot. Measured on smart-ips-pilgrimage run 42455839636 by
# replaying derive:publish over its lock: 962 files in 7 layers, 899 of them
# ignored by the layer's own .gitignore (test/results/**, built pages,
# sidecars), so every mount but bootstrap-tools read "modified" and
# separation:cutover:check failed on its `mounts` condition. The prepare job
# now runs these right after the state mount, before anything is built on the
# tree (`--as-mounted`), and every shard takes that answer (`--as-mounted-record`)
# instead of judging the built-on tree. Nothing is excused: a lock that does
# not lay down, or a mount that is edited, is just as red, only judged on the
# tree the lock produced.
AS_MOUNTED_SCRIPTS = ("mount:remote:check", "mount:lock:check", "separation:cutover:check")


def as_mounted(gates):
    """The derived gates judged on the tree as mounted, name -> command."""
    return {k: v for k, v in gates.items() if k.split(":", 1)[-1] in AS_MOUNTED_SCRIPTS}


def gate_env(root, own):
    """The environment every gate inherits (see `main`)."""
    os.environ.setdefault(GATE_OWN_ENV, ",".join(own))
    known = instances_in(root)
    os.environ.setdefault(GATE_OWN_PATHS_ENV, ",".join(known.get(n, n) for n in own))
    os.environ.setdefault(GATE_FOREIGN_PATHS_ENV, ",".join(d for n, d in sorted(known.items()) if n not in own and d != "."))


def run(root, name, command, env=None):
    start = time.monotonic()
    try:
        p = subprocess.run(shlex.split(command), cwd=root, capture_output=True, text=True, timeout=TIMEOUT_S, env=env)
        code, text = p.returncode, (p.stdout + p.stderr).strip()
    except subprocess.TimeoutExpired:
        # Harness convention: exit 2 is "could not determine", never a pass.
        code, text = 2, f"timed out after {TIMEOUT_S} s"
    return name, command, code, text, round(time.monotonic() - start, 1)


def derive(root, given, tmp, env=None):
    """The gate set a root's CI runs, without running it -- the ONE definition.

    Returns (own, harness, runner, gates, skipped): gate name -> command for
    the gates this runner runs, and gate name -> {command, skipped, kind} for
    the declared ones it does not. `kind` says why: `live-state`,
    `needs-input`, `runner-state`, `sweep-only`, `qa-report`, `layer-mode`, `untracked-corpus`, `prerequisite`, `not-at-pin` (an index or checkout gate whose script the mounted owner does not declare yet), or `input-absent` (a SUPPLIED_INPUTS gate
    on a side that holds no such input -- CI runs it where the input exists).

    `--list` prints this as JSON, and it is what `gates.ts` `loadGates` reads
    for a root that is not a harness (no `code-quality-gates.yml`), so
    `audit:coverage` and `qa:refresh` measure such a root against the gates
    its own CI runs (owner, cat-harness-tools#281: "hold smart-ra to its own
    gate set"). A rule added here reaches both with no second list.
    """
    env = os.environ if env is None else env
    known = instances_in(root)
    own = own_instances(root, given, known)
    if not own:
        return own, [], None, {}, {}
    harness = closure(own, known, root)
    gates = {}
    for n in own:
        path = "./" if known.get(n, n) == "." else f"./{known.get(n, n)}"
        for k, v in GRAPH_GATES.items():
            gates[f"graph:{n}:{k}"] = v.format(tmp=tmp, instance=n, path=path)
    gates.update({f"graph:{k}": v for k, v in CHECKOUT_GATES.items()})
    seen_scripts = set()
    runner = script_runner(root)
    skipped = {}
    for script, owner in {**CHECKOUT_SCRIPTS, **index_scripts()}.items():
        command = f"{runner} {script}"
        if command in seen_scripts:
            continue
        seen_scripts.add(command)
        if owner in known and not declares_script(root, known[owner], script):
            # The list is this WORKFLOW's (`index-gates.json` beside this
            # file, at the ref the caller's workflow pins); the scripts are
            # the MOUNTED owner's, at the pin the index lock gives it. The two
            # pins differ by design, so a gate added to the list after the
            # index's pin named a script no mount declared, and `bun run cat`
            # failed it as "no script" on every layer PR whose cone ran it
            # (jsonld:site:check: workflow 31e8a3e, index pin
            # ed3c8eb, script added in be54df93). Nothing was judged, so it is
            # listed as skipped, never counted, and runs once the pin has it.
            skipped[f"{owner}:{script}"] = {
                "command": command,
                "skipped": f"{owner} at this side's pin does not declare `{script}`: the workflow's gate list is newer than the mounted {owner}",
                "kind": "not-at-pin",
            }
            continue
        gates[f"{owner}:{script}"] = command
    for n in harness:
        run_these, skip_these = declared_gates(root, n, known[n], runner, env, own)
        for gname, command in run_these.items():
            if command in seen_scripts:
                continue  # one script, run once, named by the first instance that declares it
            seen_scripts.add(command)
            gates[gname] = command
        for gname, (command, why, kind) in skip_these.items():
            if command in seen_scripts:
                continue
            seen_scripts.add(command)
            skipped[gname] = {"command": command, "skipped": why, "kind": kind}
    fold_skill_register(root, runner, gates)
    return own, harness, runner, gates, skipped


SKILL_REGISTER_TS = os.path.join("cat-harness-tools", "scripts", "skill-register.ts")
_VERIFY = re.compile(r'verify:\s*\[\s*"([^"]+)"\s*\]')


def skill_register_chain(root):
    """The chain checks `skill:register:check` runs (`STEPS[].verify` in
    skill-register.ts at this side's pin), or [] when they cannot be read."""
    try:
        with open(os.path.join(root, SKILL_REGISTER_TS)) as f:
            src = f.read()
    except OSError:
        return []
    start = src.find("export const STEPS")
    end = src.find("export const CHECKS", start)
    return _VERIFY.findall(src[start:end]) if start >= 0 and end > start else []


def fold_skill_register(root, runner, gates):
    """Run `skill:register:check` as its declaration half when every chain
    check it would run is already its own gate in this set (the fold
    `regen` uses, `pair-cover.ts`, bean `8qyc`). Measured on
    folio-assistant-core#444 (run 41239562434): 724.8 s of the slowest
    shard's 14m43s re-ran those checks. Every chain check is still judged,
    head against base, by its own gate, so nothing goes unjudged. The gate
    keeps its name, so the two sides compare like for like."""
    full = f"{runner} skill:register:check"
    name = next((k for k, v in gates.items() if v == full), None)
    chain = skill_register_chain(root)
    if name is None or not chain:
        return
    have = set(gates.values())
    if any(f"{runner} {c}" not in have for c in chain):
        return
    residual = f"{runner} skill:register:declarations:check"
    for k in [k for k, v in gates.items() if v == residual]:
        del gates[k]
    gates[name] = residual


# Gates run as parts, each in its own shard (S-CI6, 2026-11-01). On
# folio-assistant-core run 41287467368 `check:cat-harness-tools-standalone`
# took 510 s alone, the floor of every PR run once the shards were balanced.
# Part i of n runs `<script> --part i/n`: slice i of the layer's test files
# (check-standalone.ts, "In parts"), so together the parts run every test file
# once. A side whose pinned check-standalone.ts has no `--part` keeps the
# gate whole: there the flag would be ignored and each part would run the
# whole layer, four times the work (`supports_parts`).
SPLIT_GATES = {"check:cat-harness-tools-standalone": 4}
CHECK_STANDALONE_TS = os.path.join("cat-harness-tools", "scripts", "check-standalone.ts")


def supports_parts(root):
    """Whether this side's check-standalone.ts takes `--part`."""
    try:
        with open(os.path.join(root, CHECK_STANDALONE_TS)) as f:
            return '"--part"' in f.read()
    except OSError:
        return False


def split_gates(gates, runner, timings=None, alone=None, table=None, root=None):
    """`gates` with each SPLIT_GATES gate replaced, in place, by its parts:
    `<name>#i/n` running `<command> --part i/n`. A part inherits `alone`, and
    until it has a timing of its own, the whole gate's seconds over n. Returns
    the new gates dict; `timings` and `alone` are updated in place. With
    `root` given and no `--part` in its check-standalone.ts, nothing is split."""
    table = SPLIT_GATES if table is None else table
    if root is not None and not supports_parts(root):
        return dict(gates)
    out = {}
    for name, command in gates.items():
        script = command[len(runner) + 1:] if runner and command.startswith(f"{runner} ") else None
        n = table.get(script) if script else None
        if not n or n < 2:
            out[name] = command
            continue
        for i in range(1, n + 1):
            part = f"{name}#{i}/{n}"
            out[part] = f"{command} --part {i}/{n}"
            if timings is not None and part not in timings and name in timings:
                timings[part] = timings[name] / n
            if alone is not None and name in alone:
                alone.add(part)
    return out


def verified_by_gates(gates):
    """The scripts this side's gates run, for skill-register.ts
    (`CAT_SKILL_REGISTER_VERIFIED_BY_GATES`): the chain checks it may leave to
    them. The derive:publish step already sets it (owner, 2026-10-23, option
    A); a gate such as `uml:overview:check` builds the same QA working copy in
    a shard, whose `skill:register` re-ran nine checks the gate set runs
    anyway (fa#2867). Every one is still judged by its own gate."""
    return ",".join(sorted({k.split(":", 1)[1] for k in gates if ":" in k}))


def main():
    args = sys.argv[1:]
    given = [args[i + 1] for i, a in enumerate(args) if a == "--instance" and i + 1 < len(args)]
    tmp = os.environ.get("RUNNER_TEMP", "/tmp")
    try:
        shard, shards = parse_shard(os.environ.get("GATE_SHARD"))
    except ValueError as e:
        print(f"::error::{e}; a guessed slice could drop gates, so nothing is run", file=sys.stderr)
        sys.exit(2)
    if len(args) >= 2 and args[1] == "--list":
        # `run-gates.py <root> --list [--instance <name>]...`: the derived set
        # as JSON on stdout, nothing run. Exit 2 when there is no own instance:
        # no gate set is "could not determine", never an empty pass.
        own, harness, runner, gates, skipped = derive(args[0], given, tmp)
        listed = {"own": own, "harness": harness, "runner": runner, "gates": gates, "skipped": skipped}
        if os.environ.get("GATE_SHARD", "").strip():
            timings = read_timings(os.environ.get("GATE_TIMINGS"))
            alone = tree_snapshotting(args[0]) if timings else set()
            gates = split_gates(gates, runner, timings, alone, root=args[0])
            listed["gates"] = {k: gates[k] for k in shard_names(list(gates), shard, shards, timings, alone, gate_jobs())}
            listed["skipped"] = skipped if shard == 1 else {}
            listed["shard"] = {"shard": shard, "of": shards, "total": len(gates)}
        json.dump(listed, sys.stdout, indent=1)
        sys.exit(0 if own else 2)
    if len(args) >= 2 and args[1] == "--as-mounted":
        # `run-gates.py <root> --as-mounted <out.json> [--instance <name>]...`:
        # run only AS_MOUNTED_SCRIPTS, now, and record them in the shape
        # `--record` reads (cat-harness-tools#1701). Exit 2 with no own instance.
        if len(args) < 3:
            print("usage: run-gates.py <root> --as-mounted <out.json> [--instance <name>]...", file=sys.stderr)
            sys.exit(2)
        root, out_path = args[0], args[2]
        own, _harness, _runner, gates, _skipped = derive(root, given, tmp)
        if not own:
            sys.exit(2)
        gate_env(root, own)
        results = {}
        for name, command in sorted(as_mounted(gates).items()):
            name, command, code, text, seconds = run(root, name, command)
            print(f"::group::{name} (as mounted): exit {code} in {seconds} s — {command}", flush=True)
            print(text[-4000:], flush=True)
            print("::endgroup::", flush=True)
            results[name] = {"command": command, "exit": code, "tail": text[-1500:], "seconds": seconds,
                             "diagnostics": diagnostics(text, root), "producer": producer(root, name)}
        with open(out_path, "w") as f:
            json.dump(results, f, indent=1)
        sys.exit(0)
    root, out_path = args[0], args[1]
    records = [args[i + 1] for i, a in enumerate(args) if a == "--record" and i + 1 < len(args)]
    own, harness, runner, gates, skipped = derive(root, given, tmp)
    if not own:
        print("::error::no own instance: pass --instance, declare one at the root, or mount one from index.config.json")
        sys.exit(2)
    print(f"own: {', '.join(own)}; dependency harness: {', '.join(harness)}", flush=True)
    print(f"script runner: {runner}", flush=True)
    # The instances whose committed files this run judges (scripts/lib/gate-own.ts;
    # owner ruling 2026-11-05, "Move the checks"). A check that honours it leaves
    # the mounted layers' files to their own CI. Every gate inherits it.
    # The same by directory, for a check whose subjects are files rather than
    # declared directories (`gateOwnsFile`): the own instances' and every
    # other instance's, so a file is the caller's when its deepest instance is.
    gate_env(root, own)
    # The mount gates the prepare job judged on the tree as mounted
    # (cat-harness-tools#1701): taken from its record in place of a run over
    # the built-on tree, dropped from every shard before the split so the
    # shards still agree on it, and carried by shard 1 like the other records.
    # No record (an older prepare job, or a step that failed): run as before.
    mounted_at = [args[i + 1] for i, a in enumerate(args) if a == "--as-mounted-record" and i + 1 < len(args)]
    for path in mounted_at:
        got = read_json(path)
        if isinstance(got, dict) and got:
            for name in got:
                gates.pop(name, None)
            records.append(path)
        else:
            print(f"::warning::{path} is missing or unreadable: the mount gates run over the prepared tree", flush=True)
    skipped = {k: {"command": v["command"], "skipped": v["skipped"]} for k, v in skipped.items()}
    os.environ.setdefault("CAT_SKILL_REGISTER_VERIFIED_BY_GATES", verified_by_gates(gates))
    timings = read_timings(os.environ.get("GATE_TIMINGS"))
    alone = tree_snapshotting(root)
    gates = split_gates(gates, runner, timings, alone, root=root)
    total = len(gates)
    gates = {k: gates[k] for k in shard_names(list(gates), shard, shards, timings, alone, gate_jobs())}
    if shard != 1:
        skipped, records = {}, []  # shard 1 carries them, so a merged side holds each once
    split = "by recorded seconds" if timings and shards > 1 else "by count"
    print(f"shard {shard}/{shards}: {len(gates)} of {total} gate(s), split {split}", flush=True)

    # The CI cone: asked once, before any gate runs or writes.
    mode, note, cands, unchanged, traced = cone_plan(root, gates, runner, given[0] if given else None, os.environ)
    for name in unchanged:
        gates.pop(name)
    if mode:
        own_count = sum(1 for e in unchanged.values() if "(own tree" in e["skipped"])
        print(f"ci cone ({mode}): {len(unchanged)} of {len(cands)} gate(s) asked are unchanged since their record"
              f" ({own_count} own-tree)" + (f"; {len(traced)} to trace" if mode == "record" else ""), flush=True)
    if note:
        print(f"ci cone: {note}", flush=True)

    results = {}
    pooled = [kv for kv in gates.items() if kv[0] not in alone and kv[0] not in traced]
    serial = [kv for kv in gates.items() if kv[0] in alone and kv[0] not in traced]
    jobs = max(1, int(os.environ.get("GATE_JOBS", "1")))
    with ThreadPoolExecutor(max_workers=jobs) as pool:
        outcomes = list(pool.map(lambda kv: run(root, kv[0], kv[1]), pooled))
    outcomes += [run(root, k, v) for k, v in serial]
    # Traced last, after every untraced gate, so no untraced gate writes
    # under a trace: a record holds the state each path had when ITS run read
    # it. The pooled ones are traced side by side, guarded as `run_traced`
    # says; the alone ones one at a time. ci-cone.ts `run` exits with the
    # check's own status; a traced run that failed is re-run untraced, and
    # that is the verdict (bean `4rbc`).
    cli = cone_cli(root, os.environ) if traced else None
    if traced:
        with tempfile.TemporaryDirectory(prefix="cone-parallel-") as ctmp:
            done = run_traced(root, cli, traced, jobs, ctmp, alone)
        for name in traced:
            n, _, code, text, seconds = done[name]
            outcomes.append((n, gates[name], code, text, seconds))
    for name, command, code, text, seconds in outcomes:
        print(f"::group::{name}: exit {code} in {seconds} s — {command}", flush=True)
        print(text[-4000:], flush=True)
        print("::endgroup::", flush=True)
        # The findings it printed, so a gate red on main too still fails the
        # PR that adds one (compare-gates.py; folio-assistant-core#630, #1457).
        results[name] = {"command": command, "exit": code, "tail": text[-1500:], "seconds": seconds,
                         "diagnostics": diagnostics(text, root), "producer": producer(root, name)}
    ran = list(results)
    for name, entry in unchanged.items():
        print(f"{name}: SKIPPED — {entry['skipped']} — {entry['command']}", flush=True)
    for name, entry in skipped.items():
        print(f"{name}: skipped ({entry['skipped']}) — {entry['command']}", flush=True)
    for path in records:
        got = read_json(path)
        if not isinstance(got, dict) or not got:
            got = {f"record:{os.path.basename(path)}": {"command": path, "exit": 2, "tail": f"{path} is missing or unreadable: the step that writes it did not record a result"}}
        for name, entry in got.items():
            print(f"{name}: recorded ({entry.get('skipped') or 'exit %s' % entry.get('exit')}) — {entry.get('command')}", flush=True)
            (skipped if "skipped" in entry else results)[name] = entry
    green = sum(1 for r in results.values() if r["exit"] == 0)
    results.update(skipped)  # no `exit`: compare-gates.py reports these as skipped, never as a verdict
    results.update(unchanged)  # no `exit` either: SKIPPED, inputs unchanged since <sha>, never "passed"
    out_dir = os.path.dirname(os.path.abspath(out_path))
    with open(out_path, "w") as f:
        json.dump(results, f, indent=1)
    with open(os.path.join(out_dir, "gates-shard.json"), "w") as f:
        json.dump({"shard": shard, "of": shards, "total": total, "ran": ran, "unchanged": sorted(unchanged)}, f, indent=1)
    if mode == "record":
        # This shard's records only: those its traced gates wrote and those its
        # unchanged gates matched. merge-cone.py joins the shards.
        got = read_records(root) or {}
        mine = set(cands.values())
        checks = {s: r for s, r in got.get("checks", {}).items() if s in mine}
        with open(os.path.join(out_dir, "cone-records.json"), "w") as f:
            json.dump({"version": got.get("version"), "recipe": got.get("recipe"), "checks": checks}, f, indent=1)
        print(f"ci cone: {len(checks)} record(s) from this shard", flush=True)
    print(f"{len(results) - len(skipped) - len(unchanged)} gate(s) run: {green} green; {len(skipped)} skipped; {len(unchanged)} unchanged since their record", flush=True)


if __name__ == "__main__":
    main()
