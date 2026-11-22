import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "ig-ast-measure-real-igs",
    title: "Measure the AST export on real IGs",
    description:
      "Build the WHO SMART Trust and Immunizations IGs through `ig-ast-export` and print the fork's measurements: counts, whether FSH sources sit where the plan expects, and logic-layer edge coverage per resource type. `--byte-identical` adds a stock build and an `output/` diff.",
    install: { cli: "git clone -b claude/ast-export https://github.com/litlfred/fhir-ig-publisher" },
    invoke: { shell: "fhir-ig-publisher/ast-export/scripts/run-real-igs.sh [work-dir] [--byte-identical]" },
    io: {
      inputs: [{ name: "work-dir", schema: t("FilesystemPath"), required: false }],
      outputs: [{ name: "logic-covered", schema: t("Count"), description: "Logic resources carrying at least one edge to another logic resource in the IG." }],
    },
    satisfies: ["ig-publisher-fork"],
    selection: {
      when: "Measuring the AST exporter's coverage, on a machine that reaches the package registry.",
      limits: "The two IGs are fixed by repository name; the script knows nothing else about them.",
      cost: "Two full IG builds, three with `--byte-identical`.",
    },
    requires: { runtime: ["java", "maven", "sushi", "jekyll", "python3", "git"], network: true },
    remedies: [{ host: "packages.fhir.org", tool: "fhir-cache-seed-npm" }],
  }),
);
