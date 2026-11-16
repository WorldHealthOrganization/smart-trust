import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "mesh-authority",
    title: "Validate draft MeSH headings against NLM's authority",
    description:
      "Stage three of `skill-pipeline-subject-indexing` for MeSH: look up every candidate heading of a draft (a preferred heading, an entry term, or a descriptor id, with an optional qualifier) in NLM's MeSH authority at id.nlm.nih.gov, current year. Each candidate comes back `resolved` (in the preferred form), `qualifier-not-allowed` (descriptor kept, qualifier dropped), `ambiguous` (options listed for a person) or `not-found` (dropped). It never adds a heading the draft did not propose and never emits one the authority lacks.",
    install: { none: true },
    invoke: { shell: "bun run folio-assistant-core/scripts/mesh-authority.ts validate" },
    io: {
      inputs: [
        { name: "draft", schema: t("RepoPath"), required: true, arg: { positional: 0 }, description: "A JSON file: `{ \"candidates\": [{ \"label\"?, \"descriptor\"?, \"qualifier\"?, \"why\"? }] }`, in the order stage two ranked them." },
        { name: "json", schema: t("Flag"), required: false, arg: { flag: "--json" }, description: "Print the full report as JSON instead of the review table." },
      ],
      outputs: [
        { name: "report", schema: t("Text"), description: "A review table with one row per candidate, or with `--json` the report: `results` per candidate and `validated`, the headings a reviewer sees." },
      ],
    },
    satisfies: ["mesh-subject-indexing"],
    requires: { runtime: ["bun"], network: true },
    remedies: [{ host: "id.nlm.nih.gov", none: "The authority is NLM's. Without it no candidate can be validated, and the skill emits nothing rather than unvalidated headings." }],
    selection: {
      when: "A draft list of MeSH headings from stages one and two of `mesh-subject-indexing` is ready to be checked against the authority.",
      limits: "Checks existence, preferred form and allowable qualifiers only. It does not judge whether a heading fits the work, and applies none of NLM's rules on heading count or major topics.",
      cost: "Two or three HTTPS requests per candidate to id.nlm.nih.gov; about a second for a short draft.",
    },
  }),
);
