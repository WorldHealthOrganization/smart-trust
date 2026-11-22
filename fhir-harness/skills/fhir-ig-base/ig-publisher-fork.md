---
name: ig-publisher-fork
description: >
  Requirements for an agent working a local experimental fork of the IG
  Publisher — which repositories, what the AST must carry, what must not
  change, and the acceptance criteria. Read before forking, and before
  reporting a fork's work complete.
---

# ig-publisher-fork

> Skill id: `ig-publisher-fork` · Package: `fhir-ig-base` · Layer:
> `fhir-harness`

The brief for an agent taking a **local, experimental** fork of the FHIR IG
Publisher, so that an AST can be emitted and cached.

## Which repositories, and why only one

| repository | holds | needed for |
|---|---|---|
| `HL7/fhir-ig-publisher` | orchestration, the loaded resources, **`DependencyAnalyser`**, `CqlSubSystem`, the metadata exports | the dump, the toolchain record, **the logic-layer dependency edges** |
| `hapifhir/org.hl7.fhir.core` | the renderer, the validator, dependency loading | **page-fragment provenance** only |

The logic-layer edges are a publisher-side gap, not a core one:

- `DependencyAnalyser` is in the **publisher**
  (`org.hl7.fhir.publisher.core/.../igtools/publisher/`). Its `analysePD` and
  `analyseAD` are empty stubs, and Library and Measure are not dispatched.
  That is the whole criterion-2 gap.
- `CqlSubSystem` already attaches CQL `depends-on` to each Library
  (`AdjunctFileLoader`), so Library→Library edges exist in memory; nothing
  exports them.

Only page-fragment provenance needs core. Read upstream before re-quoting
either claim.

## The shape taken: a library ON TOP, not a fork IN it

Do not change existing Publisher code unless there is no other way:
remarshal, reuse, subclass. The work is `ast-export/`, a separate Maven
project on branch `claude/ast-export` of `litlfred/fhir-ig-publisher`. It
depends on the **released** `org.hl7.fhir.publisher.core` from Maven Central,
is not a module of the root pom, and changes no Publisher file.

- `AstPublisher extends Publisher` and overrides nothing. It reads
  `getFileList()` after `execute()`.
- `AstFieldsAccess` is a read-only view of package-private `PublisherFields`,
  declared in the Publisher's package **inside the library**. A rename
  upstream fails to compile rather than failing at run time.
- Upstream's `DependencyAnalyser` is **reused unchanged**; `LogicEdges` sits
  beside it.

That makes "behind a flag, default byte-identical" true by construction for
the Publisher itself: a stock build never loads the library. What still needs
measuring is that `AstExportCli`'s own build writes the same `output/` as a
stock one.

## The tools an agent runs

In the fork, under `ast-export/`:

| tool | what | network |
|---|---|---|
| `scripts/run-real-igs.sh [work] [--byte-identical]` | W1/W2 on the WHO SMART Trust IG and the WHO SMART Immunizations IG, W2 per resource type | packages.fhir.org, tx.fhir.org |
| `scripts/w7-round.sh <work>` | one incremental round on a one-CQL-file change | same |
| `AstExportCli`, `AstPlanCli`, `IncrementalBuildCli` | export, plan a delta, rebuild the cone | export and rebuild: yes; plan: no |

Here, [`ig-ast-delta`](ig-ast-delta.md) lists, checks, diffs and renders what
those produce. The one CI path is `.github/workflows/ig-ast-refresh.yml`: it
runs `AstExportCli` on a runner, at the pinned commit, to refresh an IG's AST
cache, calling the same exporter and `ig-cache.sh`.
[`ig-build-pipeline`](ig-build-pipeline.md) §"The AST cache lifecycle" owns
it. Any other CI calls these same scripts.

## Without packages.fhir.org: seeding the cache from trusted sources

Some environments reach GitHub and `registry.npmjs.org` but not
`packages.fhir.org`. The seeder fills the FHIR package cache from sources that
are each a **trust anchor**: named by the owner, or the package's own
publisher. Nothing else is consulted. There are two copies:
`ast-export/scripts/seed-fhir-cache-from-npm.py` in the fork, which
`ig-ast-refresh.yml` runs, and `scripts/fhir-cache-seed-npm.ts` here, which
the Tool `fhir-cache-seed-npm` invokes.

