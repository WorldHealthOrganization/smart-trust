import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "ig-ast-validity",
    title: "Is this IG AST still valid for the IG's current inputs?",
    description:
      "Run folio-assistant-core's `compiledValidity` on an AST manifest's `inputs`: recompute the input digest (the same algorithm as the Java writer, pinned by a shared golden vector) and the source revision, and answer valid, stale-inputs (naming which input), or cannot-tell.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/ig-ast.ts validity <ast> --ig <root> [--toolchain <s>]" },
    io: {
      inputs: [
        { name: "ast", schema: t("FilesystemPath"), required: true },
        { name: "ig", schema: t("FilesystemPath"), required: true },
        { name: "toolchain", schema: t("Text"), required: false, description: "The Publisher that would run now. Without it the toolchain is ASSUMED unchanged, and the result says so." },
      ],
      outputs: [{ name: "verdict", schema: t("Text"), description: "Exit 0 valid, 1 stale-inputs, 2 cannot-tell. Cannot-tell is never a pass." }],
    },
    satisfies: ["ig-ast-delta"],
    selection: {
      when: "Before trusting, planning against, or rendering from a cached AST.",
      limits: "Valid means built from these inputs, not built correctly.",
      cost: "Reads `input/` once to hash it.",
    },
    requires: { runtime: ["bun", "git"], network: false },
  }),
);
