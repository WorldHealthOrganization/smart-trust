import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

// ── The translation-supplement check ─────────────────────────────────
//
// Invoked by `.github/workflows/translation-supplements.yml`, the reusable
// workflow an IG repository calls on its pull requests. It satisfies
// `fhir-validation`, whose contract asks only for `igRoot`: it validates the
// IG's CodeSystem supplements against the CodeSystems they supplement.
//
// What is checked without SUSHI: a missing `<ig-root>` exits 2 with usage,
// and an IG with no `input/fsh/translations/` exits 0, not applicable. The
// SUSHI runs are exercised by `check-translation-supplements.test.ts` over the
// fixture IG in `test/support/translation-supplements/`.
//
// `--sushi <bin>` and `--tarballs <dir>` are left out of the ports on purpose:
// both take a path that may lie outside the repository (the workflow keeps the
// tarballs in `$RUNNER_TEMP`), a `FilesystemPath`, which is not admissible as a
// command-line word. They are command-line conveniences for a person or a
// workflow, never values the graph passes.
export default toolFactory((t) =>
  defineTool({
    id: "check-translation-supplements",
    title: "Compile and check an IG's translation CodeSystem supplements",
    description:
      "Compile the IG's CodeSystems with every `input/fsh/translations/<locale>.fsh` CodeSystem supplement in a throw-away FSHOnly SUSHI project, require 0 SUSHI errors, and check that each supplement's base CodeSystem is the IG's own, its codes are a subset of the base's, its language is the file's locale, and every CodeSystem id is unique. SUSHI is the version `ig-toolchain.env` pins, installed from `scripts/sushi/package-lock.json` with install scripts off; the FHIR core package is pinned by sha512; SUSHI runs with no network.",
    install: { cli: "npm ci --ignore-scripts --no-audit --no-fund --prefix fhir-harness/scripts/sushi" },
    invoke: { shell: "bun run fhir-harness/scripts/check-translation-supplements.ts" },
    io: {
      inputs: [
        { name: "igRoot", schema: t("RepoPath"), required: false, arg: { positional: 0 }, description: "The IG root; default the working directory. Only paths its `contentTypes.ig.include` declares are read." },
        { name: "json", schema: t("Flag"), required: false, arg: { flag: "--json" }, description: "Print the result as JSON." },
      ],
      outputs: [
        { name: "verdict", schema: t("Text"), description: "Exit 0 pass or not applicable, 1 findings (each named with its file), 2 could not run. Could-not-run is never a pass." },
      ],
    },
    satisfies: ["fhir-validation"],
    selection: {
      when: "A pull request changes an IG's CodeSystems or its translation supplements, and the IG build is not run on it.",
      limits: "Compiles only CodeSystems, Aliases and RuleSets with the supplements: a base CodeSystem written as an Instance, or one from another package, is reported as missing.",
      cost: "One SUSHI run of a few seconds; the first run fetches the pinned FHIR core package (megabytes).",
    },
    requires: { runtime: ["bun", "node", "npm"], network: true },
    remedies: [
      { host: "registry.npmjs.org", none: "SUSHI and the FHIR core package both come from npm. Without it, pass `--sushi` an installed SUSHI of the pinned version and `--tarballs` a directory holding the core tarball; both are still verified." },
    ],
  }),
);
