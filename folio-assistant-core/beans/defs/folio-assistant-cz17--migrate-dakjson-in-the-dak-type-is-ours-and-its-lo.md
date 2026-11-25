---
# folio-assistant-cz17
$schema: bean/1.0.0
title: 'Migrate dak.json in: the DAK type is ours, and its Logical Model is pending upstream'
status: completed
type: task
priority: normal
tags:
    - rehomed
created_at: 2026-09-18T21:36:56Z
updated_at: 2026-10-30T19:56:00Z
parent: folio-assistant-0lmb
---


## The correction this starts from

`dak.json` is **ours**, as part of L2 in `smart-base` — not a third-party file
we merely read. An earlier design note in bean `79t3` listed it alongside
`sushi-config.yaml` as "not ours to rename"; that is wrong for `dak.json` and
still right for `sushi-config.yaml`, whose name the SUSHI tool owns.

So `dak.json` is a marker we migrate **in**, not around.

## Landed now — the placeholder

`schemas/dak.ts` + `schemas/dak.test.ts` (11 tests). It models what is settled
and refuses to model what is not:

- `DAK_MARKER_FILENAME = "dak.json"` — presence at a repo root declares the
  repo a DAK, the same way `cat-harness.json` declares a harness instance.
- `DAK_TYPE` → `http://smart.who.int/base/StructureDefinition/DAK`, WHO's own
  logical model, via the existing `SMART_BASE_NS`.
- Identity and publication: `name`, `canonicalUrl`, `publicationUrl`,
  `previewUrl`, plus `title`/`description` from `kgNodeLabelShape`.
- The nine components: **cardinality enforced, element shape not**. Each is
  `0..* <Name>Source` in `smart-base`'s `input/fsh/models/DAK.fsh`; the array
  is final, the element is pending, so the element is `unknown` and carried
  through byte-identical.
- **Passthrough.** Unknown keys survive a parse-and-write round trip. A
  placeholder that dropped fields it had not learned about would destroy data
  from a real DAK on the first tool that read and rewrote one.
- The component shape is BUILT from `DAK_COMPONENT_FIELDS` in
  `schemas/block-kinds.ts`, not restated, so the two cannot drift.
- `populatedComponents` keeps three states apart: absent, declared-and-empty,
  and populated. "Nobody has said" is not "somebody said none".

## Blocked on upstream

- **waits on:** WHO's DAK Logical Model being final in FHIR — an external standards body
- **since:** 2026-09-20
- **expires:** 2026-09-29 — a REVIEW date, not a takeover date; see the handoff
- **handoff:** do NOT take this over on expiry. Re-ask whether the Logical Model has landed; if it has not, move the date out again and say so. Writing a `<Name>Source` type before it exists is the drifting second copy this bean was opened to prevent.


**WHO's DAK Logical Model is not final in FHIR.** Until it is, the element
shape of a component is unknowable and any `<Name>Source` type written here
would be a second, weaker, drifting copy of a specification about to exist —
the argument `schemas/dak-blocks.ts` already makes about
`ValueSet.compose.include`.

`scripts/tests/dak-blocks.test.ts` already checks the nine field names against
a real `DAK.fsh` when `SMART_BASE_HOME` points at a checkout, and reports
`n/a` — never a pass — when it does not. Extend that same pattern to the
element shape when the LM lands; do not invent it early.

## Still to do

1. **Fill in the element shape** once the LM is final, replacing `unknown` and
   turning the passthrough from a safety net into a narrowing choice.
2. **Wire `dak` into the type registry** so a repo carrying `dak.json` is
   recognised as a DAK instance — not blocked on bean `79t3`'s two open questions
   any more (both were answered on 2026-09-20 in the cat-harness store, and `dak` is registered in `schemas/content-types-base.ts`).
3. **Formalise `sushi` and `ig`** as the other two content types a
   `smart-*` repo declares. `ig` is half-there: `l3-fhir` exists as a
   translation content type with `fsh` and `fhir-json` formats, but nothing
   declares an IG **instance**.
4. **Migrate the real repos** — `smart-base` and the `smart-*` DAKs — and
   update the skills that still describe `dak.json` as somebody else's file:
   `skills/kg/kg-core/directory-conventions.md` §Naming cites it as an external
   model rather than as ours.

