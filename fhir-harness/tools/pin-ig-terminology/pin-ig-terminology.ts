import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

// ── The terminology a mapping check resolves against ─────────────────
//
// Owner, 2026-09-30, on what the `fhir` half of `check:term-mapping`
// asserts: **"published IG at a version"** (bean `ejug`). So this node
// refreshes a PIN, and a live terminology service is not this node: "this
// code exists in IG X at version V" and "this code is in a curated
// collection today" are different claims that can disagree. A service
// node, when one is reachable, earns its own node beside this one.
//
// Moved down from cat-harness, where it was named for, and hard-coded
// the paths of, one IG (#1767, stage B′). Which IG is pinned is
// the caller's to say, which keeps this layer naming none.
//
// `satisfies: ["vocabulary-authority"]`: that core skill decides WHICH
// vocabulary owns a fact, and this node supplies the FHIR side's
// authority. Satisfying a core skill from here is the allowed direction.
export default toolFactory((t) =>
  defineTool({
    id: "pin-ig-terminology",
    title: "Snapshot a published IG's terminology at its pinned version",
    description:
      "Read every CodeSystem concept out of a FHIR IG clone checked out at its pinned tag and write a `folio-pinned-terminology/v1` snapshot: the offline, version-fixed answer `check:term-mapping` resolves its `fhir` target against. Which IG, which pin record and which snapshot path are the caller's (`--pin`, `--out`, `--source`); this layer names none.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/pin-ig-terminology.ts --from <clone> --pin <pin record> --out <snapshot> --source <repository URL>" },
    // `network: false` is the claim that matters and it is exact: the
    // script reads a clone from disk and never fetches. The clone is made
    // by hand at the pinned tag, because cloning an external repository is
    // not something a gate should do, and because neither IG host is
    // reachable from here anyway.
    requires: { runtime: ["bun", "git"], network: false },
    io: {
      inputs: [
        // NO `arg` binding, and that is the type speaking rather than an
        // omission. `FilesystemPath` exists precisely for a path that may
        // point OUTSIDE the repository — the clone is made in a scratch
        // directory — and its own docblock says it is "refused as a
        // command-line word": `..` is what `RepoPath` forbids, and
        // weakening `RepoPath` to admit this would remove traversal
        // protection from every port that uses it. `check:tools` refuses
        // the pairing (measured 2026-09-30), so declaring `--from` here
        // would be asserting a safety property the type withholds. The
        // flag is in `invoke.shell`, where it is a person's command line
        // rather than a contract a caller may fill from untrusted input.
        { name: "from", schema: t("FilesystemPath"), required: true, description: "A clone of the IG checked out at the PINNED tag, passed as `--from`. The script refuses unless that clone's `sushi-config.yaml` version equals the pin's, so a newer clone cannot silently become the snapshot." },
      ],
      outputs: [
        { name: "snapshot", schema: t("RepoPath"), description: "The `--out` path, `folio-pinned-terminology/v1`: the version, the source, and every `system#code` with its display, sorted." },
      ],
    },
    satisfies: ["vocabulary-authority"],
    selection: {
      when:
        "The authority a term is checked against must be a fixed artefact a reader can name and re-fetch — a published IG at a version. Also the only option where the vocabulary's host is unreachable.",
      limits:
        "The version comes from the `--pin` record and NEVER from this script, so refreshing means moving the pin first and re-running; re-running against a newer clone is refused rather than silently accepted. It answers only for what the IG publishes at that version — a code added after it, or curated in a collection rather than published, is absent, and `check:term-mapping` reports that as `unmapped` (a checked miss) and not as `undetermined`. Nothing here dereferences a code system IRI.",
      cost:
        "One shallow clone at the tag (~120 KB of FSH at v1.0.0) and a few seconds. The snapshot is committed, so no run at check time.",
    },
  }),
);
