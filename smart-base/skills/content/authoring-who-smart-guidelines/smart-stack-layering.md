---
name: smart-stack-layering
description: >
  Which layer a WHO SMART asset, rule, script or page belongs to — fhir-harness,
  smart-base (with its L1 and DAK document kinds) or smart-ig — and the one
  question that settles it. Read before adding anything to fhir-harness,
  smart-base or smart-ig, before creating a per-IG harness, and before moving a
  pre/post-processing step.
governs:
  - fhir-harness/fhir-ig-skills
  - smart-base/tools
---

# smart-stack-layering

> Skill id: `smart-stack-layering` · Package: `authoring-who-smart-guidelines`

## The stack

```
folio-assistant-core
  └── fhir-harness              bare FHIR IG pipeline — no WHO anything
        └── smart-base          WHO SMART harness rules + data models; instantiates smart.who.int.base
              │                   ├─ L1  document kind — semi-fixed, computed from smart-base's library (+ PICO, Cochrane …)
              │                   └─ DAK document kind — fixed: the ten components
              └── smart-ig      L3 — the FHIR IG publication a DAK feeds
```

There is no `smart-guidelines` layer. L1 and DAK are **document kinds**, not
layers: things an author produces with the smart-base harness, with no code,
tools or processes of their own. An IG is a layer, because it is published
through the IG Publisher; every ingested IG (`smart-trust`,
`smart-immunizations`) `needs: smart-ig`.

**L1, DAK and the IG are not a chain.** An L1 document with no DAK behind it
is real, and so is an IG with no L1; an IG does not depend on a narrative
corpus it never reads.

## The question that settles placement

Ask in this order; the first match wins:

> **1. Would a non-WHO FHIR IG need this?** → `fhir-harness`.
> **2. Would every WHO SMART asset need it, L1, L2 and L3 alike?** → `smart-base`.
> **3. Is it about publishing one guideline's FHIR IG?** → `smart-ig`.
> **4. Otherwise** → `smart-base`, as part of the L1 or DAK document kind it serves.

Question 1 is yes only if you can name one non-WHO IG that would want the
thing.

## No layer between smart-base and its kinds

`smart-base` is the home of WHO SMART policy and also instantiates its own IG.
Do not re-introduce a `smart-guidelines` layer under another name: a
`smart-common`, a `smart-core`, a `shared/` skills package that only the WHO
kinds import. A rule that L1, DAK and the IG all need is `smart-base`'s. A
"layer" that holds no code of its own is a kind.

## What each layer may hold, and what it may not

| layer | holds | must NOT hold |
|---|---|---|
| `fhir-harness` | SUSHI, IG Publisher invocation, Jekyll assembly, publication to a pages branch, the artefact-index reconstruction | any WHO term, the DAK declaration (`index.config.json` `contentTypes.dak`), any DAK pre/post step, any `smart.who.int` canonical |
| `smart-base` | the SMART harness rules, the DAK logical model, the schema of the `contentTypes.dak` index section, WHO voices and methodologies, the `smart.who.int.base` IG — **and the two document kinds:** L1 (narrative assets, figure narratives, the corpus a DTH is written from) and DAK (the ten components, DMN/BPMN authoring, the DAK-shaped pre-processing) | subject matter for any one guideline; FHIR resources in an L1 document; FHIR profiles or publication in a DAK |
| `smart-ig` | L3 — FSH, profiles, terminology binding, the IG build for one guideline | L1 narrative; DAK authoring |

## Two consequences

**1. There is no per-IG harness.** `smart-trust` and `smart-immunizations`
are **layers on `smart-ig`**, not harnesses: they add no new
functionality.

**2. `fhir-harness` may not import the WHO package.** A dependency on
`authoring-who-smart-guidelines` would stop a non-WHO IG from instantiating it
while still passing every gate. The upper layer may know the stack; the lower
layer may not. This skill lives in the WHO package and describes
`fhir-harness`, which is that direction.

## smart-base becomes a conventional IG

`WorldHealthOrganization/smart-base` does two jobs: it **is** an IG
(`smart.who.int.base`, FHIR 4.0.1, its own profiles and logical models), and
it **hosts the toolchain every downstream SMART IG runs** — `ghbuild.yml` is a
reusable workflow, and a downstream build `curl`s its scripts from
smart-base's `main` at build time. The second job is to end, because:

- **A downstream IG's build depends on a branch it does not control**, so it
  can change without its repository changing.
- **The IG and the toolchain version together.** A fix to one is a release of
  the other.
- **The tooling is invisible to the harness.** Scripts in `input/` are not
  Tool nodes, so no process can bind them and no audit can reach them.

The migration is `smart-base/tools/`: Tool nodes now, execution later.
Declaring is not vendoring — see [`smart-base-tools`](smart-base-tools.md).
This is work in `litlfred/*` only; nothing at `WorldHealthOrganization/*`
changes, and the DAK declaration in `index.config.json` is ours until
upstream adopts it.

## The falsification test

> **Every step of the existing WHO build assigns to exactly one layer.**

The build is the DAK pre- and post-processing around one Publisher run, plus
the deploy, in `WorldHealthOrganization/smart-base`'s
`.github/workflows/ghbuild.yml` (the `do_dak` input gates the pre and post
phases). If a step cannot be placed, or two layers both claim it, **the split
is wrong** and this skill changes. Do not resolve a conflict by adding a
layer; report it. The per-step assignment is in
[`dak-preprocessing`](https://github.com/litlfred/smart-base/blob/main/smart-base/L3/skills/smart-l3/dak-preprocessing.md) and
[`dak-postprocessing`](https://github.com/litlfred/smart-base/blob/main/smart-base/L3/skills/smart-l3/dak-postprocessing.md).

**Current result: all 26 steps place** (6 pre-processing, 1 Publisher run, 9
post-processing, 10 deploy), none needs a new layer and none has two owners.
Three are placed against their labels:

| step | labelled | placed |
|---|---|---|
| `strip_library_binaries.py` | DAK Postprocessing | `fhir-harness` |
| `strip_library_content.py` | DAK Postprocessing | `fhir-harness` |
| comment on PR — deployment completed | (deploy) | `cat-harness` |

The deploy phase is entirely generic — see
[`ig-build-pipeline`](../../../../fhir-harness/skills/fhir-ig-base/ig-build-pipeline.md)
§"The deploy phase". Re-run the test when a step is added upstream.

## Where a layer says which layer it is

In its declaration's `needs`, and nowhere else: `needs: ["smart-ig"]` is a
published WHO SMART IG, `needs: ["smart-base"]` a WHO SMART layer that
publishes no IG, `needs: ["fhir-harness"]` a non-WHO IG. Which document kinds
a layer authors (L1, DAK) is a property of its content. There is no
`layer` field.

Conventions for the declaration:
[`directory-conventions`](../../../../cat-harness/skills/kg/kg-core/directory-conventions.md).
