import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

// ── The IG AST (bean `a9tx`) ─────────────────────────────────────────────
// The producer is `ast-export`, a library ON TOP of the IG Publisher in
// litlfred/fhir-ig-publisher@claude/ast-export; the consumer is
// `scripts/ig-ast.ts` here. Owner, 2026-09-30: no GitHub Actions for now,
// and any CI later calls THESE tools rather than re-implementing them.

export default toolFactory((t) =>
  defineTool({
    id: "ig-ast-export",
    title: "Build an IG and write its AST",
    description:
      "Run one ordinary IG Publisher build through `AstPublisher` (a subclass that overrides nothing) and write the AST beside `output/`: one JSON file per resource keyed `canonical|version`, `dependencies.json` (upstream's DependencyAnalyser plus the Library/PlanDefinition/ActivityDefinition/Measure edges it leaves empty), SUSHI's `fsh-index.json`, and a manifest that declares itself a cache and records the inputs it is valid for.",
    install: { cli: "git clone -b claude/ast-export https://github.com/litlfred/fhir-ig-publisher && cd fhir-ig-publisher/ast-export && mvn -q package && mvn -q dependency:build-classpath -Dmdep.outputFile=cp.txt" },
    invoke: { shell: "java -cp \"target/classes:$(cat cp.txt)\" org.hl7.fhir.igtools.ast.AstExportCli -ig <ig> [-ast-out <dir>]" },
    io: {
      inputs: [
        { name: "ig", schema: t("FilesystemPath"), required: true, description: "The IG root." },
        { name: "ast-out", schema: t("FilesystemPath"), required: false, description: "Default `<ig>/output-ast`, OUTSIDE the Publisher's `output/`." },
      ],
      outputs: [
        { name: "resources", schema: t("Count"), description: "Resources written, one file each." },
        { name: "edges", schema: t("Count"), description: "Dependency edges, including those whose target is outside the IG (kept, `resolved: null`)." },
      ],
    },
    satisfies: ["ig-publisher-fork"],
    selection: {
      when: "Producing a base AST for incremental work, or measuring what an IG's logic layer depends on.",
      limits:
        "Taken AFTER the build, so resources carry generated narratives. It is a full Publisher run: it needs the package registry and a terminology server, and an environment without them cannot run it.",
      cost: "A full IG build: minutes to tens of minutes.",
    },
    requires: { runtime: ["java", "maven", "sushi", "jekyll"], network: true },
    remedies: [
      { host: "packages.fhir.org", tool: "fhir-cache-seed-npm" },
      { host: "tx.fhir.org", none: "No declared Tool replaces the terminology server. The HL7 IG Publisher's own `-tx n/a` skips terminology validation, at the cost of not validating it." },
      { host: "repo1.maven.org", none: "The Maven build needs Maven Central; a populated `~/.m2` from an earlier build is the only other source." },
    ],
  }),
);
