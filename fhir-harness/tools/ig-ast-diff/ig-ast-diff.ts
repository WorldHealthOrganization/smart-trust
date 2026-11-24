import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "ig-ast-diff",
    title: "List and view the delta between two IG ASTs",
    description:
      "Diff two ASTs by resource key: added, removed, changed (with a structural element-level differential) and version-changed resources, plus edges added and removed; optionally fold in the incremental plan, and render just-the-docs pages (an index that lists, a page per resource that shows) every one of which carries the provisional mark. `list <ast>` summarises one AST.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/ig-ast.ts diff <base> <head> [--plan plan.json] [--json delta.json] [--site <dir>]" },
    io: {
      inputs: [
        { name: "base", schema: t("FilesystemPath"), required: true },
        { name: "head", schema: t("FilesystemPath"), required: true },
        { name: "plan", schema: t("FilesystemPath"), required: false },
        { name: "site", schema: t("FilesystemPath"), required: false, description: "A directory inside the IG's just-the-docs source; pages are wrapped in Liquid raw blocks so FHIR narratives' Liquid is not executed." },
      ],
      outputs: [
        { name: "changed", schema: t("Count") },
        { name: "pages", schema: t("Count"), description: "Pages written: one index, one per changed or version-changed resource." },
      ],
    },
    satisfies: ["ig-ast-delta"],
    selection: {
      when: "Reviewing an incremental build, or comparing an incremental AST with a full one.",
      limits:
        "Structural, not FHIR-semantic: a reordered repeating element shows a change at every index. At most 200 differential rows per resource; the rest is counted, never dropped silently.",
      cost: "Reads both ASTs once.",
    },
    requires: { runtime: ["bun"], network: false },
  }),
);
