---
name: build-ihris5-ig
description: >
  Build the iHRIS 5 FHIR IG from the source the ihris5 sub-instance pins, with fhir-harness,
  and publish it only on the pages branch. Use when the pin moves, a declared patch changes,
  or the IG site is wanted. The general steps are fhir-harness's; this skill is how this
  folio exercises them, and the rules that keep the upstream untouched.
input: src/schemas/skills/build-ihris5-ig/input.schema.json
output: src/schemas/skills/build-ihris5-ig/output.schema.json
---

# Build the iHRIS 5 IG

Owner, 2026-10-09: *"i want litlfred/ihris to say that ihris-5 is a named subgraph using fhir-harness"*, *"there should be justthedocs which uses AST sushi etc."*, *"we only publish ihris 5 under gh-pages"*.

## The capability

Turn a pinned, third-party IG source into a readable site in this folio's chrome, without holding or changing the source. The general steps, and their own rules, are fhir-harness's:

| step | general skill |
|---|---|
| make the IG's packages available, build it, publish to a pages branch | `ig-build-pipeline` |
| one Publisher build that also writes the AST | `ig-publisher-fork` |
| the artefact index, its pages and the IG's narrative, rendered with just-the-docs | `ig-render-jekyll` |

**The mechanism is Tool `ihris-build-ihris5-ig`**, and its steps are its subprocess, process `build-ihris5-ig`. Two smaller Tools carry the parts that are this folio's own: `ihris-mount-sources` (the pinned source, mounted) and `ihris-apply-ig-patches` (declared fixes, applied to a copy). A publish workflow runs the Tool by hand, and when the pin, the patches or the build change; a change proposal builds into its staging preview.

## Rules

- **The declaration is the pin.** The sub-instance declares its git source (repository, a full commit, the IG's path) and that it needs fhir-harness. Nothing else names the IG or its commit.
- **Describe, never materialize.** The source is mounted, verified and never committed; the build is never committed either. Only the pages branch holds the site and the AST's resources. The IG Publisher's own HTML is not deployed (owner, 2026-10-11: *"i dont want IG publisher to deploy to gh-pages"*); the Publisher runs only to write the AST.
- **Never edit the upstream, or the mount.** A defect in the IG's own source is reported upstream, and the folio builds meanwhile from a **declared patch**: the exact text it replaces and the reason. A patch that no longer applies exactly once fails the build, so an upstream fix is noticed rather than silently doubled. Only the owner decides between a patch and waiting.
- **Scoped chrome.** The site wears the platform chrome for this folio and what it needs, never the platform's whole harness list.
- **Thin pages.** The owner chose option A on 2026-10-11: *"tiny html w/ dynamic load from json(ld) KG"*, and thin is fhir-harness's default since 2026-10-12 (*"make thin default"*), so the build passes no flag for it.
  - Each artefact page is fhir-harness's thin shell, about 5.6 KB with the rail linked, in place of a full page of about 168 KB. Its asset is a WHO-free JSON-LD node beside it (`artifact/<Type>-<id>.jsonld`, fhir-harness Tool `ig-artifact-jsonld`).
  - `artifacts.html` and `toc.html` are thin shells (about 4 KB each, from about 170-210 KB) over one index node, `artifact/index.jsonld`. Every category is shown open.
  - The narrative (`index.html`) keeps its prose in the HTML, with the chrome linked rather than inlined (about 11 KB, from about 180 KB).
  - One shared script draws the pages from the nodes and the AST resources.
  - The build fails when the nodes' QA (`ig-artifact-jsonld.ts check`) finds a node missing, misnamed, or naming a resource that is not on the site, or when the index node does not list every artefact once.

## When a step cannot run

Three states, never two:

- **built and published**;
- **blocked, and why**: a defect in the IG source (the owner decides, above), or a package no trusted source carries. A refused package host is not a broken IG: fhir-harness names the remedy for each host (its Tool `fhir-cache-seed-npm`, with the owner's mirror). A version none of those carry is **missing**, and is never substituted in a build that publishes;
- **could not determine**: a step that did not run is never reported as a pass.
