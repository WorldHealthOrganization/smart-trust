import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

// ── The FSH cone ─────────────────────────────────────────────────────
//
// Moved here from the tools layer on the owner's ruling of 2026-10-14 (Q3):
// FHIR Shorthand is this layer's domain, and its other users —
// `ig-rendered-impact.ts`, `measure-logic-layer-edges.ts` and the IG AST's
// `-fsh-users` input above — are here. The id is unchanged.
//
// Group 12 of `d308` (`h588`). `ig-incremental-build · Task_Cone` names
// `fsh-cone --changed` in its own task label, so this binding is read off the
// diagram rather than inferred.
//
// **One skill satisfied, two refused on their own contracts.** Measured
// 2026-09-20 against `schemas/skills/*/input.schema.json`:
//
//   fhir-validation     requires igRoot                      → SATISFIABLE
//   ig-publication      requires igRoot + versionIncrement    → refused
//   l3-fhir-authoring   requires artifactType + sourceModel   → refused
//
// `fsh-cone` computes a dependency cone over a FSH graph: it publishes
// nothing and authors nothing, so it has no version to increment and no
// source model to render from. Declaring those edges would put this node
// forward as the mechanism for two jobs it does not do — the
// `covered-is-not-reachable` shape, manufactured on purpose.
//
// What is checked without an IG: a missing `<ig-root>` exits 2 with usage,
// measured, not assumed. The cone itself is exercised by `fsh-cone.test.ts`
// over a fixture tank.
export default toolFactory((t) =>
  defineTool({
    id: "fsh-cone",
    title: "FSH dependency cone",
    description:
      "Compute the dependency cone over an IG's FSH graph, and the blast radius of a set of changed files. It is what lets an incremental IG build rebuild less than everything.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/fsh-cone.ts" },
    io: {
      inputs: [
        { name: "igRoot", schema: t("RepoPath"), required: true, arg: { positional: 0 }, description: "The IG root holding the FSH sources. Absent, the command exits 2 with its usage — could-not-determine, not an empty cone." },
        { name: "csv", schema: t("RepoPath"), required: false, arg: { flag: "--csv" }, description: "Write the report as CSV to this path instead of printing it." },
        { name: "top", schema: t("Count"), required: false, arg: { flag: "--top" }, description: "Show only the N largest cones; `0` shows none." },
        { name: "history", schema: t("Count"), required: false, arg: { flag: "--history" }, description: "Report the blast radius over the last N commits instead of a static cone." },
        { name: "fileUsers", schema: t("RepoPath"), required: false, arg: { flag: "--file-users" }, description: "Also write `fsh-file-users/v1`: for each FSH file, the files that use what it declares. The IG AST's incremental plan reads it (`AstPlanCli -fsh-users`) so a changed RuleSet- or Alias-only file reaches its users rather than forcing a full build." },
        // `--changed f1,f2,…` stays UNDECLARED: it is a comma-separated list
        // inside ONE argv word. `Slug` forbids the comma, `repeated` would
        // claim the flag may be given more than once when the script parses a
        // single list, and `Text` is refused on argv by the injection rule.
      ],
      outputs: [
        { name: "cone", schema: t("Text"), description: "The cone, or the impact of `--changed`. With `--csv` it goes to that path instead." },
      ],
    },
    // ONE skill, not three — see the header for why the other two contracts
    // refuse this mechanism rather than merely lacking it.
    satisfies: ["fhir-validation"],
    requires: { runtime: ["bun"], network: false },
  }),
);
