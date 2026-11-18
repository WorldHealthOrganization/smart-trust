import { defineTool, toolFactory } from "../../../platform/index.js";

export default toolFactory((t) =>
  defineTool({
    id: "l1-transcription-verbatim",
    title: "Authored L1 → verbatim against transcriptions and image narratives",
    description:
      "Check authored L1 (`*.l1.yaml`, the measles pattern) for a source with no usable text layer: each statement must be verbatim in the image narrative (`images.json`) or the `transcription` block it names; every transcription word (digits aside) must be corroborated by the entry's text layer unless listed under `inspectionOnly`; keys must be unique.",
    install: { none: true },
    invoke: { shell: "bun run smart-base/L1/scripts/l1-transcription-verbatim.ts --dir <dir of *.l1.yaml> [--root <repo>]" },
    io: {
      inputs: [
        { name: "dir", schema: t("RepoPath"), required: true, description: "The directory of authored `*.l1.yaml`; each names its library entry in `graph.source.entry`." },
      ],
      outputs: [
        { name: "report", schema: t("Text"), description: "One summary line per file and one `FINDING` line per failure. Exit 0 clean, 1 findings, 2 nothing to check (not a pass)." },
      ],
    },
    satisfies: ["transcription-verbatim"],
    selection: {
      when: "The L1 was authored from inspected images or transcriptions because `l1-recommendation-candidates` found no normative sentence in the entry's text layer (a poster, a slide deck).",
      limits:
        "Verbatim is checked after NFKC normalisation with private-use glyphs dropped, so digits a text layer maps to private-use code points rest on inspection alone. Whether the transcription reads the picture correctly is the reviewer's call (`bun run cat narratives`).",
      cost: "Seconds, no network.",
    },
    requires: { runtime: ["bun"], network: false },
  }),
);
