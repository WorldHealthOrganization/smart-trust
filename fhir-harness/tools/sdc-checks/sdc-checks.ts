import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "sdc-checks",
    title: "Check an IG's built Questionnaires with CSIRO's SDC libraries",
    description:
      "Build-time Structured Data Capture checks, one result per Questionnaire (`sdcChecks[]` of `fhir-questionnaire-wireframe`): `assemble` (`@aehrc/sdc-assemble` 2.0.3: an assemble-root's sub-forms resolve in this IG, and `--out` writes the assembled Questionnaire), `template-extract` (`@aehrc/sdc-template-extract` 1.0.16: extraction from the IG's fixture response yields the expected resources), `populate` (`@aehrc/sdc-populate` 4.7.2: FHIRPath pre-population from a fixture context gives the expected answers) and `behaviour` (`@aehrc/questionnaire-test-toolkit` 0.1.0: the IG's own behavioural test, warn-only). Checks only, no UI.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/sdc-checks.ts --ast <ast> [--questionnaire <id>] [--fixtures <dir>] [--out <dir>] [--json]" },
    io: {
      inputs: [
        { name: "ast", schema: t("FilesystemPath"), required: true, description: "The IG's FHIR AST (`output-ast/`): its Questionnaires, and the canonicals a sub-form resolves against." },
        { name: "questionnaire", schema: t("Text"), required: false, description: "A Questionnaire id to check; default every one in the AST." },
        { name: "fixtures", schema: t("FilesystemPath"), required: false, description: "One directory per Questionnaire id: `response.json` + `extract-expected.json`, `populate-context.json` + `populate-expected.json`, `behaviour.test.tsx`." },
        { name: "out", schema: t("FilesystemPath"), required: false, description: "Where assembled Questionnaires are written." },
      ],
      outputs: [{ name: "sdcChecks", schema: t("Text"), description: "Per Questionnaire, per check: pass, fail, not-applicable, no-fixture or could-not-determine — the last three never a pass. JSON with `--json`. Exit 1 on an error-severity failure; behavioural tests never fail the run." }],
    },
    satisfies: ["fhir-questionnaire-wireframe"],
    selection: {
      when: "After SUSHI has built the IG's Questionnaires and before they are reviewed as forms; whenever a Questionnaire uses modular sub-forms, template extraction or pre-population.",
      limits: "Only as good as the IG's fixtures: with none, extraction and population say `no-fixture` rather than pass. Nothing is fetched from a server: sub-forms resolve in the AST and population queries in the fixture. The behavioural toolkit is early and needs React and Smart Forms peers installed with the IG's tests; without them it is `could-not-determine`, a warning.",
      cost: "Seconds per Questionnaire; a behavioural test runs a bun test process.",
    },
    requires: { runtime: ["bun"], network: false },
  }),
);
