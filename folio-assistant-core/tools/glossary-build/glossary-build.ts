import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

// Moved here from cat-harness/tools/index.ts on 2026-10-06 (bean `0r7u`
// step 0): its command runs `folio-assistant-core/scripts/build-glossary.ts`,
// so declared in the harness it was an upward path into this layer. A Tool
// is declared by the harness that owns its implementation (#2192).
//
// ── The evidence path, and the check that is NOT a computation ────────
//
// Group 11 of `d308` (`1oqu`). The bean's constraint was that a Tool here
// must return "could not determine" distinctly from "verified", because
// `evidence-retrieval · Task_RecordUnverified` exists for the case where the
// authority check fails, and collapsing them would launder an unverified
// citation into an authoritative one.
//
// **That constraint is already met, and not by a Tool.** Measured
// 2026-09-20: nothing in the corpus WRITES a `VerificationEntry`.
// `schemas/bib-verification.ts` carries seven `VerificationStatus` values —
// `unfetchable` ("URL/DOI did not resolve") and `partial` ("awaiting PDF")
// are the could-not-determine cases — and a `Verifier` discriminated union
// whose own comment states the point: *"`kind: "agent"` is a
// machine-generated claim awaiting human review; `kind: "human"` is a human
// adjudication."* Verification is a judgement RECORDED in a curated file, so
// the guarantee lives in that file's schema, where a boolean cannot reach it.
//
// The laundering risk is therefore sharper than the bean assumed: it is not
// only unknown→verified, it is **agent-claim→verified**. A node emitting
// `verified: true` would collapse both distinctions at once, which is why
// this node declares neither — it builds the glossary and says so. The bib
// verification path is reached through `qa-sweep` instead (`bib-qa.ts` has no
// `import.meta.main` and produces the report `qa-checkers-extended` reads).
export default toolFactory((t) =>
  defineTool({
    id: "glossary-build",
    title: "Glossary build",
    description:
      "Build a paper's glossary index from its manifests and render the LaTeX. `--check` reports drift instead of writing, comparing everything except the `generated` timestamp so a re-run is not mistaken for a change.",
    install: { none: true },
    invoke: { shell: "bun run folio-assistant-core/scripts/build-glossary.ts" },
    io: {
      inputs: [
        { name: "targetPath", schema: t("RepoPath"), required: true, arg: { positional: 0 }, description: "The paper directory, which must hold a `<paper>.ts` manifest. Absent, the command exits 2 with its usage — could-not-determine, not an empty glossary." },
        { name: "check", schema: t("Flag"), required: false, arg: { flag: "--check" }, description: "Report drift and write nothing." },
      ],
      outputs: [
        { name: "glossary", schema: t("RepoPath"), description: "`glossary.json` beside the paper, and `chapters/glossary.tex` at the repo root." },
      ],
    },
    // `document-intake`, which is what `Task_L1Sources` refs. It carries NO
    // input contract, so `check-tools` cannot verify this edge against one —
    // worth saying plainly rather than letting a clean run imply agreement
    // that was never tested.
    satisfies: ["document-intake"],
    requires: { runtime: ["bun"], network: false },
  }),
);
