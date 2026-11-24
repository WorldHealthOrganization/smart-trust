import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "fhir-core",
    title: "Refer to HL7's published FHIR core definitions by canonical URL, and derive their UML class model",
    description:
      "Read HL7's own core package for each stable FHIR release (`https://hl7.org/fhir/R4/hl7.fhir.r4.core.tgz`, R4B, R5) at the sha1 and sha512 `fhir-core/pins.json` pins, and keep, under `fhir-core/<release>/`, only what refers to it or is derived from it: `index` writes the manifest (each resource, complex, primitive and root type by canonical URL, with HL7's published JSON for it, its kind, base and the sha256 of its bytes in HL7's package); `uml` derives the UML class model HL7 publishes only as pictures, citing the definition and element of every class and attribute; `materialise` fills a labelled local cache, never committed; `check` holds all of it to the pins offline; `resolve` answers with HL7's URL for a canonical (`--cache` for the cached copy); `diagram` prints a type's Mermaid class diagram. HL7's publication is the authority: a mirror may only fill the cache. A package that cannot be fetched or verified is recorded as `unread` with the reason, never as an empty graph.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/fhir-core.ts <index|uml|materialise|check|resolve <url>|diagram <Type>>" },
    io: {
      inputs: [
        { name: "root", schema: t("RepoPath"), required: false, arg: { flag: "--root" }, description: "The fhir-harness layer root. Default: the layer this script is in." },
        { name: "release", schema: t("Slug"), required: false, arg: { flag: "--release" }, description: "One release (R4, R4B or R5). Default: every pinned release (R4 for resolve and diagram)." },
        { name: "tgz-dir", schema: t("RepoPath"), required: false, arg: { flag: "--tgz-dir" }, description: "A directory holding an already-downloaded copy of HL7's package (`hl7.fhir.<r>.core.tgz` or `<name>-<version>.tgz`); still hash-checked against the pin." },
      ],
      outputs: [{ name: "definitions", schema: t("Count"), description: "Definitions indexed, classes derived or files cached per release; an unread release is named with its reason." }],
    },
    satisfies: ["ig-build-pipeline"],
    selection: {
      when: "Before a reader resolves a FHIR core type by canonical URL or draws a class diagram of core types (an IG's logical models or profiles over them), or when a pin changes.",
      limits: "Stable releases only. Constraint profiles, extension definitions and logical models in the core package are left out and counted. The class model copies no constraint, binding or description: the cited HL7 definition holds them.",
      cost: "One 4-17 MB download per release from hl7.org, then seconds; `check`, `resolve` and `diagram` are offline.",
    },
    requires: { runtime: ["bun"], network: true },
    remedies: [
      {
        host: "hl7.org",
        none: "Pass `--tgz-dir` with HL7's package fetched elsewhere: the bytes are still checked against HL7's hashes. Without it, `index` writes the release `unread` and `uml` cannot determine the class model; `materialise` may still fill the cache from a pinned mirror, file by file against the manifest.",
      },
    ],
  }),
);
