---
name: toolchain-ownership
description: >
  Taking ownership of the WHO smart-base scripts in litlfred, rewriting them
  to the Skill I/O contract, and the one gate that governs when a script may
  actually move. Read before touching, copying or rewriting any upstream
  smart-base script.
---

# toolchain-ownership

> Skill id: `toolchain-ownership` · Package: `authoring-who-smart-guidelines`

How the WHO SMART toolchain moves out of an IG and into the harness without
becoming a fork nobody can merge back. The goal is a
`WorldHealthOrganization/smart-base` that is a conventional IG with no
tooling.

## The gate

> **A script moves only when a Tool node, a skill and a process step that binds
> them all exist for it.**

All three, before any Python relocates. The Tool node says what it consumes
and produces; the skill says how and when a person or agent performs it; the
process step is what hands it out. A Tool with no process step is
unreachable: a script moved into that state leaves a place where a workflow
runs it every build and arrives where nothing runs it.

The gate does not limit declaring. Declaring runs ahead: `smart-base/tools/`
carries Tool nodes for scripts that still execute upstream, which is the
intended state for now — **declare here, execute upstream, until the
execution moves too.**

## Declaring is not vendoring

[`smart-base-tools`](smart-base-tools.md)'s rule *load it; never vendor it*
stands: a copy of the Python would be a second, drifting toolchain. A Tool node
is a declaration and duplicates no implementation.

When code does move, it is a **cutover**, not a copy: afterwards exactly one
repository runs that script. If both do, a fork has happened, not a move.

## Where ownership lives

**The `smart-base/` harness layer in `litlfred/smart-base`**, whose
`smart-base/tools/` holds the Tool nodes. It is not a separate fork of the WHO
IG.

**Nothing at `WorldHealthOrganization/*` changes.** This is work in
`litlfred/*`, which is also why the DAK declaration in `index.config.json`
(`contentTypes.dak`) is ours until upstream adopts it.
`WorldHealthOrganization/smart-base` is read-only from here and stays the
executing home until the gate is satisfied per script.

A moved script arrives in a directory that is **not a FHIR IG**: `ghbuild.yml`
cannot run it and there is no `input/scripts/` for it. So a move is a rewrite
to the harness's own invocation surface, which is the Skill I/O work below.

## What "adhere to Skill I/O requirements" means

A rewritten script must be describable by its Tool node without hedging:

- **Declared inputs and outputs**, each with a type from the shared vocabulary
  — not "it reads the repository and writes some files".
- **A determined empty is distinguishable from a failure.** The upstream
  scripts report `files_expected` against `files_missing`, which separates
  "this DAK has no DMN" from "the DMN directory was not found". Keep it.
- **Exit status means something.** Several upstream steps warn and continue
  when their script is absent, so a missing capability reads as a clean run.
  The `ci-health` rule — *could not check is never green* — is the most
  common thing to fix while rewriting.
- **No hidden fetch.** Upstream scripts `curl` themselves from smart-base
  `main` at build time. A rewritten script does not fetch itself.

## Rewrite in this order

1. **Declare** the Tool node against the script as it is today, not as it
   should become.
2. **Write the skill**, which shows whether the capability is one thing or
   several (`update_sushi_config.py` is four jobs in one script).
3. **Bind it** in a process, in the lane whose role performs it.
4. **Then** rewrite and move, with a cutover.

Steps 1–3 are reversible and cheap. Step 4 is neither.

## What is already declared

`smart-base/tools/` declares the upstream DAK scripts beside the harness's own
tools; count the directory rather than trusting a number. The two `Library`
strippers (`strip-library-binaries`, `strip-library-content`) are declared in
`fhir-harness/tools/`, because they are not DAK-shaped; see
[`smart-stack-layering`](smart-stack-layering.md).
