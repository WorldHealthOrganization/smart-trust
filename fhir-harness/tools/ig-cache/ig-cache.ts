import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "ig-cache",
    title: "FHIR AST cache",
    description:
      "Restore, verify, seed and diagnose the prebuilt AST artefacts for an IG. Always try `restore` first: a full AST build via AstExportCli is expensive, a restore is fast. `seed` commits the IG API a layer above generates from the AST (`ig-site:sidecars`, via `ig-api-cache.ts`) as `ig-api/` beside it, and the artefact index built from that tree (`ig-index-cache.ts`) as `fhir-artifact-index/index.json`, so a site reads both by raw URL at the cache commit.",
    install: { none: true },
    invoke: { shell: "fhir-harness/scripts/ig-cache.sh" },
    io: {
      inputs: [
        { name: "action", schema: t("IgCacheAction"), required: true, arg: { positional: 0 }, description: "The verb. `doctor` diagnoses a restore that missed." },
        { name: "igRoot", schema: t("RepoPath"), required: false, arg: { flag: "--ig-root" }, description: "The IG whose AST is acted on." },
        { name: "package", schema: t("PackageName"), required: false, arg: { flag: "--package" } },
        { name: "remote", schema: t("PackageName"), required: false, arg: { flag: "--remote" }, description: "Git remote to fetch from / push to. Default 'origin'. Use when the IG's origin is upstream and the cache lives on a fork." },
      ],
      outputs: [{ name: "result", schema: t("Text"), description: "A real hit, a miss, or a diagnosis — never a miss that reads as a hit." }],
    },
    satisfies: ["compiled-artefact-cache", "ig-ast-delta"],
    requires: { runtime: ["bash", "git"], network: true },
    remedies: [
      { host: "packages.fhir.org", tool: "fhir-cache-seed-npm" },
      { host: "tx.fhir.org", none: "No declared Tool replaces the terminology server. The HL7 IG Publisher's own `-tx n/a` skips terminology validation, at the cost of not validating it." },
    ],
  }),
);