| source | trust | what it holds |
|---|---|---|
| npm, account `grahamegrieve` | **owner: trusted**. Grahame Grieve founded HL7 FHIR | mostly the latest version of each HL7 package; core packages under `@hl7/` |
| a publisher's own published-site repository on GitHub | the publisher's own published site | every released version that publisher hosts there |
| a template's own repo at HEAD | `FHIR/ig-registry/templates.json` names it; **owner: `fhir.base.template` is trusted** | templates, `#current` included |
| `--mirror` | whoever ran `mirror-fhir-packages.sh` (Tool `fhir-package-mirror`) | what the others lack |

Rules:

- **Exact versions only.** A pin is never satisfied by another version; there
  is no "approximate" build with substituted versions. The one exception is
  the Publisher's own rule: a patch wildcard (`1.1.x`) resolves to the
  highest `1.1.N` a source lists, and the resolution is recorded.
- **Verified.** npm tarballs against npm's sha512. Every other source must
  carry a `package/package.json` naming exactly the requested package and
  version. npm's `0.0.1-security` malicious-package placeholder is refused.
- **Nothing computed once and kept.** Load from the repositories every run;
  do not compute once and assume it fixed. The template registry, the IHE
  folder listing and any mirror clone are fetched fresh every run into a
  scratch directory deleted at exit. There is no table of package locations
  that could go stale behind the registry.
- **Provenance** in `ast-export-npm-provenance.json`: the source, URL or
  commit, and hash of every package.

**Where it stands**, measured over the WHO SMART Trust and Immunizations IGs:
20 packages install, including both templates. Missing are the pinned HL7
versions (IPS, terminology, extensions, CQL, CRMI, SDC, IPA),
`fhir.cqf.common` and `us.nlm.vsac`.

To close the gap:
1. Run the seeder with `--missing-out missing.txt`.
2. Run `mirror-fhir-packages.sh <repo> missing.txt` on a machine that reaches
   packages.fhir.org.
3. Run the seeder again with `--mirror <repo>`.

**What the declared dependencies miss.** Seeding from `sushi-config.yaml`
alone leaves the build short (Publisher 3.0.0 / core 7.0.1):

- **The template.** It is named in `ig.ini`, not in `sushi-config.yaml`, so
  pass it to the seeder as a positional `name#version`.
- **A template seeded from its repo keeps the repo's layout.** The template's
  own files go at the top of the cache entry, and only `package.json` goes under
  `package/`. The Publisher reads a cached template with
  `NpmPackage.fromFolder`, which files a top-level file under `package/$root`
  and unpacks it into `template/`. A file under `package/` lands in
  `template/package/`, and the build fails with `template/config.json not
  found`.
- **Packages the Publisher loads by itself:**
  - `hl7.fhir.pubpack` at `CommonPackages.VER_PUBPACK`;
  - `hl7.fhir.xver-extensions` at `CommonPackages.VER_XVER`;
  - `hl7.fhir.uv.tools.r<N>` at `Publisher.TOOLING_IG_CURRENT_RELEASE`, for the
    IG's FHIR release;
  - the latest milestone of `hl7.terminology.r<N>` and
    `hl7.fhir.uv.extensions.r<N>`, when the IG does not declare them.
  Read the versions from the release you build against. Never copy them from
  here, because they move with each release.
- **"Latest" offline is not exact.** When it cannot reach the registry,
  `getLatestVersion` falls back to the highest version in the local cache. That
  silently breaks the exact-versions rule. Mirror the version the registry
  lists today, and record which version it was.

**An offline validator crash that is not ours.** In core 7.0.1,
`InstanceValidator.checkTypeValue` fetches the approved additional resources
from `fhir.github.io`. When that fetch fails it dereferences a null set, so
the build fails with an NPE on `additionalResourceNames`. Only an environment
that cannot reach `fhir.github.io` meets it. It is upstream's bug
(`org.hl7.fhir.core`), and it is not patched here, because the library does
not change Publisher code.

**Build with a terminology server.** A `-tx n/a` build, which is
`run-real-igs.sh --no-tx`, is only for finding faults before the real run. Its
numbers are never recorded as measurements.

**A template the registry does not list** is named by the caller with
`--template-repo <name>=<owner/repo>`, on the command line, never stored.

**Publishers' site repositories.** The fork's seeder keeps one fixed table
mapping a package-name prefix to the publisher's own GitHub repo. It can
drift, which is tolerated only because every package fetched through it must
name itself exactly in its own `package.json`, so a stale entry fails as
"missing", never as a wrong package. The copy here holds no such table: the
caller maps each prefix with `--site-repo <prefix>=<owner/repo>[@branch]`,
none by default, because which publishers exist is not something fhir-harness
may know.

