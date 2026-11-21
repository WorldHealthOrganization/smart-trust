import { defineTool, toolFactory } from "../../../platform/index.js";

// ── The DAK configuration itself ─────────────────────────────────────
export default toolFactory((t) =>
  defineTool({
    id: "dak-config-from-sushi",
    title: "sushi-config.yaml → index.config.json#contentTypes.dak",
    description:
      "Derive the DAK configuration from `sushi-config.yaml` plus repository and branch context.",
    install: { none: true },
    invoke: { shell: "python3 input/scripts/generate_dak_from_sushi.py" },
    io: {
      inputs: [
        { name: "sushiConfig", schema: t("RepoPath"), required: true, description: "`sushi-config.yaml` at the IG root." },
        { name: "branch", schema: t("Branch"), required: false, description: "Sanitised branch name, for the publication and preview URLs." },
      ],
      outputs: [{ name: "dakConfig", schema: t("RepoPath"), description: "`index.config.json` (`contentTypes.dak`)." }],
    },
    satisfies: ["dak-preprocessing"],
    selection: {
      when: "A DAK repository has no configuration yet, or its branch context has changed.",
      limits:
        "Upstream runs it twice, before and after the branch name is sanitised, as an ordering workaround. Run it once, after sanitising.",
      cost: "Seconds. The whole DAK phase is gated on the file it writes, so a silent failure disables every later step.",
    },
    requires: { runtime: ["python3"], network: false },
  }),
);
