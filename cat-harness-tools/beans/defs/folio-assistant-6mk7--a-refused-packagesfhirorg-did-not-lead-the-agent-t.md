---
# folio-assistant-6mk7
$schema: bean/1.0.0
title: 'A refused packages.fhir.org did not lead the agent to fhir-cache-seed-npm: symptom-to-Tool lookup is missing, and the mirror the skill names does not exist'
status: completed
type: bug
priority: high
created_at: 2026-10-06T06:31:37Z
updated_at: 2026-10-06T16:00:00Z
parent: folio-assistant-rwmf
---

Owner, 2026-10-06: *"why didnt you know about the tool already? what KG process broke down?"*

## What happened
Session https://claude.ai/code/session_01EcBv3uwKYcnNbCC6BcPG92 needed SUSHI clean on three IG repositories (owner preference). SUSHI failed: packages.fhir.org is refused by the egress proxy. The agent told the owner "SUSHI can't run in this container" and moved on. The owner pointed at the answer ("github.com clone egress. check tools"): Tool `fhir-cache-seed-npm` (fhir-harness/tools/index.ts) exists for exactly *"an environment that cannot reach packages.fhir.org"*.

## Why the graph did not surface it
1. **The MCP server was down** (`folio-assistant` CONNECTION_CLOSED at session start), so `skill_list` / `skill_fetch` / Tool lookup were unavailable. AGENTS.md says to fall back to the `kg` graph declared in `<instance>.json`. Nothing prompted that fallback when a capability was missing.
2. **The diagnostic that sees the symptom does not name the remedy.** `ig-cache.sh doctor` prints `network: packages.fhir.org UNREACHABLE` and stops.
3. **No symptom-to-Tool index.** A Tool says what it does. Nothing lets an agent go from "host X refused" to the Tool whose description names X. The only prose pointer is deep in `fhir-ig-base/ig-publisher-fork.md` §"Without packages.fhir.org".
4. **The documented gap-closer does not exist.** That skill names `--mirror https://github.com/litlfred/fhir-package-mirror` for the 24-25 pinned HL7 versions that are on neither npm nor publisher sites. Measured the same day, that repository does not exist (`list_repos`: no match; `ls-remote` asks for credentials). With the seeder, smart-trust still lacks 25 packages, so SUSHI still cannot run here.

## Done when
- [x] `ig-cache.sh doctor`, and any check that finds packages.fhir.org unreachable, names `fhir-cache-seed-npm` and its command
- [x] the skill an agent reads before running SUSHI points at the seeder (the owner chooses which skill that is)
- [x] the owner decides on a general symptom-to-Tool lookup (for example a `remedies:` field on a Tool, keyed by the host or error it addresses, with a gate keeping it non-empty for network-dependent Tools)
- [x] `litlfred/fhir-package-mirror` exists and is filled from a machine that reaches packages.fhir.org, or the skill stops naming it
- [x] MEASURED AFTER: in a container with packages.fhir.org blocked, SUSHI on smart-trust exits 0 using only documented tools

_2026-10-06T06:42:37Z_ — Claimed by claude/bold-brahmagupta-c8eoku — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).


## 2026-10-06: litlfred/fhir-package-mirror created and seeded across smart-trust, smart-base, smart-immunizations

### 1. Fixes in fhir-ig-publisher (branch claude/ast-export)
- Resolved IHE profile path lookups in ihe_paths() for profiles already prefixed with ihe. (such as ihe.formatcode.fhir), mapping wildcard 1.2.x to 1.2.0 from IHE/publications.
- Updated check_cached() in seed-fhir-cache-from-npm.py to recognize @hl7/ scoped names when checking cached packages, preventing false mismatches against npm packages installed under the @hl7/ scope.

