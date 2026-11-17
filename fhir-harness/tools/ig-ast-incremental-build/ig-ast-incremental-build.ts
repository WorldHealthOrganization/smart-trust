import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "ig-ast-incremental-build",
    title: "Rebuild only the cone of a change and merge it into the AST",
    description:
      "Write the unchanged part of a base AST as a FHIR package into the package cache, build a temporary IG of only the rebuild set with the stock Publisher, merge the result into a mixed-provenance AST (`builtAt` per resource), and repeat while the merged graph's cone reaches resources that were not rebuilt.",
    install: { cli: "git clone -b claude/ast-export https://github.com/litlfred/fhir-ig-publisher && cd fhir-ig-publisher/ast-export && mvn -q package && mvn -q dependency:build-classpath -Dmdep.outputFile=cp.txt" },
    invoke: { shell: "java -cp \"target/classes:$(cat cp.txt)\" org.hl7.fhir.igtools.ast.IncrementalBuildCli -ast <base> -ig <ig> -out <dir> [-cache-folder <dir>] [-fsh-users <json>]" },
    io: {
      inputs: [
        { name: "ast", schema: t("FilesystemPath"), required: true },
        { name: "ig", schema: t("FilesystemPath"), required: true },
        { name: "out", schema: t("FilesystemPath"), required: true },
        { name: "cache-folder", schema: t("FilesystemPath"), required: false, description: "Keeps the `*.ast-cache` packages out of `~/.fhir/packages`." },
        { name: "fsh-users", schema: t("FilesystemPath"), required: false, description: "`fsh-file-users/v1` from `fsh-cone --file-users`, so a changed RuleSet- or Alias-only file reaches its users instead of forcing a full build." },
      ],
      outputs: [{ name: "rounds", schema: t("Count"), description: "Rounds to a fixed point; exit 3 when it does not converge, which means run a full build." }],
    },
    satisfies: ["ig-publisher-fork"],
    selection: {
      when: "A plan says `incremental`.",
      limits:
        "UNTESTED end to end as of 2026-09-30. The fork README names the risks to check first, beginning with a canonical collision between the cache package and the temporary IG.",
      cost: "A Publisher run over the cone, plus loading the cache package.",
    },
    requires: { runtime: ["java", "sushi"], network: true },
    remedies: [
      { host: "packages.fhir.org", tool: "fhir-cache-seed-npm" },
      { host: "tx.fhir.org", none: "No declared Tool replaces the terminology server. The HL7 IG Publisher's own `-tx n/a` skips terminology validation, at the cost of not validating it." },
      { host: "repo1.maven.org", none: "The Maven build needs Maven Central; a populated `~/.m2` from an earlier build is the only other source." },
    ],
  }),
);