**An IG's package lock.** An IG that pins its FHIR packages commits a
`fhir-packages.lock.json` at its root, in the format of this layer's
`scripts/sushi/fhir-packages.lock.json`: `{"packages": [{"name", "version",
"tarball", "integrity"}]}`, where `tarball` is an exact https URL (a
commit-pinned one for a package a site repository publishes) and `integrity` is
`sha512-<base64>` or `sha256-<base64>`; a hex `sha256` may be given instead or
as well, and every hash given must match. `--lock <file>` installs each pinned
package from its URL only, refuses one whose bytes or `package.json` do not
match, and does not follow its dependencies, so the lock lists the IG's
packages in full. `ig-ast-refresh.yml` (input `package-lock`, default
`fhir-packages.lock.json`) and `ig-ast-build.sh` (`--package-lock`) run it before
SUSHI and the Publisher, so neither fetches a package the lock pins. A package's
URL is named in the lock, never derived from its name.

## The measurement that justifies the work

Using the Publisher's current metadata exports as an AST proxy across two real
IGs:

| export | the WHO SMART Trust IG | the WHO SMART Immunizations IG |
|---|---|---|
| `valueset-ref-list.json` ValueSet→CodeSystem edges | 17 over 14 | 431 over 252 |
| `codesystem-ref-list.json` `uses` populated | 0 of 15 | 0 of 14 |
| `usage-stats.json` extension→path | 6 | 35 (+5 profiles) |

Two findings:

1. **`uses` is declared and never populated** — in *both* IGs.
2. **Nothing exports Library / PlanDefinition / Measure dependencies** — 458
   artefacts, **61 % of the WHO SMART Immunizations IG**, the decision-logic
   core, with zero edges.

Re-derive both before quoting them. If a later Publisher release closes
either, the fork's scope shrinks accordingly.

## Acceptance criteria

The AST must carry:

- [ ] **one structured record per resource**, keyed by canonical URL *and*
      version — an id alone collides across versions
- [ ] **dependency edges among Library, PlanDefinition and Measure** — the gap
      above. Built as `LogicEdges`; **not yet measured** on the WHO SMART
      Immunizations IG. **Measured as**: every logic resource has at least one
      logic-to-logic edge in *either* direction. In graph terms, no vertex is
      isolated. Outgoing edges alone cannot be the test, because a finite
      acyclic dependency graph always has a sink: a library that others depend
      on and that depends on no logic itself. `run-real-igs.sh` prints both
      counts.
- [ ] **`uses` actually populated**, or an explicit statement that it cannot be
      — a declared-and-empty field is worse than an absent one, because a
      consumer cannot tell "no dependencies" from "not computed"
- [ ] **page-fragment provenance** — which source produced which output
      fragment, so a rendered page can be traced without re-running
- [ ] **the resolved dependency closure with pinned versions**
- [ ] **terminology expansion provenance** — which server, which version, and
      whether expansion actually happened; a build against a dead `tx` must be
      distinguishable from an IG with thin ValueSets
- [ ] **a `toolchain` object** — publisher version, core version, SUSHI
      version. `publisher.jar` is re-downloaded from the *latest* release on
      every WHO build, so without this an AST cannot say what produced it

And the fork itself must satisfy:

- [ ] **emitted behind a flag**, with default behaviour byte-identical when the
      flag is absent
- [ ] **upstreamable shape** — a flag and an additional writer, not a rewrite;
      a fork that cannot be offered back has no exit
- [ ] **no change to validation or rendering semantics.** If a fork build's
      `qa.json` differs from an upstream build's on the same input, that is a
      defect in the fork, and it is the first thing to check

## What the agent must not do

- **Do not treat the AST as an authority.** It is a cache: its indices,
  dependency edges and versions are unverified until a full run. Anything
  written to consume it says so — see
  [`ig-publisher-reduction`](ig-publisher-reduction.md) §P3.
- **Do not vendor either repository into this one.** The fork lives at its own
  remote; exactly one repository runs a thing.
- **Do not add WHO, DAK or SMART concepts to the fork.** The AST is a property
  of a FHIR IG. A DAK-shaped field in it makes the fork unofferable upstream
  and breaks the layering `fhir-harness` exists to keep.
- **Do not fix `uses` by inferring it.** If the information is not there,
  report that it is not there. An inferred edge in a dependency graph is
  indistinguishable from a real one downstream, and every ordering metric
  computed from it becomes unfalsifiable.

## Reporting

A fork round reports: which repositories at which commits, which criteria are
met, which are not, and **what was measured rather than what was implemented**.
A criterion is met when an AST from a real IG is shown to carry the thing. The
WHO SMART Immunizations IG is the right subject: it carries the 61 % gap.
