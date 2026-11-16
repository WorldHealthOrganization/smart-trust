---
name: l4-application-build
description: >
  Stage 8b of smart-guideline-end-to-end: build the consuming application
  against the stage-6 IG build (a clean build, not a publication), from the
  brief and the chosen stage-8a wireframes, with conformance tests from the
  IG's examples and test cases and a walk through each L2 user scenario it
  serves. Read before building an L4 application on a guideline.
input: L4/schemas/skills/l4-application-build/input.schema.json
output: L4/schemas/skills/l4-application-build/output.schema.json
---

# l4-application-build

> Skill id: `l4-application-build` · Package: `authoring-who-smart-guidelines` ·
> Stage 8b of [`smart-guideline-end-to-end`](../../../skills/content/authoring-who-smart-guidelines/smart-guideline-end-to-end.md),
> task `Task_BuildApp` of
> `smart-guideline-end-to-end.bpmn` (opt-in `smart-base.collab`).
> Adjudicated by the business analyst and the clinical SME (does it do what
> the L2 says?) and the FHIR modeller (does it conform to L3?).

## Input and output

The contract is [`input.schema.json`](../../schemas/skills/l4-application-build/input.schema.json) and [`output.schema.json`](../../schemas/skills/l4-application-build/output.schema.json).

- **In:** the `applicationBrief` (stage 7, [`l4-application-brief`](l4-application-brief.md)), the stage-6 `ig` build, and the stage-8a `wireframes` (cat-harness `wireframe-design-review`'s output: `topic`, `assetDir`, `candidates` with their `outcome`).
- **Out:** the `application`: where it is, how to `run` it, its staging `url`, the IG it was built `against`, and its `tests`, each `conformance` (an IG example or test case) or `scenario` (an L2 user scenario), with `pass`, `fail` or `not-run`.

## Steps

1. **Build from the chosen wireframe.** Use the candidate whose `outcome` is
   `chosen`; while the choice is pending, the agent's recommended one. A
   later choice of another candidate marks the screens built from the first
   `rejected-upstream`, as any derived asset.
2. **Build against the IG build, not its publication.** The stage-6 IG need
   not be published. Use the IG's canonicals and resources; the application
   adds no profile or value set of its own (one it needs is a stage-6
   finding).
3. **Test.** One `conformance` test per IG example and test case the
   application touches, and one `scenario` walk per L2 user scenario in the
   brief's `l2Processes`. Failing tests are reported, not hidden.
4. **Stage it.** The application is reviewed running, on the staged preview,
   beside the chosen wireframe of each screen.
