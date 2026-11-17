---
input: schemas/skills/fhir-validation/input.schema.json
output: schemas/skills/fhir-validation/output.schema.json
---

# fhir-validation

> Skill id: `fhir-validation` · Package: `fhir-ig-authoring` ·
> Named by `l3-fhir-pipeline.bpmn` (**Validate against profiles**, `Build
> pipeline — SUSHI · validator · IG Publisher` lane) and
> `ig-incremental-build.bpmn` (**Validate the cone (fhir_validate)**,
> `Publisher + validator services (JVM)` lane).

Validate an IG's FHIR artefacts against the profiles and packages they claim to
conform to.

> **Sourcing.** Conformance is defined by the FHIR specification and by the
> packages an IG depends on; the validator is HL7's. This skill states how it is
> invoked **in this harness** and what each outcome is allowed to mean.

## Inputs and outputs

`fhir-harness/schemas/skills/fhir-validation/`:

- **in** — `igRoot` (required), `validationLevel`, `targetProfiles`
- **out** — `overallStatus` (required), `sushiResult`, `publisherResult`,
  `conformanceResults`

**SUSHI compiling is not conformance.** FSH can compile to JSON that the
validator then rejects, so a green `sushiResult` with an unrun
`publisherResult` is not a pass.

## The binaries

The package declares these capabilities (`providesCapabilities` in
`package-manifest.json`); each is defined, with its detection command, in
`scenarios/capabilities/`:

```sh
sushi --version                                    # sushi-compiler (requires node-runtime)
java -jar "${FHIR_VALIDATOR_JAR}" -version         # fhir-validator (requires java-runtime)
java -jar "${IG_PUBLISHER_JAR}" --version          # ig-publisher   (requires java-runtime)
```

`fhir-validator` is the standalone validator, **distinct from `ig-publisher`**,
which builds a whole IG. An authoring loop runs the validator on single
resources between builds; a release is cut from the publisher.

## When a package host refuses you

SUSHI and the Publisher resolve the IG's `dependencies:` from
`packages.fhir.org`. Where that host is refused, the failure looks like a
broken IG and is not one. Ask for the remedy:

```sh
bun run cat tools:remedy packages.fhir.org        # → fhir-cache-seed-npm, with its command
```

Every network-dependent Tool declares `remedies` per host it reaches
(`check:tools` enforces it), and `fhir-harness/scripts/ig-cache.sh doctor`
prints the same answer for each host it finds unreachable. For
packages.fhir.org it is `fhir-cache-seed-npm --sushi-config
sushi-config.yaml`, and for versions npm does not carry, `--mirror` from a
repository that `fhir-package-mirror` filled on a machine that reaches the
host. Pin that repository with `--mirror-commit <full 40-character SHA>`: git
cannot fetch an abbreviated SHA from a remote, and the seeder refuses one.

A cloud session can fill the mirror without a person's device, through a
GitHub Actions runner: push a `claude/mirror-*` branch that edits
`packages.txt` in the mirror repository, wait for its `mirror.yml` run, merge,
re-seed.

SUSHI also adds packages that `sushi-config.yaml` does not list, such as
`hl7.fhir.uv.tools.r4#latest`. A `#latest` needs the registry to name a version,
so offline it fails with errors that look like the IG's own (for example
`logical-target … does not exist`), even with the package in the cache. Serve
the mirror as a registry on localhost, answering `GET /<name>` with
`dist-tags.latest` and `GET /<name>/<version>` with the tarball, and run
`FPL_REGISTRY=http://127.0.0.1:<port> sushi build .`. Check which version
`latest` resolves to: it is the mirror's highest, which is only right when the
mirror holds the current release.

**Do not report "SUSHI cannot run here" before running `tools:remedy`.** A
refusal that `tools:remedy` answers with `none` is "could not determine" in
the sense of the next section: say so, with the reason it gave.

## A capability that is absent did not pass

If a probe fails, `overallStatus` is **not** a pass with an empty findings list.
It is "could not determine", and it is reported as such: a clean run over a
validator that never started looks exactly like a clean IG.

## Validating a cone

`ig-incremental-build.bpmn` validates a **restricted cone** — the artefacts a
change touches — rather than the whole IG, and reports the cone it chose. That
is a latency optimisation for the authoring loop. It does not gate a release:
the full publisher build in `l3-fhir-pipeline.bpmn` does.

Do not let a green cone stand in for a green IG: a profile the change did not
touch can still be broken by it.

## After validation

Quality gates on the aggregate are `quality-control`; publishing is
`ig-publication`. A validator's verdict is an input to the QC reviewer's
decision, not the decision.
