import { defineTool, toolFactory } from "../../../platform/index.js";

export default toolFactory((t) =>
  defineTool({
    id: "l1-recommendation-scenarios",
    title: "L1 recommendations → L2 user-scenario candidates",
    description:
      "From an agent's `l1-scenario-mapping/v1`, write one smart-kg L2 `user-scenario` candidate per L1 recommendation, joined to a `persona` and a `business-process` by smart-kg L2's existing edges. Reuses the guide's own personas and processes, then smart-base's generic `DAK.Persona.*`; otherwise a glossary candidate or `could-not-determine`, each with a WARNING. Never invents a process.",
    install: { none: true },
    invoke: { shell: "bun run smart-base/scripts/l1-recommendation-scenarios.ts --l1 <l1.json|yaml> --vocabulary <guide.json> [--generic <generic.json>] --mapping <mapping.yaml> --out <dir> [--check]" },
    io: {
      inputs: [
        { name: "l1", schema: t("RepoPath"), required: true, description: "The recommendations: `l1-recommendation-candidates`' L1 3.0 graph, or an authored L1 YAML." },
        { name: "vocabulary", schema: t("RepoPath"), required: true, description: "The target guide's personas and processes (`l1-scenario-vocabulary/v1`)." },
        { name: "generic", schema: t("RepoPath"), required: false, description: "smart-base's generic personas (second rung)." },
        { name: "mapping", schema: t("RepoPath"), required: true, description: "The agent's persona, process, act, outcome and domain per recommendation, each with a source and a basis." },
      ],
      outputs: [
        { name: "graph", schema: t("RepoPath"), description: "`scenario-candidates.l2.json`." },
        { name: "warnings", schema: t("RepoPath"), description: "`scenario-warnings.md` — processes not determined, personas that are glossary candidates." },
        { name: "runContext", schema: t("RepoPath"), description: "`run-context.json`, cat-harness `folio-run-context/v1`." },
      ],
    },
    satisfies: ["recommendation-scenarios"],
    selection: {
      when: "Each extracted recommendation is to say who acts on it and during which business process, before any L2 asset is drawn.",
      limits:
        "Checks ids against the vocabulary and coverage against the recommendations. Whether a persona or process is the RIGHT one is the agent's judgement, and stays `candidate` until a person reviews it. smart-kg's `user-scenario` has no slot for domain, link source or review status, so those ride on the edges.",
      cost: "Seconds, no network.",
    },
    requires: { runtime: ["bun"], network: false },
  }),
);
