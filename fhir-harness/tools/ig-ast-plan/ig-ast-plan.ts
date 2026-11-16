import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "ig-ast-plan",
    title: "Plan an incremental IG build from a delta of changed files",
    description:
      "Map a delta (a commit range, a PR's diff, or the staged index) onto a base AST: which resources to rebuild (the forward cone), which to load from cache, which to remove, or a full build and why. Builds nothing.",
    install: { cli: "git clone -b claude/ast-export https://github.com/litlfred/fhir-ig-publisher && cd fhir-ig-publisher/ast-export && mvn -q package && mvn -q dependency:build-classpath -Dmdep.outputFile=cp.txt" },
    invoke: { shell: "java -cp \"target/classes:$(cat cp.txt)\" org.hl7.fhir.igtools.ast.AstPlanCli -ast <ast> -ig <ig> [-head <rev> | -staged] [-out plan.json] [-fsh-users <json>]" },
    io: {
      inputs: [
        { name: "ast", schema: t("FilesystemPath"), required: true },
        { name: "ig", schema: t("FilesystemPath"), required: true },
        { name: "head", schema: t("CommitSha"), required: false, description: "Default HEAD; `-staged` diffs the index instead." },
        { name: "fsh-users", schema: t("FilesystemPath"), required: false, description: "`fsh-file-users/v1` from `fsh-cone --file-users`: lets a changed RuleSet- or Alias-only file reach its users rather than force a full build." },
      ],
      outputs: [{ name: "rebuild", schema: t("Count"), description: "The forward cone. The plan says `full`, with reasons, when a file's effect cannot be determined or the cone exceeds the threshold." }],
    },
    satisfies: ["ig-publisher-fork", "ig-ast-delta"],
    selection: {
      when: "Before an incremental build, and to show a reviewer what a change reaches.",
      limits:
        "The cone is computed on the BASE edges, so it is provisional until the rebuild: new edges can extend it. A RuleSet-only FSH file forces a full build unless `-fsh-users` is given.",
      cost: "Seconds; reads files and git.",
    },
    requires: { runtime: ["java", "git"], network: false },
  }),
);