### 2. Seeder Runs & Missing Detection
Ran python3 fhir-ig-publisher/ast-export/scripts/seed-fhir-cache-from-npm.py --sushi-config <ig>/sushi-config.yaml --missing-out missing-<ig>.txt on clean cache:
- smart-trust: 22 installed, 23 missing (missing-smart-trust.txt).
- smart-base: 1 installed, 0 missing (missing-smart-base.txt).
- smart-immunizations: 4 installed, 9 missing (missing-smart-immunizations.txt).
- Merged unique missing specs (missing-all.txt): 24 packages (fhir.cqf.common#4.0.1, us.nlm.vsac#0.9.0, and 22 pinned HL7 packages).

### 3. Repository Creation & Mirroring
- Created litlfred/fhir-package-mirror on GitHub (gh repo create litlfred/fhir-package-mirror --public --clone).
- Ran fhir-ig-publisher/ast-export/scripts/mirror-fhir-packages.sh fhir-package-mirror missing-all.txt: downloaded 24 packages from packages.fhir.org, verified SHA512SUMS, committed and pushed to main.
- Round 2: Transitive dependencies surfaced when mirror packages were installed (hl7.terminology.r4#5.0.0, fhir.dicom#2022.4.20221006, hl7.fhir.uv.smart-app-launch#2.0.0, hl7.terminology.r4#7.1.0, hl7.fhir.uv.cpg#1.0.0) mirrored (5 packages) and pushed to main (total 29 packages mirrored in litlfred/fhir-package-mirror).

### 4. Verification with Mirror
Re-ran seeder with --mirror https://github.com/litlfred/fhir-package-mirror:
- smart-trust: 50 installed or present, 0 missing (exit code 0).
- smart-base: 1 installed or present, 0 missing (exit code 0).
- smart-immunizations: 17 installed or present, 0 missing (exit code 0).

### 5. SUSHI Builds
Executed sushi build . (SUSHI v3.20.1) across all three IGs:
- smart-trust: 0 errors, 26 warnings (exit code 0).
- smart-base: 0 errors, 16 warnings (exit code 0).
- smart-immunizations: 0 errors, 1 warning (exit code 0).

## Measured 2026-10-06 ~09:00Z in the blocked container (session https://claude.ai/code/session_01EcBv3uwKYcnNbCC6BcPG92)
packages.fhir.org is refused here. I used only `fhir-cache-seed-npm` with `--mirror https://github.com/litlfred/fhir-package-mirror`, then SUSHI v3.20.1, on the `claude/seed-smart-base` branch of each IG:

| IG | seeder | SUSHI |
|---|---|---|
| smart-trust | 50 present, 0 missing | **exit 0**, 0 errors, 28 warnings |
| smart-immunizations | 17 present, 0 missing | **exit 0**, 0 errors, 3 warnings |
| smart-base | 1 present, 0 missing | **exit 15**, 15 errors, 17 warnings |

### smart-base: the seeder does not follow transitive dependencies
The seeder resolves only smart-base's DIRECT pins and reports '0 missing'. SUSHI then needs what `hl7.fhir.uv.cpg#2.0.0` depends on, and cannot download it:
- `hl7.fhir.uv.crmi#2.0.0`: this is where all 14 'Parent … crmi-shareable* not found' errors come from
- `hl7.fhir.uv.cql#2.0.0`
- `hl7.fhir.uv.sdc#4.0.0`
- `hl7.terminology#7.3.0`
- (`hl7.fhir.uv.tools.r4#latest` is SUSHI's automatic package; it is a warning-level miss)

The owner's local run had 0 errors because that machine reaches packages.fhir.org, so SUSHI fetched these itself. The '0 missing' is therefore a false clean (the dh4f shape): the seeder judged a set it had not closed over.

### To close
1. Mirror those four exact versions (`mirror-fhir-packages.sh` on a networked machine).
2. Make the seeder close over the `dependencies` of every package it installs, so '0 missing' means SUSHI will find everything. Today it means only that the direct pins were found.

## Owner rulings and delivery, 2026-10-06 (session https://claude.ai/code/session_01EcBv3uwKYcnNbCC6BcPG92)
- **Which skill:** "fhir-validation". It gains §"When a package host refuses you", and `ig-build-pipeline` points to it.
- **Symptom-to-Tool lookup:** "remedies: field + gate". Delivered as follows.
  - `ToolRemedySchema` (`cat-harness/schemas/tool.ts`): one `{ host, error?, tool | none }` entry per host, on the Tool that NEEDS the host. `none` is a stated value, as `install.none` is.
  - Gate in `check:tools`. A `requires.network: true` Tool with no `remedies` fails, and a `remedies[].tool` naming no declared Tool fails. Before the entries were filled, the gate reported "28 network-dependent Tool(s) with no `remedies`".
  - All 28 network Tools are filled, with hosts taken from each Tool's own scripts. Workarounds declared:
    - packages.fhir.org → fhir-cache-seed-npm;
    - release.lean-lang.org ("Host not in allowlist") → lean-toolchain-setup;
    - github.com for beans-cli → beans-manual;
    - huggingface.co / pypi.org → transcribe-whisper-cpp.
    Every other entry is a stated `none` with its reason.
  - Lookup: `bun run cat tools:remedy <host | URL | error line>`, using `remediesFor`. `bun run cat tools:remedy packages.fhir.org` prints `packages.fhir.org refused → use fhir-cache-seed-npm` and the seeder's command.
- **`ig-cache.sh doctor`:** for each unreachable host it prints the graph's answer via `tools:remedy`. Its probe also read an HTTP/2 `200` as unreachable, because `grep '200 OK'` never matches `HTTP/2 200`. It now reads the status code.
- **Tests:**
  - `cat-harness/scripts/tests/tool-remedies.test.ts` covers the schema, the gate and the lookup, with synthetic Tools.
  - `test/tools-checkout.test.ts` checks that the real graph is fully remedied and that packages.fhir.org leads to fhir-cache-seed-npm.

## Still open, not in this bean's Done-when
The four transitive packages smart-base needs (crmi#2.0.0, cql#2.0.0, sdc#4.0.0, terminology#7.3.0) are not mirrored yet, and the seeder does not follow transitive dependencies. Both are recorded above, and both need the owner's networked machine.
