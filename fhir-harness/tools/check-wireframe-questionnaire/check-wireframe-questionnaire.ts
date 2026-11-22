import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "check-wireframe-questionnaire",
    title: "Check a Questionnaire field for field against the wireframe it was derived from",
    description:
      "Compare the `data-element` fields of a mid-fidelity wireframe (per `data-layout`, in document order) with the answerable items of a BUILT Questionnaire (depth first, named by `definition` or `code`). Reports a field with no item, an item with no field, an item naming no data element, a data element twice in one layout, and the first place the order differs. Fidelity, not design.",
    install: { none: true },
    invoke: { shell: "bun run fhir-harness/scripts/check-wireframe-questionnaire.ts <wireframe> <questionnaire>" },
    io: {
      inputs: [
        { name: "wireframe", schema: t("FilesystemPath"), required: true, description: "The wireframe HTML; fields carry `data-element`, layouts `data-layout`." },
        { name: "questionnaire", schema: t("FilesystemPath"), required: true, description: "The built Questionnaire JSON (`fsh-generated/resources/Questionnaire-<id>.json`), never FSH." },
      ],
      outputs: [{ name: "findings", schema: t("Text"), description: "One line per finding, prefixed with its layout. Exit 0 faithful, 1 a finding, 2 an input could not be read (never a pass)." }],
    },
    // The skill's `fidelity-check` mode, exercised alone: one Questionnaire
    // against the wireframe it was derived from (step 4).
    satisfies: ["fhir-questionnaire-wireframe"],
    selection: {
      when: "A Questionnaire was derived from an L2 wireframe and is reviewed for fidelity; or a suggested edit to either side is checked (`checkSuggestion`, the same judge in the editor-checker shape).",
      limits: "Compares ids and order only: it says nothing about labels, answer options, enableWhen or layout quality, which `wireframe-design-review` judges. A wireframe with no `data-element` field is exit 2, not a pass.",
      cost: "Milliseconds; reads two files.",
    },
    requires: { runtime: ["bun"], network: false },
  }),
);