## Done when

A repository carrying `dak.json` is recognised as a DAK instance by the same
machinery that recognises a harness instance; the nine components resolve to
real typed content rather than `unknown`; and no consumer reading and
rewriting a real `dak.json` loses a field.

_2026-09-19T06:55:21Z_ — USER STORIES BELONG TO THIS BEAN, DEFERRED HERE DELIBERATELY BY THE OWNER, 2026-09-19: 'do not adopt SGUserStory now. bean for later as part of bean to get datamodel for DAK. we can relate them later.' The finding arrived while designing bootstrap/ (bean x3bd) and is recorded in full there; this is its home, because it is a DAK data-model question and not a bootstrap one.

WHAT WAS FOUND, so this bean does not have to re-derive it. Measured 2026-09-19 against a fresh shallow clone of WorldHealthOrganization/smart-base. (1) input/fsh/extensions/SGUserStory.fsh EXISTS and is two fields: `extension contains SGString named capability 1..1` and `SGString named benefit 1..1`, described as 'As a Actor I want to capability so that benefit'. It names no actor because it is an EXTENSION attached to something that already has one — attaching rather than declaring is what makes two fields sufficient. (2) It attaches to SGRequirements (input/resources/StructureDefinition-SGRequirements.json), which profiles FHIR Requirements and adds exactly three extensions: SGTask, Satisfies, SGUserStory. Base FHIR Requirements supplies `actor` (0..* canonical to ActorDefinition) and `statement` (key, label, conformance, requirement, satisfiedBy). So role, task, satisfies and story are one resource, and none of it needed a new type. (3) smart-base MODELS A SKILL AS A REQUIREMENTS INSTANCE — input/fsh/actors/SGAuthoring.Skills.*.fsh (ReviewAndApproveContent, L2Authoring, L3Authoring, ContentReview, Translation, Publication, ProjectManagement), each with actor pointing at an SGAuthoring.Persona.*, extension[task] codings, one extension[userstory], and numbered statements. OUR Skill is the instruction body and our Role carries skills[]; these are compatible but NOT the same node, and that mismatch is the thing most likely to bite an import.

