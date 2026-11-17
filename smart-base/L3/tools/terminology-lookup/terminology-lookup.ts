import { defineTool, toolFactory } from "../../../platform/index.js";

export default toolFactory((t) =>
  defineTool({
    id: "terminology-lookup",
    title: "Reuse-first terminology and code-list lookup",
    description:
      "Look up a concept or code token for a semantic slot across the four reuse-first rungs of the `terminology-coding` methodology: (1) the target guide's `l1-scenario-vocabulary/v1`; (2) smart-base's generic personas (`DAK.Persona.*`), GRADE `code-lists/*.json` and the `guideline-domain` SKOS glossary; (3) local WHO/ILO FSH CodeSystems (`ISCO08`, `CDHIv2`, `CDHIv1`, `CDSCv2`, `KGTerminologySystem`); (4) a proposed `glossary-terms` candidate (`status: \"candidate\"`), or `could-not-determine` for `business-process`.",
    install: { none: true },
    invoke: {
      shell:
        "bun run smart-base/scripts/terminology-lookup.ts --slot <slot> --query <query> [--vocabulary <guide.json>] [--generic <generic.json>] [--scheme <scheme>] [--out <out.json>]",
    },
    io: {
      inputs: [
        {
          name: "slot",
          schema: t("Slug"),
          required: true,
          description:
            "The slot to code (`condition`, `intervention`, `persona`, `medicine`, `domain`, `business-process`, `recommendation-strength`, `recommendation-direction`, `evidence-certainty`).",
        },
        {
          name: "query",
          schema: t("DocId"),
          required: true,
          description:
            "The term, identifier or code token to look up.",
        },
        {
          name: "vocabulary",
          schema: t("RepoPath"),
          required: false,
          description: "The target guide's personas and business processes (`l1-scenario-vocabulary/v1`), rung 1.",
        },
        {
          name: "generic",
          schema: t("RepoPath"),
          required: false,
          description: "smart-base's generic personas (`l1-scenario-vocabulary/v1`), rung 2.",
        },
        {
          name: "scheme",
          schema: t("DocId"),
          required: false,
          description: "Restrict to one scheme (e.g. `guideline-domain`, `ISCO08`, `CDHIv2`, `grade-recommendation-strength`).",
        },
        {
          name: "out",
          schema: t("RepoPath"),
          required: false,
          description: "Where to write the result JSON.",
        },
      ],
      outputs: [
        {
          name: "result",
          schema: t("RepoPath"),
          description: "Result JSON conforming to `L1/schemas/skills/classify-and-code-content/output.schema.json`.",
        },
      ],
    },
    satisfies: ["classify-and-code-content"],
    selection: {
      when: "Coding L1 narrative statements or L2 DAK slots (personas, processes, domains, interventions, conditions, medicines, GRADE ratings) reuse-first, per `terminology-coding`.",
      limits:
        "Queries local code lists, SKOS glossaries, `l1-scenario-vocabulary/v1` files and FSH CodeSystems, offline. It ranks lexical exact and close matches only and prepares rung-4 candidate records; semantic fit and exclusion sign-off stay human judgements in `classify-and-code-content.bpmn`.",
      cost: "Milliseconds, offline.",
    },
    requires: { runtime: ["bun"], network: false },
  }),
);
