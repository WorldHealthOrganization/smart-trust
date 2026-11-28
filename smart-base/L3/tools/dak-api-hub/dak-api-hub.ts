import { defineTool, toolFactory } from "../../../platform/index.js";

export default toolFactory((t) =>
  defineTool({
    id: "dak-api-hub",
    title: "DAK API hub",
    description:
      "Generate `dak-api.html`, the DAK API's entry page, and the per-artefact `.openapi.json` / `.displays.json` sidecars.",
    install: { none: true },
    invoke: { shell: "python3 input/scripts/generate_dak_api_hub.py" },
    io: {
      inputs: [{ name: "igOutput", schema: t("RepoPath"), required: true }],
      outputs: [
        { name: "hub", schema: t("RepoPath"), description: "`dak-api.html`." },
        { name: "sidecars", schema: t("RepoPath"), description: "`.openapi.json` and `.displays.json` under `schemas/`." },
      ],
    },
    satisfies: ["dak-postprocessing", "ig-artifact-ingestion"],
    selection: {
      when: "The DAK API is to have a reader-facing entry point.",
      limits:
        "`dak-api.html` links its schemas to a `schemas/` directory that does not hold the root enumeration schemas. Resolve a sidecar from the index, never by composing the hub's path.",
      cost: "The largest upstream script; runs inside the publisher container against the full output.",
    },
    requires: { runtime: ["python3"], network: false },
  }),
);
