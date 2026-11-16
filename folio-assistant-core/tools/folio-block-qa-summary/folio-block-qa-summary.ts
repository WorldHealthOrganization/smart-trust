import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

// ── The one tool an agent has before it has any tooling.
//
// Bean `3jj9`, and the owner's ruling that human/agent and agent/agent
// interaction is documented as a skill plus a tool. The SKILL lives in
// `bootstrap/skills/discussion.md`, because a Bootstrapping Agent must be able to
// READ it with nothing installed; the typed node lives here, because a
// Tool is cat-harness's vocabulary and bootstrap may not import it.
//
// `invoke: { manual: true }` — "performed by a person following the
// skill, with no command", and the `beans-manual` precedent is explicit
// that this has equal standing to a CLI rather than marking an
// unfinished record. It is the honest declaration: there is no binary and
// no endpoint, the mechanism is putting a question to a participant and
// receiving an answer. Declaring a shell or an MCP name would assert
// machinery that is not there, and a Bootstrapping Agent that trusted it would be
// stuck at the first step of `initialize-harness` — the step this exists
// to unblock. (`conversation: true` was the first draft; `tsc` refused it,
// correctly — a new invoke kind for one tool is a vocabulary change, and
// `manual` already means this.)
//
// It DOES NOT DECIDE. It carries a question out and an answer back; the
// skill's judgement chooses what to ask and rules on when the answer
// settles the matter. The output is a document conforming to
// `discussion.output.schema.json`, which is what makes the task checkable
// rather than "we discussed it".
// `folio-block-qa-summary` — bean `qbfi`, option 2. The review page's
// heat map reads a folio's QA verdicts from a PUBLISHED summary. This
// reads the committed `block-qa/v1` sidecars and runs no checker.
export default toolFactory((t) =>
  defineTool({
    id: "folio-block-qa-summary",
    title: "Folio block QA summary",
    description:
      "Summarise a folio's committed per-block QA verdicts into one `block-qa.json` a staging preview publishes: each block is failing (a FRESH verdict failed, with the worst severity), stale (a verdict predates the block's current files), passing, or unaudited. Freshness is the QA sweep's own rule, including the uses-graph hash for graph-scoped criteria. Runs no checker and writes no verdict.",
    install: { none: true },
    invoke: { shell: "bun run cat block-qa:publish" },
    io: {
      inputs: [
        { name: "folio", schema: t("RepoPath"), required: true, arg: { flag: "--folio" }, description: "The folio's `folio` graph directory." },
        { name: "out", schema: t("RepoPath"), required: true, arg: { flag: "--out" }, description: "Where to write `block-qa.json`." },
        { name: "repo", schema: t("RepoPath"), required: false, arg: { flag: "--repo" }, description: "The folio's instance root, where verdicts are anchored. Default: found from `folio` exactly as the QA sweep finds it." },
      ],
      outputs: [
        { name: "block-qa", schema: t("RepoPath"), description: "A `folio-block-qa-summary/v1` file keyed by block label. Its counts go to stderr." },
      ],
    },
    satisfies: ["review-heatmap"],
    selection: {
      when: "A staging preview is being built and its review page's heat map should show QA per section, from what the folio's QA sweep last recorded.",
      limits:
        "Reports the LAST sweep: in a staging build, the sweep the job ran just before it; otherwise the committed verdicts. A folio never swept reads unaudited throughout. Verdicts are read at the instance root, so a folio in a subfolder is read at its own root, then in the folio directory.",
      cost: "One text walk of the folio and one read per sidecar. No network.",
    },
    requires: { runtime: ["bun"], network: false },
  }),
);
