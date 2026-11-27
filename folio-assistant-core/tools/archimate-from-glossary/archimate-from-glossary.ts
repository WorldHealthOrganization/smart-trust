import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

// Owner, 2026-11-01 (smart-ra#166, B then A): the ArchiMate model is drawn
// from the knowledge graph. A glossary term whose focus is an ArchiMate
// element says what the element is and how it relates; Archi keeps the layout.
export default toolFactory((t) =>
  defineTool({
    id: "archimate-from-glossary",
    title: "ArchiMate model from the glossary",
    description:
      "Make an ArchiMate model agree with the instance's folio-glossary/v1 terms whose `focus` is an ArchiMate element: elements matched by their `skosConcept` property (never by name) take the term's prefLabel and definition, a term with no element gets one on no view, and the relationships the terms list are added. A type that disagrees is reported, never changed. A relationship between two linked elements that no term lists is reported, and removed with `--prune` along with the lines that draw it. No box or line is moved. Without `--write` it only reports; `--check` fails when anything would change. `--seed` goes the other way once, and only from an ingested model held under `library/` (`--from`): an authored model is never a source of the glossary.",
    install: { none: true },
    invoke: { shell: "bun run cat archimate:from-glossary" },
    io: {
      inputs: [
        { name: "instance", schema: t("RepoPath"), required: true, arg: { flag: "--instance" }, description: "The instance root holding `glossary/*.glossary.json` and `archimate/cat-archimate.config.json`." },
        { name: "model", schema: t("ArchimateModelId"), required: false, arg: { flag: "--model" }, description: "The model's id in the ArchiMate config. Required except with `--seed --from`." },
        { name: "write", schema: t("Flag"), required: false, arg: { flag: "--write" }, description: "Write the changes into the model file." },
        { name: "prune", schema: t("Flag"), required: false, arg: { flag: "--prune" }, description: "Also remove relationships between linked elements that no term lists." },
        { name: "seed", schema: t("Flag"), required: false, arg: { flag: "--seed" }, description: "Once: give linked terms without a focus the element type and relationships of an INGESTED model (under `library/`). Refused for an authored model." },
        { name: "from", schema: t("RepoPath"), required: false, arg: { flag: "--from" }, description: "With `--seed`: the ingested model file, under the instance's `library/`." },
        { name: "check", schema: t("Flag"), required: false, arg: { flag: "--check" }, description: "Fail if the model and the graph disagree." },
      ],
      outputs: [{ name: "model", schema: t("RepoPath"), description: "The model file, rewritten in place with `--write`." }],
    },
    satisfies: ["graph-rendering"],
    requires: { runtime: ["bun"], network: false },
  }),
);