AND WE HAVE ALREADY REBUILT MOST OF SGRequirements WITHOUT THE LABEL. skills/requirements/*.json here — seven files, agent-workflow.json at the root of the lattice — carry { id, title, description, actors[], statements[{ key, label, conformance, requirement, satisfiedBy[{kind, ref}] }] }. That is FHIR Requirements field for field, conformance codes included, arrived at independently. WHAT IS MISSING IS EXACTLY THE TWO EXTENSIONS: no task, no user story. So adopting later is two optional fields on a schema that already exists, not a new node kind, directory, builder, viewer or QA family.

THE DECISION DEFERRED, in the owner's words 'we can relate them later': whether to adopt SGUserStory's IRI (http://smart.who.int/base/StructureDefinition/SGUserStory) or mint a folio term and assert an equivalence. Adopting makes a DAK folio's stories literally the same objects as ours; minting keeps the harness free of a WHO dependency, which is the direction rule enforced everywhere else in this repo. Note that this bean has already taken the ADOPT side once, for a different object and with a stated reason — DAK_TYPE points at http://smart.who.int/base/StructureDefinition/DAK via SMART_BASE_NS, because the DAK logical model is WHO's. Whether the same argument carries to a user story is the open question: a DAK is WHO's concept, a user story is not.

WORTH LIFTING WHENEVER THIS IS PICKED UP, independent of the IRI decision: input/fsh/models/UserScenario.fsh writes `description[x] 1..1 string or uri` — the markdown inline OR a URI to a markdown file relative to the repository root. That is 'brief in the schema, rich in the docs' made STRUCTURAL rather than editorial, and it is the same problem the folio README split (generated markers vs authored prose) solves a different way.



## Handover 2026-10-06 — PAUSED until the repo separation lands (Session F, GOAL 5)

Owner ruling, relayed by the coordinating session (session_012qoycyCSGidZqW245vXhze): repo separation is the primary goal, content authoring/review/publication goes to folio-assistant-core while cat-harness keeps the methods, and that 'needs to be done before F'. This bean resumes AFTER the split. **The code it touches may have moved to folio-assistant-core by then — re-locate it before editing, and re-measure.** Open questions on it are being put to the owner by the coordinating session, one at a time; the answer will be recorded here, not assumed.


## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The DAK schemas now live in smart-base `schemas/dak-blocks.ts`, and `dak.json` was renamed `dak.config.json`. It is still blocked upstream on WHO's DAK Logical Model, and its re-ask date (2026-09-29) has passed: the Logical Model status should be re-asked whichever option is chosen. None of it lives in
folio-assistant-core, and AGENTS.md's one rule ("core owns content vocabulary;
the harness owns the harness") puts it outside this store's reach.

1. **(Recommended) Rehome to `litlfred/smart-base`'s bean store.** The bean is re-created
   there with this body, and this copy is scrapped with a pointer to the new id.
2. Keep it here as a pointer, and do the work from this store against `litlfred/smart-base`.
3. Scrap it. The finding no longer matters after the separation.

**Default if no answer:** option 1.


## Rehomed 2026-10-10: this copy is now a pointer

By the owner's ruling of 2026-10-10 (move to the code's repo, and keep a
pointer here). The code this bean changes is in smart-base, which has no bean store. Its owning copy is
therefore the **same id in the cat-harness store**
(`litlfred/folio-assistant`, branch `cat/cat-harness/beans`,
`beans/defs/folio-assistant-cz17--*.md`), which is open there. Work it there.
This copy stays open as a pointer, and closes when that one does.


## Claimed 2026-10-24 (FHIR beans thread, session_01Bye99WLJxQpyCxh2eMgW19)

Re-measured: `DAK.fsh` and every `<Name>Source` in `DAKComponentSources.fsh` are `#active` on litlfred/smart-base main. Item 1 drafted as smart-base#151 (issue #150): the url / canonical / instance wrapper is typed, and the inline instance stays `unknown`. Scope (wrapper only, all nine models, or keep blocked) is on the owner's decision card.

_2026-10-24T08:30:35Z_ — Owner chose **A** (type the source wrapper only; card, 08:27Z) and OK'd the merge (08:30Z). smart-base#151 merged as eb3f9b5: each of the nine formalized components takes WHO's url / canonical / instance wrapper, exactly one; the inline instance stays `unknown` by that choice. Item 1 is done to the agreed scope. Still open: items 2 to 4 (type registry, the `sushi`/`ig` content types, migrating the real repos).

_2026-10-26T10:39:18Z_ — `litlfred/cat-harness#521` merged (`65e1673b`: `index.config.json` content-type sections as markers and `directory-conventions.md` updated for `contentTypes.dak`); `litlfred/smart-base#156` ("Move the DAK declaration into index.config.json (contentTypes.dak)") is open.

_2026-10-29T07:35:00Z_ — smart-base#156 (e61ef9c) merged: the DAK declaration lives in index.config.json `contentTypes.dak`; IGs still on dak.json keep building with a warning. Still open: items 2 to 4 (type registry, `sushi`/`ig` content types, migrating the other smart-* repos; WHO repos only with the owner's OK). Session https://claude.ai/code/session_01Qmmkt87nxnLXyraNsmmpKH (Drain FHIR and smart layer work).


## Claimed 2026-10-24 (FHIR beans thread, session_01Bye99WLJxQpyCxh2eMgW19)

Re-measured: `DAK.fsh` and every `<Name>Source` in `DAKComponentSources.fsh` are `#active` on litlfred/smart-base main. Item 1 drafted as smart-base#151 (issue #150): the url / canonical / instance wrapper is typed, and the inline instance stays `unknown`. Scope (wrapper only, all nine models, or keep blocked) is on the owner's decision card.

_2026-10-24T08:30:35Z_ — Owner chose **A** (type the source wrapper only; card, 08:27Z) and OK'd the merge (08:30Z). smart-base#151 merged as eb3f9b5: each of the nine formalized components takes WHO's url / canonical / instance wrapper, exactly one; the inline instance stays `unknown` by that choice. Item 1 is done to the agreed scope. Still open: items 2 to 4 (type registry, the `sushi`/`ig` content types, migrating the real repos).

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
   recognised as a DAK instance. No longer blocked: `79t3` closed 2026-10-24
   (owner, "Close it as done"). The marker convention is settled as
   `contentTypes.dak` in `index.config.json` (cat-harness#521), and two
   markers that disagree are reported, not silently resolved (79t3's Done when).
```

_2026-10-30T13:30:00Z_: **Item 3, `ig`, is done.** The owner chose the form by card at 12:40Z: "A. ig section in index.config", not `sushi-config.yaml` as the marker. At 12:41Z the owner added a principle: "a harness can point to a repo, but doesnt want to automatically slurpo up all content in a repo. harness desclares what it it pays attention to in the repo." Merged:
- litlfred/fhir-harness#194 (`3c3efa17`): `schemas/ig-content-type.ts` registers `ig` as `{ indexSection: "ig" }`. The section carries `include`, the repository paths the harness reads. `igDeclares` and `assertIgDeclares` refuse any other path, and an empty or missing list declares nothing. It has 8 tests, and the type IRI is `…/ns/ig-ast#IgRepository`.
- litlfred/cat-harness#720 (`ecc231a4`): `directory-conventions.md` gains a markers-table row for `contentTypes.ig`, and the principle as its own subsection.
- litlfred/smart-base#209 (`b89284d4`): smart-base declares `contentTypes.ig` with its include list. With consent, fhir-harness and cat-harness are re-pinned to the commits above, and cat-harness-tools, bootstrap-tools and bootstrap to their mains, which the new cat-harness needs.

`sushi` is unchanged: `sushi-config.yaml` stays SUSHI's marker, registered in smart-base's `dak-content-type.ts`.

Follow-ups:
- (a) Gate fhir-harness's existing IG readers (`build-ig-indexes.ts`, `ig-repo-site.ts`, `build-ig-site.ts`, `fsh-cone.ts` and others) on `include`. An IG that does not declare the section yet must be treated as legacy, not broken.
- (b) Declare `contentTypes.ig` in the other litlfred smart-* IGs.
- (c) Nothing imports `ig-content-type.ts` (or `dak-content-type.ts`) outside tests yet, so the default registry learns `ig` only when the module is loaded.

Item 4 is still open. Report: litlfred/aai-programme#26.

_2026-10-30T13:10:50Z_: **Follow-ups (a) and (c) are done.** Merged:
- litlfred/fhir-harness#198 (`a67dc4d6`): the new `scripts/ig-read-scope.ts` turns `contentTypes.ig` into the check each IG reader runs before it touches a path. These readers are gated: `build-ig-indexes`, `ig-repo-site` (`compose` copies only the `include` entries), `build-ig-site` (`stageIgSite` stages from a declared copy), `fsh-cone`, `ingest-ig-menu`, `ingest-ig-chrome`, `ig-api-hub`, `ig-site-data`, `ig-review-data` and `measure-logic-layer-edges`. An IG with no section is read as before, as a legacy IG, and gets one warning per run that names the missing declaration. smart-ra, smart-immunizations, smart-trust and smart-hiv declare none today. A section with no usable `include` is refused. The input digest in `ig-ast.ts` is not gated, because it must match the Java exporter. `pipeline/plugin-slots.ts`, the module `loadContributions` requires for every dependent, now imports `ig-content-type.ts`. Tests: 12 new; suite 699 pass, 2 fail, and the same 2 fail on main.
- litlfred/smart-base#210 (`5435bfbd`): `pipeline/qa-checkers-dak.ts`, smart-base's contribution module, imports `dak-content-type.ts`, so `dak` and `sushi` are registered at load time. As a result, `dak-*` verdicts read as stale until the next sweep.
- litlfred/smart-base#212 (`f2401a0e`): smart-base re-pins fhir-harness to `a67dc4d6` (with consent, evidence "A. ig section in index.config"), so its own site build reads only its `include`.

Content types are still registered by import side effect from each layer's contribution module. A declared `content-types` contribution kind in cat-harness would make that explicit, and it is not done. Still open: (b), declaring `contentTypes.ig` in the other litlfred smart-* IGs, and item 4. Report: litlfred/aai-programme#26.

_2026-10-30T16:25:00Z_: **Item 4, smart-immunizations, is done.** The owner chose by card at 15:38Z ("Choose when smart-immunizations drops dak.json"): "B. Use litlfred workflow now". Merged litlfred/smart-immunizations#89 (`23f6bba0`):
- `.github/workflows/fhirbuild.yml` calls `litlfred/smart-base/.github/workflows/fhirbuild.yml@main`, not WorldHealthOrganization's. Neither side has inputs or secrets. The repository now drifts from WHO's workflow, as the card said.
- `dak.json` moved unchanged into `index.config.json` `contentTypes.dak`, and the file is deleted. Nothing in the repository read it. In the mounted layers, smart-base reads `contentTypes.dak` first, and cat-harness-tools' translation scripts fall back to `dak.json` only for a `translations` block this file never had.
- `contentTypes.ig.include` lists `sushi-config.yaml`, `ig.ini`, every entry under `input/` (25 entries) and `fsh-generated/`. The legacy warning from fhir-harness#198 no longer applies to this repo.
- Re-pinned with consent: smart-base `c89c2057`, fhir-harness `d45d9917`, and cat-harness `ecc231a4`, cat-harness-tools `9326f5d7`, bootstrap `3ce2b5d6`, bootstrap-tools `fdceeca3` (smart-base's own set).
- SUSHI 3.16.5 reports 0 errors. `check:ig-annex-links` and `check:subgraphs` pass.

Both called `fhirbuild.yml` files are only the HL7 autobuild trigger. The `dak.json` reading that smart-base#156 changed is in `ghbuild.yml`, which smart-immunizations does not call. Still open: the same move for smart-trust, smart-hiv and smart-ra (follow-up (b)), and item 2. Report: litlfred/aai-programme#26.

_2026-10-30T16:55:00Z_: **Follow-up (b) is done.** smart-trust, smart-hiv and smart-ra now declare `contentTypes.ig.include`, following the smart-immunizations#89 model. Evidence: owner card 2026-10-30T12:40Z, "A. ig section in index.config", merge window to 18:13Z. Merged:
- litlfred/smart-trust#82 (`8652594e`). The list holds `sushi-config.yaml`, `ig.ini`, `local-template/`, every entry under `input/` (11) and `fsh-generated/`. `local-template/` is the template `ig.ini` names (`template = #local-template`); `build-ig-site`'s `localTemplateIncludes` renders its `includes/`, and `stageIgSite` copies only declared paths. Re-pinned with consent to the #89 set: smart-base `c89c2057`, fhir-harness `d45d9917`, cat-harness `ecc231a4`, cat-harness-tools `9326f5d7`, bootstrap `3ce2b5d6`, bootstrap-tools `fdceeca3`. SUSHI reports 0 errors. `check:subgraphs` reports 2 broken links, both inside the unchanged folio-assistant-core pin `e332458` (`archiving-arxiv.md` and `filing-dublin-core.md` → `../../../../cat-harness/docs/source/…`). The PR's CI ("Harness PR checks") was still queued at merge time, and the PR was merged under "merge all ready".
- litlfred/smart-hiv#21 (`89bac6ba`). The list holds `sushi-config.yaml`, `ig.ini`, `local-template/`, `templates/` (sushi-config's `path-liquid` is `templates/liquid`), every entry under `input/` (18) and `fsh-generated/`. Re-pinned to the same set. SUSHI reports 0 errors, and `check:subgraphs` exits 0.
- litlfred/smart-ra#104 (`bae605d7`). The list holds `sushi-config.yaml`, `ig.ini`, every entry under `input/` (24) and `fsh-generated/`; the folio is the `dpi-h-ra` document instance's and is not listed. There was no re-pin: smart-ra#102 had just pinned fhir-harness `c11cc79`, which is past #198. SUSHI reports 0 errors, and `check:subgraphs` exits 0.

SUSHI needed `hl7.fhir.uv.tools.r4#latest`, which was served from fhir-package-mirror (`7bd59336…`) as a localhost registry (`FPL_REGISTRY`) and resolved to 1.3.0. Without it, smart-hiv shows the 12 `logical-target` errors that `fhir-validation` documents.

**New finding, not fixed:** cat-harness-tools ≥ `9326f5d7` renders workflow pages that link `<site>/cat-harness/state.jsonld` (render stage 3, `dynamic-state-export.ts`). Only `render-pipeline.ts` writes that file; `build-instance-site.ts` does not. A folio site build with those pins (smart-ra `stage-local --dry-run`) therefore fails its link gate on 1 unresolved link (`en/cat-harness/beans/cat-harness-tools/workflows/crdm-detect-evaluation-r-…/index.html`) and refuses to publish. smart-ra main now pins cat-harness-tools `f5349b5`, which is past `9326f5d7`.

Still open: item 2, and dropping `dak.json` in smart-trust, which still has one. Report: litlfred/aai-programme#26.

_2026-10-30T17:50:00Z_: **smart-trust has dropped `dak.json`.** The owner chose by card at 16:56Z: "A. Do both now". Merged litlfred/smart-trust#84 (`6a638759`), following smart-immunizations#89:
- `dak.json` moved unchanged into `index.config.json` `contentTypes.dak` (`smart.who.int.trust`), and the file is deleted. Nothing in the repository read it. In the mounted layers, smart-base's readers take `contentTypes.dak` first, and the cat-harness-tools translation fallback needs a `translations` block, which this file never had.
- `.github/workflows/fhirbuild.yml` calls `litlfred/smart-base/.github/workflows/fhirbuild.yml@main`, not WorldHealthOrganization's. Neither side has inputs or secrets. smart-trust has no `ghbuild.yml`, and no other workflow read `dak.json`.
- `contentTypes.ig.include` (#82, 15 entries) is unchanged. #84 made no re-pins: it was branched on the #89 set, and main had meanwhile been re-pinned by #85 (re-pin wave, `1e3dd34`), which merged cleanly with it.
- SUSHI 3.16.5 reported 0 errors and 28 warnings. `readIgDakMetadata` reads `index.config.json#contentTypes.dak`, at both pin sets. `check:ig-annex-links` found no annex declared. `check:subgraphs` exited 1, and main fails the same way. At the #89 pins, 2 links break, inside folio-assistant-core `e332458` (fixed on its main, but that re-pin brings 105 commits). At #85's pins, 83 links break: 49 in cat-harness-tools-tests, 22 in skills, 8 in schemas, 3 in cat-harness-tools-scripts and 1 in core-skills. They come from that re-pin, not from this change. The PR's CI passed prepare and typecheck; the test shards were still queued at merge, under "merge all ready".
- litlfred/smart-trust#77 (the earlier attempt, opened before #82) is now superseded and still open. Merging it would roll smart-base and cat-harness back to `e61ef9c` / `6f7f10a`.

No litlfred smart-* IG carries `dak.json` any more: smart-hiv and smart-ra have none on main. Still open: item 2. Report: litlfred/aai-programme#26.

_2026-10-30T19:56:00Z_: **Completed.** Every item is done to the agreed scope:
- Item 1: the source wrapper is typed (smart-base#151, owner card A, 2026-10-24); the inline instance stays `unknown` by that choice.
- Item 2: `dak` and `sushi` are registered by smart-base `schemas/dak-content-type.ts` (`indexSection: contentTypes.dak`), loaded by smart-base#210, so a repository declaring `contentTypes.dak` is described as a DAK instance (`content-types-stack.test.ts`).
- Item 3: `ig` (fhir-harness#194, #198; smart-base#209).
- Item 4: no litlfred smart-* IG carries `dak.json` (smart-immunizations#89, smart-trust#84); `directory-conventions.md` updated (cat-harness#521); smart-base#211 (`625ab83`, merged 19:3xZ) renames the `dak-config-from-sushi` tool and docs to `contentTypes.dak`.

Superseded and closed unmerged: smart-immunizations#88 (replaced by #89) and folio-assistant-core#239 (its log lines are covered by the entries above). smart-trust#77 is also superseded (see 17:50Z) and should be closed. WHO repos are untouched. Thread "Finish IG and DAK beans", session https://claude.ai/code/session_01Qmmkt9C9fukFK42vgZRrKc.
