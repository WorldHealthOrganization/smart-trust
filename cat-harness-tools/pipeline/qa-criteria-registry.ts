
import { findContentRepoRoot } from "./repo-root";
import { voiceCriteriaFor } from "./voice-criteria.ts";
/**
 * Registry of QA criteria the per-block sweep recognises.
 *
 * Each criterion is one independently-trackable audit dimension.
 * The sweep walker iterates the registry and, per block, decides
 * whether to run the automated checker or queue an agent / human
 * adjudication request.
 *
 * ## Domains — and this list is not the list
 *
 * A domain is a bucket of criteria, and **the registry below is what exists**.
 * Naming the domains here as well is a second index, free to disagree with the
 * first, and it did: this header described four domains for a registry that
 * carries many more, so a reader who trusted it got a list that was wrong by
 * omission the day it was written. Count `QA_CRITERIA_REGISTRY`, or read the
 * `── Domain: … ──` headings, rather than this paragraph.
 *
 * What is worth saying here is the thing the entries cannot say about
 * themselves:
 *
 * - `voice` — the editorial register. Its per-VOICE overlay criteria are
 *   DERIVED from the voices a layer ships, not written here: see
 *   `voice-criteria.ts`, and `qaCriteriaFor(root)` rather than
 *   `QA_CRITERIA_REGISTRY` if you want them.
 * - `framework` and `wall` — **one folio's mathematics**, not platform
 *   concerns. Both are fenced behind the `archimedean-wall` opt-in axis —
 *   see the note above each — so a folio that has not asked for that
 *   mathematics is not measured against it.
 *
 * This header cited `.claude/skills/local/one-voice-audit.md` as what the
 * `voice` domain extends. **That file does not exist in this repository** —
 * it is a folio's local skill, named from the platform, in the most-read
 * comment in the QA subsystem. Bean `btuv`: the registry's folio-specific
 * content is not only the criteria, it is the prose around them.
 *
 * ── Chapter-scoped criteria (NOT per-block) ──────────────────────
 *
 * Some audit dimensions live on the chapter manifest, not on a block,
 * so they are NOT entries in `QA_CRITERIA_REGISTRY` (the per-block
 * sweep + agent-drain-queue would mis-scope and balloon them). They
 * are run by dedicated standalone scripts instead:
 *
 * - `voice-section-title-coherence` — section/subsection/chapter
 *   titles must be short, concise, and coherent read against their
 *   responsible parent (paper owns chapter titles, chapter owns
 *   section titles, section owns subsection titles). Mechanical
 *   defects (auto-split ` : <tag>` artifacts, trailing colons,
 *   over-long / compound titles) are flagged automatically; the
 *   story-coherence judgement is an agent pass over the emitted
 *   worklist. Script: `pipeline/qa-section-title-audit.ts`.
 *
 * @module pipeline/qa-criteria-registry
 */

import type { QaCriterionDefinition } from "../schemas/sdlc/block-qa.ts";
import { readEffectiveConfig } from "../schemas/kg/harness-config.ts";

// ── Domain: voice ───────────────────────────────────────────────

const VOICE: QaCriterionDefinition[] = [
  {
    id: "voice-status-leak",
    domain: "voice",
    description:
      "No status markers in body prose (✅ Done, (TODO), (TBD), **Pending.**, " +
      "'deferred via sorry', 'not yet wired') in ANY block, and no " +
      "derivation-status speech ('would prove the …', 'pending the " +
      "derivation', 'exact closure remains open', 'near-match to a " +
      "derivation') EXCEPT inside a formal `conjecture` block, where stating " +
      "what remains open and what would settle it is author-approved content. " +
      "Work-tracker + audit-status speech belongs in todos/ / authorNotes / " +
      "audit docs, not in the paper.",
    default_severity: "critical",
    depends_on: ["md", "ts"],
    automated: true,
  },
  {
    id: "voice-probe-narrative",
    domain: "voice",
    description:
      "Paper prose presents results, not the exploratory PROBE that produced " +
      "them. FAIL on experiment-writeup voice that belongs in an audit / probe " +
      "doc: an inline `witness:` / `*.witness.json` reference, 'We test " +
      "whether …', 'We compare N models', or 'overshoots CODATA by N×'. The " +
      "numeric conclusion stays; only the probe framing is the leak.",
    default_severity: "major",
    depends_on: ["md"],
    automated: true,
  },
  {
    id: "cite-named-theorem",
    domain: "voice",
    description:
      "ADVISORY. A named external result invoked in prose — a proper-noun " +
      "'X theorem / lemma / conjecture / inequality / duality / criterion' " +
      "(e.g. 'the Gröbner–Shirshov normal-form theorem', \"Ladyzhenskaya's " +
      "inequality\") — should carry a citation. High-recall CANDIDATE " +
      "detector: an agent confirms whether the result is genuinely external " +
      "(needs a cite) vs ubiquitous (needs none, e.g. Stokes' theorem). Fires " +
      "only when the block cites NOTHING; excludes QOU-coined namesakes " +
      "(Descartes) + tool names (Lean, Mathlib, …).",
    default_severity: "minor",
    depends_on: ["md"],
    automated: true,
  },
  {
    id: "voice-agent-speak",
    domain: "voice",
    description:
      "No informal agent / working-session vocabulary in prose ('wired in', " +
      "'un-wire', 'flip-flop', 'whack-a-mole', 'numerical rainbow', 'rabbit " +
      "hole'). Tight token list only — 'keystone' is NOT flagged (it is " +
      "established paper terminology: the B1 / gb-depth-period keystone " +
      "conjecture).",
    default_severity: "major",
    depends_on: ["md"],
    automated: true,
  },
  {
    id: "voice-emoji-content",
    domain: "voice",
    description:
      "No emoji used as content (✅, ❌, ⚠, 🔧, 🚧) outside tables. In " +
      "tables, only compact comparison markers (✓ matches / ✗ diverges).",
    default_severity: "major",
    depends_on: ["md"],
    automated: true,
  },
  {
    id: "voice-first-person-work",
    domain: "voice",
    description:
      "No first-person work tone: 'we'll add X', 'let me', 'needs more " +
      "work', 'I'll fix this'. These signal draft state, not paper authority.",
    default_severity: "major",
    depends_on: ["md"],
    automated: true,
  },
  {
    id: "voice-time-stamped-notes",
    domain: "voice",
    description:
      "No time-stamped notes ('as of 2026-…', 'after the recent push', " +
      "'in the current draft'). The paper does not narrate its own draft history.",
    default_severity: "major",
    depends_on: ["md"],
    automated: true,
  },
  {
    id: "voice-unicode-crash",
    domain: "voice",
    description:
      "No Unicode characters that crash pdflatex (↦, ⁻, √, ─, ✅, ·, ²) " +
      "outside preamble-mapped sets. Use LaTeX equivalents in math.",
    default_severity: "critical",
    // TeX. The defect IS the pdflatex crash — these characters are valid and
    // render correctly everywhere else, and the document render path
    // (`render-markdown.ts` → pandoc → weasyprint) never invokes latexmk. On
    // `docs/source/crdm-methodology` this was 5 of the sweep's 8 failures,
    // every one a `critical` on prose that builds fine.
    profiles: ["paper"],
    depends_on: ["md"],
    automated: true,
  },
  {
    id: "voice-editorializing",
    domain: "voice",
    description:
      "No editorialising phrases ('surprisingly', 'remarkably', " +
      "'interestingly', 'it is worth noting that', 'a beautiful result', " +
      "'the most important result'). Results speak for themselves. " +
      "EXEMPT: proof economy — an adverb routing the reader away from a routine " +
      "verification ('Clearly the relation is reflexive', 'it is easy to see " +
      "that', 'easily verified') — and a term of art where the adverb IS the " +
      "name ('naturally isomorphic'). Those are the opposite move from " +
      "editorializing: they spend none of the reader's attention and save some. " +
      "The exemption is the CONSTRUCTION, not the word: a value judgement in " +
      "the same clause still fails, so 'Clearly this is the most important " +
      "result' fails on the superlative. Bean `2t41`.",
    default_severity: "minor",
    depends_on: ["md"],
    automated: true,
  },
  {
    id: "voice-scholarly-default",
    domain: "voice",
    description:
      "Block uses scholarly third-person voice by default. Applies to " +
      "both narrative .md AND proof bodies (Lean docstrings, expository " +
      "comments inside .lean). Exceptions require explicit author markers. " +
      "Heuristic-automated: second-person address, lecturer-cadence openers, " +
      "paper-past-tense narration. Borderline cases are confirmed / overruled " +
      "by an agent reviewer entry on the same sidecar.",
    default_severity: "major",
    // Applies to narrative prose independently of proofs, so `.lean`
    // must NOT be in `depends_on`: that gates applicability, and listing
    // it would `n/a` every prose-only block (no `.lean` sibling) — the
    // majority of what this criterion exists to check.
    depends_on: ["md"],
    // But the checker DOES read Lean docstrings when a `.lean` is present
    // (see the dispatcher in `qa-checkers-voice.ts`), so a Lean-only edit
    // has to invalidate the cached verdict. Without this, a docstring
    // could both introduce a finding and — worse — fail to CLEAR one:
    // reflowing the offending line left the stale `fail` in place because
    // the `.md` hash had not moved. Observed live on qou #4673.
    also_invalidated_by: ["lean"],
    // Scoped to the paper profile, bean `hbsh`. "Scholarly third-person by
    // default" is the register of a PAPER; documentation's register is to
    // address the reader, and the two are not reconcilable per block. Measured
    // on this repo's own `docs/source/` (a `contentType: "document"` corpus),
    // 2026-09-19: ten findings, ten guide or reference pages, zero writing
    // defects — `guides-who-smart-ig/prerequisites.md:3` is "locally you
    // need:" and `guides-writing-a-paper/before-you-start.md:2` is "For papers
    // you want `bun`, `latexmk`/`texlive`, and Lean". Both are the correct
    // sentence for a prerequisites page AND a match, which is the definition of
    // a scoping defect rather than an authoring one.
    //
    // Ten instances of one criterion across ten pages is evidence about the
    // criterion's scope, not about ten authors — so this is one edit rather
    // than ten reviewer entries, and it leaves the reason on the record
    // (`skills/authoring/authoring-core/voice-editorial-review.md` §"The scoping question").
    //
    // NOT final: a document folio that DOES want scholarly register — a WHO
    // guideline states recommendations in third person — should re-enable this
    // by activating a voice, once the voice-overlay mechanism of issue #208 /
    // PR #210 exists. `profiles` is the only scoping axis available today, and
    // is the wrong axis for a rule that varies by genre within a profile.
    profiles: ["paper"],
    automated: true,
  },
  {
    id: "voice-title-scholarly",
    domain: "voice",
    description:
      "Content block `title:` field is a scholarly noun-phrase (e.g. " +
      "\"Borromean baryon\", \"Quantum-deformed Reeb flow\"), NOT a " +
      "relational header (\"Relation to Peña et al.\", \"Connection to X\"), " +
      "a question (\"Why is this important?\"), an imperative " +
      "(\"Compute the Markov trace\"), a first-person aside " +
      "(\"We derive…\"), or a casual marker (\"Quick note on …\"). " +
      "Retitle a relational header to the noun phrase naming its subject " +
      "(\"Deterministic cellular-automaton models of Peña et al.\"). " +
      "Scanned by extracting the `title:` value from the block's `.ts` " +
      "manifest and applying scholarly-form patterns.",
    default_severity: "minor",
    depends_on: ["ts"],
    automated: true,
  },
  {
    id: "voice-statement-no-interpretation",
    domain: "voice",
    description:
      "Provable block (theorem/proposition/lemma/corollary) STATEMENT is " +
      "the bare claim — interpretation/motivation/physical meaning belongs " +
      "in a SEPARATE `remark` linked via `interprets:`. FAIL (minor) only " +
      "if SUBSTANTIVE interpretive prose (physical meaning, 'why this " +
      "matters', motivation, downstream consequences) follows the " +
      "statement in the SAME block AND no companion `interprets:` remark " +
      "exists to hold it — i.e. the interpretation is genuinely " +
      "mislocated. WARN if an `## Interpretation`/`## Discussion`/" +
      "`## Motivation`/`## Significance` heading is present but its " +
      "content is borderline. PASS if the block is statement+proof only, " +
      "or its interpretation already lives in a linked remark. A short " +
      "clarifying note on scope/applicability is NOT interpretation — " +
      "pass it. A high pass rate is expected.",
    default_severity: "minor",
    depends_on: ["md"],
    automated: false,
    applies_to: ["theorem", "lemma", "proposition", "corollary"],
  },
  {
    id: "voice-ai-slop",
    domain: "voice",
    description:
      "No AI / status-update tells: 'Let me think about this', 'Here's " +
      "what I did', 'I'll go ahead and', 'Note that we should', 'Great " +
      "question', repeated First/Second/Third bullet cadence, over-use of " +
      "'essentially' / 'comprehensive' / 'leverage' / 'streamline' / 'robust'. " +
      "Heuristic-automated: direct LLM tells (zero false-positives in practice), " +
      "≥ 3 distinct hedge tokens in one .md (concentration signal), and " +
      "First/Second/Third comma-anchored sentence cadence. Borderline cases " +
      "are confirmed / overruled by an agent reviewer entry.",
    default_severity: "critical",
    depends_on: ["md"],
    automated: true,
  },
  {
    id: "voice-author-notes-pollution",
    domain: "voice",
    description:
      "No author-tracking content in scholarly .md prose (per CLAUDE.md §4d). " +
      "P1: status banners (> **Status:…**), P2: PR/commit refs (PR #NNN, " +
      "commit abc1234), P3: agent names (Claude, Copilot, Gemini), " +
      "P4: ISO dates (2026-05-NN), P5: deprecation markers. " +
      "These belong in the .ts `authorNotes` field, not in prose.",
    default_severity: "major",
    depends_on: ["md"],
    automated: true,
  },
  {
    id: "voice-status-section",
    domain: "voice",
    description:
      "No work-tracking SECTION HEADERS in scholarly .md prose: " +
      "`## Status`, `### Status (2026-…)`, `## Formalization status`, " +
      "`## TODO`, `## Pending`, `## Roadmap`, `## Next steps`, " +
      "`## Work remaining`. Status / roadmap content migrates to the .ts " +
      "`authorNotes` field (CLAUDE.md §4d); todos move to `beans/` " +
      "(owner directive 2026-06-13). Complements voice-status-leak " +
      "(inline markers) and voice-author-notes-pollution (banners / PR# / " +
      "dates). Legitimate scholarly sections (Open problems, Discussion, " +
      "Limitations, Outlook) are not flagged. Skips fenced code blocks.",
    default_severity: "major",
    depends_on: ["md"],
    automated: true,
  },
];

// ── Domain: fit ─────────────────────────────────────────────────

const FIT: QaCriterionDefinition[] = [
  {
    id: "fit-section-chapter",
    domain: "fit",
    description:
      "Discriminating placement test — read the block's section/chapter " +
      "scope, then judge against concrete triggers. FAIL (major) if: " +
      "(a) the block's PRIMARY subject is absent from this section's " +
      "stated scope AND squarely belongs to a DIFFERENT chapter's scope " +
      "(genuinely misfiled); OR (b) it restates the substantive claim of " +
      "a same-section sibling without adding a distinct result (true " +
      "redundancy — not a deliberate recap or worked example); OR (c) the " +
      "kind contradicts the content — a `prose`/`remark` asserting a NEW " +
      "provable claim WITH a proof (should be a proposition), or a " +
      "`definition` that names no new construction (should be a remark/" +
      "glossary). WARN (minor) if a different EXISTING section is a " +
      "strictly better home, or the block partially overlaps a sibling. " +
      "PASS once the topic appears in the section/chapter scope and no " +
      "sibling already carries the same claim. A high pass rate is " +
      "expected and correct for mature, already-reviewed chapters — pass " +
      "legitimately; do NOT manufacture fails on well-placed content.",
    default_severity: "major",
    depends_on: ["md", "ts"],
    automated: false,
  },
];

// ── Domain: framework ───────────────────────────────────────────
//
// ── Folio-optional: ONE FOLIO'S NOTATION ────────────────────────
//
// `framework-canonical` asserts a canonical notation, and the notation is a
// specific paper's. Read the checker rather than this comment — the patterns
// in `qa-checkers-voice.ts` are `(M, Θ, G, P, E)`, `\omega` as a fibre
// functor, `\mathcal{C}` for a category, and a bare `$H_q$`. Nothing about
// those is platform.
//
// **It was registered unconditionally, so it ran on every folio**, and
// `\mathcal{C}(?!_)` is the sharp end: any paper writing `\mathcal{C}` for
// anything at all got a `major` finding telling it the canonical form is
// `\mathbf{C}`. That is the platform asserting one paper's convention over
// every other paper's, in the subsystem whose verdicts a folio is judged by.
// Bean `btuv`, its last `Done when`.
//
// Fenced behind the SAME axis as the wall, because it is the same folio:
//
//   // harness.config.json
//   { "qaAxes": ["archimedean-wall"] }
//
// **This one has no direct-call safety net, and the wall does.**
// `q-usage-audit.ts` calls `checkWallSide` and `checkBaseRingMinimal`
// itself, so closing the axis leaves a folio's own audit computing them.
// `checkFrameworkCanonical` has no caller outside the registry's dispatch
// table, so a folio that wants it MUST name the axis. Saying so here because
// the alternative — leaving it on for everyone so one folio need not add a
// line — is how the content got into the platform in the first place.

const FRAMEWORK: QaCriterionDefinition[] = [
  {
    id: "framework-canonical",
    // The checker is the science layer's (bean saqd, row 9). See `checker_contributed`.
    checker_contributed: true,
    domain: "framework",
    description:
      "Uses current canonical math framework, not deprecated notation. " +
      "Examples of deprecated forms: 5-tuple (M, Θ, G, P, E) instead of " +
      "(C, Θ, G, S); $\\omega$ for fibre functor (canonical: $\\tau$); " +
      "$\\mathcal{C}$ for category (canonical: $\\mathbf{C}$); $E$ alone for " +
      "exceptional divisor or state bundle; bare $H_q$ (now $\\mathcal{H}_q$, " +
      "$\\hat{H}_q$, or $H_n(q)$ depending on meaning).",
    default_severity: "major",
    // The automated checker only scans the .md body for deprecated
    // notation. The .ts manifest carries metadata, not prose; including
    // it here would over-stale on label-only edits.
    depends_on: ["md"],
    automated: true,
  },
];

// ── Domain: wall ────────────────────────────────────────────────

// ── Folio-optional: the archimedean wall ────────────────────────
//
// The SAME axis as `detangler-archimedean-wall`, and the same folio's
// mathematics: the substrate-to-archimedean wall, its two sides, and the
// chapter names on each. These four cite that folio's `CLAUDE.md §7c` by
// section number and name its chapters — `braids-and-knots`,
// `quantum-observable-universes`, `models-of-qous`, `lifting-and-descent`,
// `q-geometric-langlands`, `brings-surface`, `observations`,
// `descartes-universe` — in criterion DESCRIPTIONS the platform ships to
// every folio.
//
// `profiles: ["paper"]` is on two of them and fences nothing, for the reason
// `domain-fencing.md` now states: a profile says what KIND of folio can
// answer the question, not WHOSE question it is. Every paper folio has a
// `.lean` to read and none of the others has these chapters.
//
// One opt-in covers both, because it is one wall:
//
//   // harness.config.json
//   { "qaAxes": ["archimedean-wall"] }
//
// `q-usage-audit.ts` calls `checkWallSide` and `checkBaseRingMinimal`
// DIRECTLY, not through the registry, so that script keeps working when the
// axis is closed — it is a folio-run audit and its caller has already decided
// the wall applies. Fencing the registry entries is about what the PLATFORM
// asserts every folio should be measured against, which is a different
// question from what a folio's own audit may compute.

const WALL: QaCriterionDefinition[] = [
  {
    id: "wall-side-correct",
    // The checker is the science layer's (bean saqd, row 9). See `checker_contributed`.
    checker_contributed: true,
    domain: "wall",
    description:
      "Block (`.lean` body) is on the correct side of the substrate-to-" +
      "archimedean wall (CLAUDE.md §7c). Algebraic Lean code must NOT " +
      "mention `ℝ`, `Real.sqrt`, `Real.rpow`, `Real.log`, `Real.exp`, " +
      "`linarith`, `0 < q`, or other archimedean-specific constructs. " +
      "Archimedean Lean code must declare `ℝ` (or LinearOrderedField) " +
      "explicitly. Each block belongs in either the algebraic substrate " +
      "or the archimedean specialisation, never both.",
    default_severity: "critical",
    // The automated checker scans the .lean body for archimedean markers
    // and looks for an archimedean-specialisation acknowledgement in EITHER
    // the .md narrative OR the .ts `authorNotes` (per CLAUDE.md §4d, §7c
    // banners migrate out of prose into authorNotes) — so `ts` is a genuine
    // input and belongs in depends_on for correct staleness tracking.
    //
    // Coverage scope: the `.lean` read here is the block's *resolved*
    // file — candidate-1 sibling OR candidate-2 library/Lake-tree module
    // named by `lean.ref` (`qa-utils.resolveCanonicalLean`, the single
    // resolver shared with qa-sweep + q-usage-audit). Library-tree
    // declarations referenced by a block are therefore in scope. Files
    // referenced by NO block (orphans) are swept separately, content-
    // based + chapter-independent, by `q-usage-audit`'s orphan pass.
    //
    // Lean. The verdict is read out of the block's `.lean` body, and
    // `DOCUMENT_FORBIDS_LEAN` means a document folio has none to read — not
    // "this block happens to lack one", which is what the `n/a-no-lean` the
    // companion gate would otherwise write implies.
    profiles: ["paper"],
    depends_on: ["md", "lean", "ts"],
    automated: true,
  },
  {
    id: "wall-base-ring-minimal",
    // The checker is the science layer's (bean saqd, row 9). See `checker_contributed`.
    checker_contributed: true,
    domain: "wall",
    description:
      "Advisory (§7c base-ring minimality). Flags **algebraic-side** Lean " +
      "(no archimedean ℝ markers) carrying FIELD structure — `[Field R]`, " +
      "`ℚ`, `DivisionRing`, `field_simp` — where the construction is a " +
      "q-deformed / Laurent object that could be restated DIVISION-FREE over " +
      "`ℤ[q, q⁻¹]` (`LaurentPolynomial ℤ`) or a generic `CommRing`, per the " +
      "`R[h]` multiplicative-relation pattern (Borromean " +
      "`IsBorromeanMarkovTrace h t := (h²+4)·t = num`; α_EM as " +
      "`α·[9]_q·[10]_q = q⁻¹` rather than `q⁻¹/([9]_q·[10]_q)`). A `Units` " +
      "inverse `↑q⁻¹` over a `CommRing` is the *target* pattern (not flagged). " +
      "WARN when an algebraic block's `.lean` carries field markers; the " +
      "reviewer adjudicates whether a field is essential (an inverse not " +
      "realizable as a unit, or archimedean evaluation) or whether the " +
      "statement is Laurent-rewritable. PASS if already over a CommRing / " +
      "Laurent ring, archimedean, or the field is essential.",
    default_severity: "minor",
    // Lean. Reads the `.lean` for base-ring structure; a document folio is
    // barred from carrying one at all.
    profiles: ["paper"],
    depends_on: ["lean"],
    automated: true,
  },
  {
    id: "wall-side-statement",
    domain: "wall",
    description:
      "Discriminating wall test on the narrative **Statement**. First " +
      "fix the block's chapter regime: generic-ring/substrate chapters " +
      "(braids-and-knots, quantum-observable-universes, models-of-qous, " +
      "lifting-and-descent, q-geometric-langlands, brings-surface) vs " +
      "explicitly-archimedean ones (observations, descartes-universe, " +
      "*-archimedean appendices, numeric predicted-spectra blocks). FAIL " +
      "(major) if a generic/substrate-chapter statement hard-codes an " +
      "archimedean construct — `Real.sqrt/rpow/log/exp/cos`, a numeric " +
      "`q ≈ <value>`, MeV/physical units, or an order hypothesis " +
      "(`0 < q`, `q < 1`) provable only over ℝ — WITHOUT a `wall:` field " +
      "or a §7c conditional banner; OR if an archimedean-chapter " +
      "statement is a purely algebraic identity that belongs upstream. " +
      "WARN if the statement mixes both regimes without flagging which " +
      "side it is evaluated on. PASS if the statement is generic-ring, " +
      "correctly archimedean-with-banner, or matches its chapter regime. " +
      "(The `q-usage-archimedean-in-categorical-chapter` script pre-flags " +
      "the token signatures; here you adjudicate whether a flagged token " +
      "is a real wall-violation or legitimately banner'd. A high pass " +
      "rate is expected — do not invent fails.)",
    default_severity: "major",
    depends_on: ["md"],
    automated: false,
    applies_to: [
      "theorem",
      "lemma",
      "proposition",
      "corollary",
      "definition",
    ],
  },
  {
    id: "wall-side-proof",
    domain: "wall",
    description:
      "Discriminating wall test on the narrative `**Proof.**` body. FAIL " +
      "(major) if an ALGEBRAIC statement (generic-ring) is proved by " +
      "archimedean-only machinery — `linarith`, IVT / intermediate-value, " +
      "continuity / limit arguments, `Real.*` lemmas, or numeric " +
      "evaluation at `q ≈ <value>` — with no specialisation step " +
      "declared; OR if an ARCHIMEDEAN statement's proof silently assumes " +
      "the algebraic identity without citing the substrate result it " +
      "specialises. WARN if the proof is correct but mixes regimes " +
      "without naming the specialisation point. PASS if the proof method " +
      "matches the statement's side of the wall. (The script flags " +
      "candidate phrasings `linarith`/`IVT`/`continuity`/`Real.`; you " +
      "adjudicate whether they are wall-violations or a properly-declared " +
      "archimedean specialisation. A high pass rate is expected.)",
    default_severity: "major",
    depends_on: ["md"],
    automated: false,
    applies_to: ["theorem", "lemma", "proposition", "corollary"],
  },
];

// ── Domain: q-usage ─────────────────────────────────────────────
//
// Owned by `q-usage-watcher`. Detects how a block treats the substrate
// parameter `q` (symbolic, generic-R, real-positive, root-of-unity,
// fixed-q0, …) and cross-checks the detected regime vector against
// the chapter's narrative-expected profile. The rules stay here; the
// checkers are the science layer's (bean saqd, 2026-10-30):
// https://github.com/litlfred/folio-assistant-sci/blob/main/pipeline/qa-checkers-q-usage.ts, contributed through
// its `qa-checkers/q-usage-*.json` nodes and run on their own by
// https://github.com/litlfred/folio-assistant-sci/blob/main/pipeline/q-usage-audit.ts. See `checker_contributed`.
// Chapter profiles stay in `chapter-profile-registry-di.ts`.

const Q_USAGE: QaCriterionDefinition[] = [
  {
    id: "q-usage-regime-detected",
    checker_contributed: true,
    domain: "q-usage",
    description:
      "Infrastructure criterion — records the block's detected " +
      "q-regime vector (symbolic / generic-R / real-positive / " +
      "real-gt-1 / real-lt-1 / mod-gt-1 / mod-lt-1 / unit-circle / " +
      "root-of-unity / fixed-q0 / na) in the sidecar so downstream " +
      "sweeps + agents can query the classification without re-running " +
      "the detector. Always result `pass`; the regime tags surface " +
      "via the `notes` field on the entry.",
    default_severity: "minor",
    // Only `md` is required — the detector reads md+ts+lean opportunistically
    // and tolerates missing files (#1640-Copilot @ qa-criteria-registry.ts:300).
    depends_on: ["md"],
    automated: true,
  },
  {
    id: "q-usage-fixed-q0-leak",
    checker_contributed: true,
    domain: "q-usage",
    description:
      "Block in a categorical/symbolic chapter (braids-and-knots, " +
      "lifting-and-descent, quantum-universes, appendix-knot-operations, " +
      "appendix-surreals) has a fixed q_0 numerical pin (e.g. " +
      "`q ≈ 1.1097…`, `substrate value`). Categorical blocks should " +
      "state identities for general q; numerical specialisation belongs " +
      "in an archimedean chapter (or in a block explicitly carrying " +
      "an `archimedean-specialisation` tag in its `.ts` manifest). " +
      "Mirrors CLAUDE.md §7c base-ring convention.",
    default_severity: "major",
    // Pin lives in narrative md (q_0 ≈ 1.1097…) — md is the load-bearing
    // file (#1640-Copilot @ qa-criteria-registry.ts:317).
    depends_on: ["md"],
    automated: true,
  },
  {
    id: "q-usage-archimedean-in-categorical-chapter",
    checker_contributed: true,
    domain: "q-usage",
    description:
      "Block in a categorical/symbolic chapter uses archimedean " +
      "Real.* functions (`Real.sqrt`, `Real.cos`, `Real.log`, …), " +
      "archimedean tactics (`linarith`, `positivity`, `norm_num`), " +
      "or numerical observable references (MeV, CODATA, PDG) without " +
      "an explicit `archimedean-specialisation` marker on the `.ts`. " +
      "Categorical chapters should keep statements over generic `R`; " +
      "see CLAUDE.md §7c.",
    default_severity: "major",
    // MeV/CODATA leak appears in md; Real.* leak appears in lean. md is
    // present on nearly every block so anchoring on md catches the
    // common case without forcing n/a on lean-less blocks
    // (#1640-Copilot @ qa-criteria-registry.ts:333).
    //
    // Coverage scope: the lean side is the block's *resolved* file —
    // sibling OR library/Lake-tree module via `lean.ref`
    // (`qa-utils.resolveCanonicalLean`). The chapter profile is derived
    // from the owning block's path, NEVER the lean-tree directory, so a
    // library decl is audited against its referencing chapter's regime
    // (CLAUDE.md §7c — do not infer the regime from the lean-tree path).
    depends_on: ["md"],
    automated: true,
  },
  {
    id: "q-usage-positivity-implicit",
    checker_contributed: true,
    domain: "q-usage",
    description:
      "Lean file uses positivity-dependent constructs (`Real.sqrt`, " +
      "`Real.log`, `Real.rpow`) on `q` without an explicit positivity " +
      "hypothesis (`hq : 0 < q`, `hq : 1 < q`, `hq_pos`). Mathlib's " +
      "`Real.sqrt` returns 0 on negative inputs so the proof may still " +
      "compile, but the implicit regime assumption should be made " +
      "explicit. Severity `minor` because it's a code-discipline flag, " +
      "not a correctness bug.",
    default_severity: "minor",
    depends_on: ["lean"],
    automated: true,
  },
  {
    id: "q-usage-modulus-vs-real-mismatch",
    checker_contributed: true,
    domain: "q-usage",
    description:
      "Formal-power-series / shuffle / Macdonald / Hall-Littlewood / " +
      "Habiro-ring context uses a real-line inequality `q > 1` / `q < 1` " +
      "in prose where the convergence regime is naturally `|q| > 1` / " +
      "`|q| < 1`. Heuristic — sometimes the real-line form is the " +
      "intended archimedean specialisation, but the convention should be " +
      "explicit (modulus inequality in the formal context, real-line " +
      "inequality only after specialisation).",
    default_severity: "minor",
    depends_on: ["md"],
    automated: true,
  },
  {
    id: "q-usage-root-of-unity-undeclared",
    checker_contributed: true,
    domain: "q-usage",
    description:
      "Block uses constructions that require `q` to be a root of unity " +
      "(Kashiwara modular crystal, Lusztig integral form, fusion " +
      "category, divided-power algebra, finite-dimensional quantum " +
      "group) without declaring the regime. The chapter " +
      "`q-geometric-langlands` is exempt (root-of-unity is its default " +
      "context); elsewhere the block should state `q = e^{2πi/N}` " +
      "or `q is a primitive N-th root of unity` in prose.",
    default_severity: "minor",
    // Most root-of-unity prose lives in the narrative md
    // (#1640-Copilot @ qa-criteria-registry.ts:381).
    depends_on: ["md"],
    automated: true,
  },
  {
    id: "q-usage-narrative-chapter-mismatch",
    checker_contributed: true,
    domain: "q-usage",
    description:
      "Block's detected regime vector is disjoint from its chapter's " +
      "expected-regime profile — i.e. every detected regime is outside " +
      "the chapter's expected set. Weak condition (single-regime " +
      "mismatches do not fire); meant to catch wholesale mis-placements " +
      "(e.g. a numerical observation block in a categorical chapter). " +
      "The stronger per-regime checks live in `q-usage-fixed-q0-leak` " +
      "and `q-usage-archimedean-in-categorical-chapter`.",
    default_severity: "minor",
    // Regime detector tolerates missing md/lean — only require md
    // (#1640-Copilot @ qa-criteria-registry.ts:397).
    depends_on: ["md"],
    automated: true,
  },
];

// ── Domain: proof ───────────────────────────────────────────────
//
// Owned by `proof-integration-watcher`. Each criterion maps to one
// existing Lean / proof skill — the orchestration table lives in
// `.claude/skills/local/proof-integration-watcher.md §Dispatch`.

const PROOF: QaCriterionDefinition[] = [
  {
    id: "proof-no-placeholder-stub",
    domain: "proof",
    description:
      "Block's `.lean` file is NOT a bare placeholder stub marked with " +
      "a placeholder stub marker (e.g. `placeholder stub`). These files " +
      "contain no mathematical content and exist only to satisfy " +
      "`lean.ref` linking constraints while formalisation is pending.",
    default_severity: "critical",
    depends_on: ["lean"],
    // The rule stays here; the checker is the science layer's (bean saqd):
    // Lean vacuity is a Lean measurement. See `checker_contributed`.
    checker_contributed: true,
    automated: true,
    applies_to: [
      "theorem",
      "lemma",
      "proposition",
      "corollary",
      "definition",
      "conjecture",
    ],
  },
  {
    id: "proof-no-bare-sorries",
    checker_contributed: true,
    domain: "proof",
    description:
      "Every `sorry` in the block's `.lean` carries a `-- Ref: [key] <url>` " +
      "citation per CLAUDE.md §1 (proof-status-tracking). Bare `sorry` " +
      "without a reference is always a review failure.",
    default_severity: "critical",
    depends_on: ["lean"],
    automated: true,
    applies_to: [
      "theorem",
      "lemma",
      "proposition",
      "corollary",
      "definition",
      "conjecture",
    ],
  },
  {
    id: "proof-no-axiom-growth",
    checker_contributed: true,
    domain: "proof",
    description:
      "Block's `#print axioms` set is a subset of the same block's axiom " +
      "set on `origin/main`. Verified against the doc-gen4 axiom-report. " +
      "Routes to `lean-witness-audit` on failure.",
    default_severity: "critical",
    depends_on: ["lean"],
    automated: true,
    applies_to: ["theorem", "lemma", "proposition", "corollary"],
  },
  {
    id: "proof-build-green",
    checker_contributed: true,
    domain: "proof",
    description:
      "Block's Lake package builds clean. On failure routes to " +
      "`lean-build-fix`. Result is read from the `proof-objects.json` " +
      "manifest emitted by `lean_ci.yml`.",
    default_severity: "critical",
    depends_on: ["lean"],
    automated: true,
    applies_to: [
      "theorem",
      "lemma",
      "proposition",
      "corollary",
      "definition",
    ],
  },
  {
    id: "proof-narrative-lean-equiv",
    domain: "proof",
    description:
      "The .md statement and the .lean signature express the SAME claim. " +
      "Compare element-by-element: quantifiers (∀/∃ and their domains), " +
      "hypotheses (every Lean `[Class]`/`(h : …)` ↔ a narrative " +
      "'assume/where' clause), and the conclusion. FAIL (major) if they " +
      "diverge in a theorem-changing way: the narrative claims `∀` but " +
      "Lean proves a single instance; a hypothesis present in Lean is " +
      "absent from the narrative (or vice-versa); the conclusions differ; " +
      "or the Lean is a `sorry`-stub / `True`-placeholder while the " +
      "narrative asserts a real result. WARN if they agree up to a " +
      "notational gap (renamed variable, implicit-vs-explicit binder) a " +
      "reader could reconcile. PASS only after confirming quantifiers + " +
      "hypotheses + conclusion match. A faithful Lean encoding of a " +
      "correct narrative is the expected case — pass it.",
    default_severity: "major",
    depends_on: ["md", "lean"],
    // Compares the narrative statement to the Lean SIGNATURE. A proof
    // body cannot change the answer, so a proof rewrite must not
    // re-queue this (agent-adjudicated) criterion.
    lean_granularity: "statement",
    automated: false,
    applies_to: ["theorem", "lemma", "proposition", "corollary"],
  },
  {
    id: "proof-substantive",
    checker_contributed: true,
    domain: "proof",
    description:
      "Block's Lean does NOT use the abstract `holds : Prop` placeholder " +
      "without a matching `[Instance]` hypothesis on the downstream " +
      "consumer (CLAUDE.md §3b-cond). Routes to `lean-substantive-pass`.",
    default_severity: "major",
    depends_on: ["lean"],
    automated: true,
    applies_to: ["theorem", "lemma", "proposition", "corollary"],
  },
  {
    id: "proof-no-conj-propagation-violation",
    checker_contributed: true,
    domain: "proof",
    description:
      "Provable block (theorem/proposition/lemma/corollary) whose " +
      "transitive `uses[]` cone touches a `conj:` label is either " +
      "demoted to `conjecture` OR satisfies the §3b-cond exception " +
      "(class-axiomatised conjecture + [Instance] hypothesis + " +
      "narrative banner). Reads cached witness " +
      "`docs/audits/2026-05-01-p3-1-conjectural-propagation.witness.json`.",
    default_severity: "critical",
    depends_on: ["ts"],
    automated: true,
    applies_to: ["theorem", "lemma", "proposition", "corollary"],
  },
  {
    id: "proof-no-trivial-skeleton",
    checker_contributed: true,
    domain: "proof",
    description:
      "Block's `.lean` does not contain a trivial-skeleton pattern " +
      "(`def f := 0`, `:= PUnit`, `:= True`, `:= id`, `:= trivial`, " +
      "`:= rfl`, etc.) that encodes none of the conjectural content. " +
      "Reads cached witness " +
      "`docs/audits/2026-05-08-trivial-skeleton-audit.json` (keyed " +
      "by `.lean` path).",
    default_severity: "major",
    // Lean. Proof-structure assumption end to end: the criterion is about
    // what a `.lean` declaration encodes, and a document folio has none.
    // The only entry in PROOF without an `applies_to` restricted to the math
    // kinds, so the profile axis is what excludes it rather than the kind.
    profiles: ["paper"],
    depends_on: ["lean"],
    automated: true,
  },
  {
    id: "proof-conditional-class-banner",
    checker_contributed: true,
    domain: "proof",
    description:
      "Block classified as conditional-on-class by the conjectural- " +
      "propagation audit has both (a) a Lean class-hypothesis `[Inst : " +
      "C ...]` in its `.lean`, AND (b) a narrative banner `**Theorem " +
      "(conditional on …).**` in its `.md` (CLAUDE.md §3b-cond rules " +
      "2-4). Reads cached witness " +
      "`docs/audits/2026-05-09-conditional-class-banner.witness.json`.",
    default_severity: "major",
    depends_on: ["md", "lean"],
    automated: true,
    applies_to: ["theorem", "lemma", "proposition", "corollary"],
  },
  {
    id: "proof-lean-compiles",
    checker_contributed: true,
    domain: "proof",
    description:
      "Block's `.lean` file compiles without errors. Uses the lean-lsp " +
      "MCP server (`lean_diagnostic_messages`) to get real compiler " +
      "diagnostics rather than relying on CI artefacts. Reads cached " +
      "diagnostics from `docs/audits/lean-compile-diagnostics.json` " +
      "(populated by `pipeline/lean-compile-audit.ts` or by " +
      "agent invocation of lean-lsp tools). Returns `n/a` when no " +
      "cache exists. Routes to `lean-build-fix` on failure.",
    default_severity: "critical",
    depends_on: ["lean"],
    automated: true,
    applies_to: [
      "theorem",
      "lemma",
      "proposition",
      "corollary",
      "definition",
      "conjecture",
    ],
  },
  // ── Rater rubric (AlphaProof-Nexus adoption 2026-06-07) ──────────
  //    Agent-SCORED quality criteria (not pass/fail): populate
  //    QaCriterionEntry.score (value 0–1, max 1). Owned by
  //    proof-integration-watcher (rate) + integration-backlog (improve).
  {
    id: "proof-rater-strategy-clarity",
    domain: "proof-rater",
    description:
      "QUALITY SCORE (0–1, write to QaCriterionEntry.score, max 1) — NOT a " +
      "pass/fail gate. Is the proof STRATEGY explicit and legible: would a " +
      "competent reader know the plan before reading the steps? 1.0 = plan " +
      "stated up front (cited lemmas / named case split); 0.5 = recoverable " +
      "but implicit; 0.0 = opaque step-dump. Low score routes to " +
      "`proof-simplifier` / `proof-conciseness`. From the AlphaProof-Nexus " +
      "rater rubric (arXiv 2605.22763).",
    default_severity: "minor",
    depends_on: ["md", "lean"],
    automated: false,
    applies_to: ["theorem", "lemma", "proposition", "corollary"],
  },
  {
    id: "proof-rater-goal-plausibility",
    domain: "proof-rater",
    description:
      "QUALITY SCORE (0–1, write to score, max 1) — NOT pass/fail. For any " +
      "remaining `sorry`/gap, how plausible is closing it? Cross-reference " +
      "the gap-criticality tag (`proof-gap-audit` §Gap criticality): " +
      "`routine` ⇒ ~0.9, `core` ⇒ ~0.3, `restates-target` ⇒ 0.0 (the gap " +
      "IS the goal). A sorry-free proof ⇒ 1.0. Routes to `proof-triage` / " +
      "`lean-build-fix`. From the AlphaProof-Nexus rater rubric (plausibility " +
      "of remaining goals).",
    default_severity: "minor",
    depends_on: ["lean"],
    automated: false,
    applies_to: ["theorem", "lemma", "proposition", "corollary", "conjecture"],
  },
  {
    id: "proof-rater-novelty",
    domain: "proof-rater",
    description:
      "QUALITY SCORE (0–1, write to score, max 1) — NOT pass/fail. Does the " +
      "proof/approach add something non-redundant vs the corpus, or is it a " +
      "near-duplicate of a sibling proof? 1.0 = novel argument; 0.5 = " +
      "standard but not duplicated; 0.0 = redundant (candidate for " +
      "`proposition-consolidation-audit`). From the AlphaProof-Nexus rater " +
      "rubric (novelty).",
    default_severity: "minor",
    depends_on: ["md", "lean"],
    automated: false,
    applies_to: ["theorem", "lemma", "proposition", "corollary"],
  },
  // ── SafeVerify / verify_integrity (AlphaProof-Nexus adoption) ────
  {
    id: "proof-statement-integrity",
    domain: "proof",
    description:
      "Guards against 'passing' a proof by weakening the statement or " +
      "injecting an axiom. The provable-kind signature (name / binders / " +
      "hypotheses / conclusion) is UNCHANGED vs the prior commit unless an " +
      "author-approved restatement is reflected in .md + .ts in the same " +
      "diff; AND `lean_verify` shows no `sorryAx` / unexpected axioms on a " +
      "decl claimed proved. Agent-checked (git diff + lean-lsp). Routes to " +
      "`lean-proof-review` (Review Type 4). From AlphaProof-Nexus " +
      "SafeVerify / verify_integrity (arXiv 2605.22763).",
    default_severity: "critical",
    depends_on: ["lean"],
    // The signature half is statement-level. NOTE the axiom half
    // (`lean_verify` showing no sorryAx) IS proof-level — kept at
    // statement granularity anyway because a body edit that introduces
    // `sorry` also changes the file, and `proof-no-bare-sorries` /
    // `proof-lean-compiles` (both file-granularity, both automated)
    // catch it on the same sweep. If that ever stops holding, revert
    // this to file granularity.
    lean_granularity: "statement",
    automated: false,
    applies_to: ["theorem", "lemma", "proposition", "corollary"],
  },
  // ── Vacuous-proof family (lean-proof-vacuity-audit) ──────────────
  //
  // Semantic anti-patterns that PASS `proof-statement-integrity`
  // (signature unchanged + no sorryAx) yet carry no mathematical
  // content. Agent-checked; see
  // `.claude/skills/local/lean-proof-vacuity-audit.md`.
  {
    id: "proof-no-self-assuming-projection",
    domain: "proof",
    description:
      "The proof is NOT a verbatim projection of a structure/class field " +
      "whose type IS the declaration's own conclusion. Anti-pattern: " +
      "`structure D where claim : C  …  theorem foo (d : D) : C := d.claim` " +
      "(or `:= ⟨d.claim_a, d.claim_b⟩`, `:= ctx.claim_foo`) — the goal is " +
      "assumed as a field and handed back (P ⊢ P), with sibling hypothesis " +
      "fields unused. LEGITIMATE: the proof COMPOSES fields / derives via " +
      "lemmas (`Iff.intro h.fwd h.bwd`; `obtain ⟨…⟩ := upstream; <derivation>`) " +
      "per §3b-cond. Agent-checked (Lean AST + field-type unification). " +
      "Routes to `lean-proof-review`. Evaluate the decl the `lean.ref` RESOLVES to (sibling first, then library decl-path): a trivial `: True` sibling that shadows a real library decl is a DELETION target (see CLAUDE.md §0a no-shadowing-stubs), and a genuine placeholder stub (no library decl) is FLAGGED as unformalised — neither is silently blessed.",
    default_severity: "critical",
    depends_on: ["lean"],
    automated: false,
    applies_to: ["theorem", "lemma", "proposition", "corollary"],
  },
  {
    id: "proof-no-trivial-true",
    domain: "proof",
    description:
      "The stated goal is NOT a tautology that any proof discharges " +
      "vacuously: the conclusion is not `True`, not a syntactic `x = x` / " +
      "`0 = 0`, and not a `holds : Prop` field instantiated as `True`; AND " +
      "a proof that ignores all hypotheses to close `True`/`rfl` is flagged. " +
      "LEGITIMATE: genuine reflexivity results where `rfl` IS the content " +
      "(definitional unfolding establishing a named equation). Agent-checked. " +
      "Routes to `lean-proof-review`. Evaluate the decl the `lean.ref` RESOLVES to (sibling first, then library decl-path): a trivial `: True` sibling that shadows a real library decl is a DELETION target (see CLAUDE.md §0a no-shadowing-stubs), and a genuine placeholder stub (no library decl) is FLAGGED as unformalised — neither is silently blessed.",
    default_severity: "critical",
    depends_on: ["lean"],
    automated: false,
    applies_to: ["theorem", "lemma", "proposition", "corollary"],
  },
  {
    id: "lean-no-vacuous-instance-data",
    domain: "proof",
    description:
      "No instance discharges a propositional field by reflexivity BECAUSE " +
      "its data fields were chosen degenerate. The signature is the " +
      "conjunction — constant data (`_ := 0`, `PUnit.unit`, `default`) AND a " +
      "`rfl`/`trivial` discharge of a field relating that data. Either half " +
      "alone is usually legitimate: a genuine zero object has constant data, " +
      "and plenty of real laws are reflexivity. Together they mean the claim " +
      "was arranged away rather than proved. An unconditional `instance` is " +
      "the severe form, since typeclass resolution supplies it everywhere and " +
      "every downstream theorem taking the class stops being conditional. " +
      "AST-checked, no agent turn. THE REMEDY, best-first: (1) parameterise " +
      "the class over the data so it cannot choose its own degenerate " +
      "shadow, then state the residual vacuity as a PROVED THEOREM PAIR — " +
      "one instance at the trivial datum showing the hypothesis is " +
      "satisfiable, one theorem showing it fails at any non-trivial datum. " +
      "That turns the trap into a machine-checked fact about what the " +
      "hypothesis is worth, instead of forbidding it. See " +
      "`QOU/Archimedean/JetOrderIndependence.lean` (`trivialError_bound` " +
      "beside `not_bound_of_physical_ne_zero`) for the worked pattern. " +
      "(2) Failing that, demote `instance` to `def` so the model must be " +
      "named and a reader of a downstream theorem can see what discharged " +
      "the hypothesis. (3) A non-degeneracy field on the class is the " +
      "blunt option: it prevents the trivial model but also prevents saying " +
      "anything about it. " +
      "Routes to `lean-proof-vacuity-audit`.",
    default_severity: "critical",
    depends_on: ["lean"],
    // The rule stays here; the checker is the science layer's (bean saqd):
    // Lean vacuity is a Lean measurement. See `checker_contributed`.
    checker_contributed: true,
    automated: true,
    applies_to: ["definition", "theorem", "lemma", "proposition", "corollary"],
  },
  {
    id: "lean-no-definitional-laundering",
    domain: "proof",
    description:
      "The sibling `lean-no-vacuous-instance-data` models vacuity as CONSTANT " +
      "data. This criterion covers the shape that model cannot see: data that " +
      "is NOT constant and is still chosen so the claim becomes `rfl`. A hand " +
      "pass over the qou corpus found eight such sites and the constant " +
      "detector found twenty-five, with a zero overlap. Three detections, all " +
      "conjunctive: (1) ARGUMENT-IGNORING BODY — `def F (args…) : Prop := " +
      "True` (or `False`), possibly after `let` bindings whose results are " +
      "discarded, so every claim stated in terms of `F` is free without any " +
      "instance being written; (2) LAMBDA-WRAPPED CONSTANT — `member := fun _ " +
      "=> True` beside a reflexivity discharge, the sibling's exact " +
      "conjunction with the constant one lambda deeper than its anchored " +
      "regex reaches; (3) DEFINITIONAL IDENTITY — the class declares `claim : " +
      "∀ …, data args = RHS` and the instance assigns `data := fun … => RHS` " +
      "with that same RHS, then discharges `claim` by reflexivity. " +
      "AST-checked, no agent turn. " +
      "DETECTION 3 IS A READING, NOT A VERDICT: pinning a field to a formula " +
      "and observing the law then holds by `rfl` is a legitimate way to " +
      "exhibit a model, and whether the class field was a CONSTRAINT the " +
      "instance had to meet or a DEFINITION it was entitled to make is not a " +
      "syntactic question. Those hits grade `warn` and say so; when the " +
      "author's docstring disputes the reading the hit records that too. " +
      "Detections 1 and 2 grade `fail`. " +
      "SCOPE, HONESTLY: detection 3 reads only classes declared in the SAME " +
      "file — resolving an imported class means resolving imports, and a " +
      "wrong resolution is a confident false report about a decl never read. " +
      "Semantic constancy (`w A := 3 * A * 0`) needs `whnf`, i.e. the " +
      "elaborator, and is out of reach here. An argument-free `def X : Prop " +
      ":= True` is deliberately NOT reported: that is " +
      "`proof-no-trivial-true`'s `def-disguised-true` pattern. " +
      "THE REMEDY is the sibling criterion's, and it is the same remedy " +
      "because it is the same defect one level up: parameterise the class " +
      "over the data so the instance cannot choose its own shadow, then state " +
      "the residual vacuity as a proved theorem pair — one instance at the " +
      "trivial datum, one theorem that the class fails at a non-trivial one. " +
      "`QOU/MassTheory/CableWidthBraneTowerLift.lean` (`colorRule` beside " +
      "`not_widthRule_of_ne`) is the worked pattern. " +
      "Routes to `lean-proof-vacuity-audit`.",
    default_severity: "critical",
    depends_on: ["lean"],
    // The rule stays here; the checker is the science layer's (bean saqd):
    // Lean vacuity is a Lean measurement. See `checker_contributed`.
    checker_contributed: true,
    automated: true,
    applies_to: ["definition", "theorem", "lemma", "proposition", "corollary"],
  },
  {
    id: "lean-docstring-honesty",
    domain: "proof",
    description:
      "A docstring that says the term carries a `sorry`, is axiomatised, or " +
      "holds a conjecture as a placeholder must be telling the truth: the " +
      "body contains an actual `sorry` or `axiom`. A docstring is the only " +
      "place an incompleteness is recorded when the term is in fact closed by " +
      "construction, and a wrong one is worse than no note at all — a `sorry` " +
      "is visible to `#print axioms`, a `rfl` on `0 = 0` is not. " +
      "AST-checked, no agent turn. Routes to `lean-proof-vacuity-audit`.",
    default_severity: "major",
    depends_on: ["lean"],
    // The rule stays here; the checker is the science layer's (bean saqd):
    // Lean vacuity is a Lean measurement. See `checker_contributed`.
    checker_contributed: true,
    automated: true,
    applies_to: ["definition", "theorem", "lemma", "proposition", "corollary"],
  },
  {
    id: "proof-no-false-premise",
    domain: "proof",
    description:
      "The theorem does not rely on a false or contradictory premise (e.g., " +
      "`h : False`, `h : 0 = 1`, or an uninhabited type) that makes the " +
      "implication trivially true via `False.elim`. Agent-checked. " +
      "Routes to `lean-proof-review`.",
    default_severity: "critical",
    depends_on: ["lean"],
    automated: false,
    applies_to: ["theorem", "lemma", "proposition", "corollary"],
  },
  {
    id: "proof-no-unused-hypotheses",
    domain: "proof",
    description:
      "The proof utilizes all stated hypotheses. Unused hypotheses " +
      "often indicate that the proven statement is weaker than intended, " +
      "or that the hypotheses were added to satisfy an interface without " +
      "genuine mathematical dependence. Agent-checked (Lean unused vars lint). " +
      "Routes to `lean-proof-review`.",
    default_severity: "major",
    depends_on: ["lean"],
    automated: false,
    applies_to: ["theorem", "lemma", "proposition", "corollary"],
  },
  {
    id: "proof-no-decide-masking",
    domain: "proof",
    description:
      "The proof does not use `decide` or `trivial` to mask an incomplete " +
      "or vacuous goal state where a substantive structural proof is " +
      "expected. Computational reflection (`decide`) must be justified. " +
      "Agent-checked. Routes to `lean-proof-review`.",
    default_severity: "critical",
    depends_on: ["lean"],
    automated: false,
    applies_to: ["theorem", "lemma", "proposition", "corollary"],
  },
  // ── Elaboration cost (Lean Refactor adoption, arXiv 2605.20244) ──
  //    Makes refactoring gains measurable. Checkers in
  //    `qa-checkers-cost.ts`, data from `lean-profile-ingest.ts`.
  // ── Machine-triviality oracle (Nazrin, arXiv 2602.18767) ────────
  //    SCAFFOLD — the oracle's false-positive rate is UNMEASURED. Kept
  //    `minor`/warn-only so it cannot gate anything until evaluated.
  {
    id: "proof-not-machine-trivial",
    domain: "proof",
    // The rule stays here; the checker is the science layer's (bean saqd):
    // it runs a Lean prover. See `checker_contributed`.
    checker_contributed: true,
    description:
      "ADVISORY, warn-only. A weak CPU-cheap prover (Nazrin-class atomic-tactic " +
      "oracle) did NOT close this goal in <= 3 atomic tactics from cold. When it " +
      "does, that is a PROMPT to check whether the statement carries content — " +
      "the same question the vacuity family asks, five of whose six criteria are " +
      "agent-adjudicated and therefore expensive. It is NOT a verdict: genuine " +
      "one-line results exist. Reads `docs/audits/lean-triviality.json`; returns " +
      "`n/a` when unmeasured or stale, and an empty cache means 'not measured', " +
      "not 'nothing trivial'. STATUS: the oracle's false-positive rate has not " +
      "been measured on any corpus — evaluate before promoting the severity.",
    default_severity: "minor",
    depends_on: ["lean"],
    automated: true,
    applies_to: ["theorem", "lemma", "proposition", "corollary"],
    lean_granularity: "statement",
    extra_inputs: ["docs/audits/lean-triviality.json"],
  },
  {
    id: "recommendation-strength-resolves",
    domain: "canonical",
    // The rule is the harness's; the checker is the content core's,
    // because code lists and the `recommendation` kind are content vocabulary
    // (bean folio-assistant-55ao). See `checker_contributed`.
    checker_contributed: true,
    description:
      "A `recommendation` block's `strength` names an ACTIVE code in a code " +
      "list its folio can see: core's `code-lists/` (GRADE, BCP 14) or the " +
      "folio's own. Read from the manifest as text. `n/a` when no strength is " +
      "declared (the field is optional; whether a folio requires one is the " +
      "folio's rule); `warn` when the strength is computed rather than literal, " +
      "so it could not be checked; `fail` naming the list or code that does not " +
      "resolve.",
    default_severity: "major",
    depends_on: ["ts"],
    automated: true,
    applies_to: ["recommendation"],
  },
  {
    id: "acronym-in-glossary",
    domain: "canonical",
    // The rule is the harness's; the checker is the content core's, because
    // glossaries (folio-glossary/v1) are content vocabulary. Owner,
    // 2026-10-31: "make QA review identify acronyms for potential inclusion".
    // See `checker_contributed`.
    checker_contributed: true,
    description:
      "Every acronym a block's prose uses (WHO, GS1, eLMIS, ICD-11) is a " +
      "label of a glossary its folio can see: a term's `notation`, " +
      "`prefLabel` or `altLabel`, in the folio's `glossary/` or a mounted " +
      "instance's. `warn`, naming each missing acronym at its first line, as " +
      "a CANDIDATE for the glossary: it never fails, because only a person " +
      "adds a term. Words set in capitals, plurals and the folio's own ids " +
      "(PC-R-05) are not acronyms. `n/a` when the block has no prose.",
    default_severity: "minor",
    depends_on: ["md"],
    automated: true,
    // No `profiles`: a paper's acronyms belong in its glossary too, and a
    // document-only opt-out is refused (profile-scoping.test.ts).
  },
  {
    id: "proof-compile-cost",
    domain: "proof",
    // The rule is core's; the checker is the science layer's, because
    // elaboration cost is a Lean measurement. See `checker_contributed`.
    checker_contributed: true,
    description:
      "MEASUREMENT, not a gate — always `pass` when data exists. Records " +
      "`elab_ms` / `tactic_count` (and `elab_ms_prev` / `elab_delta_pct` " +
      "when a comparable baseline exists) into the entry's `metrics`, from " +
      "`lean_profile_proof` via `docs/audits/lean-profile.json`. No " +
      "\"too slow\" threshold is imposed: that bound is corpus-specific and " +
      "inventing one here would be a policy nobody agreed to. Returns `n/a` " +
      "when the measurement is missing OR stale — a cost compared across " +
      "different source is a confident wrong answer, not a weak one.",
    default_severity: "minor",
    depends_on: ["lean"],
    automated: true,
    applies_to: ["theorem", "lemma", "proposition", "corollary", "definition"],
    extra_inputs: ["docs/audits/lean-profile.json"],
  },
  {
    id: "proof-no-cost-regression",
    domain: "proof",
    // The rule is core's; the checker is the science layer's, because
    // elaboration cost is a Lean measurement. See `checker_contributed`.
    checker_contributed: true,
    description:
      "Elaboration cost did not regress materially (>25%) versus the prior " +
      "measurement. Catches the standard refactoring trap: a proof that got " +
      "SHORTER and SLOWER — `simp` searching where an explicit `rw` chain " +
      "used to step — which reads as a pure win with no recorded cost. The " +
      "threshold is deliberately loose because elaboration timing is noisy " +
      "(machine load, cache state, Lake parallelism); a tight bound would " +
      "emit false regressions until reviewers learned to ignore it. `n/a` " +
      "with no comparable baseline — absence of a prior is NOT a pass. If a " +
      "statement change justifies the cost, re-baseline.",
    default_severity: "major",
    depends_on: ["lean"],
    automated: true,
    applies_to: ["theorem", "lemma", "proposition", "corollary"],
    extra_inputs: ["docs/audits/lean-profile.json"],
  },
];

// ── Domain: canonical ───────────────────────────────────────────
//
// Owned by `canonical-watcher`. Enforces the three-calibration
// discipline (`prop:three-calibration-discipline`) and bans
// numerology / fits.

const CANONICAL: QaCriterionDefinition[] = [
  {
    id: "canonical-calibration-count",
    checker_contributed: true,
    domain: "canonical",
    description:
      "Block declares at most 3 calibration anchors (CODATA m_e + α + " +
      "G_Planck normalisation, per the three-calibration discipline). " +
      "Counted by scanning the .md / .ts for `calibration:` / " +
      "`anchor:` markers. Routes to a manual `canonical-watcher` review " +
      "on fail (cannot auto-resolve a 4th calibration).",
    default_severity: "critical",
    depends_on: ["md", "ts"],
    automated: true,
  },
  {
    id: "canonical-no-numerology",
    checker_contributed: true,
    domain: "canonical",
    description:
      "Block does not claim numerical coincidence without a categorical " +
      "derivation chain. Scans .md for signal phrases: `miraculous`, " +
      "`surprising agreement`, `numerical coincidence`, `remarkably " +
      "close`, `happens to equal`, `empirically matches`. Provable " +
      "blocks (thm/prop/lem/cor) fail on any hit; remarks/conjectures " +
      "get severity=minor (numerology in context is expected there).",
    default_severity: "critical",
    depends_on: ["md"],
    automated: true,
    applies_to: ["theorem", "lemma", "proposition", "corollary",
      "conjecture", "remark"],
  },
  {
    id: "canonical-witness-pinned",
    checker_contributed: true,
    domain: "canonical",
    description:
      "Every `:val[…]` directive in the .md references an existing " +
      "witness JSON under `folio-assistant/computations/*.witness.json`, " +
      "and the block's `computation:` field matches (or is absent and " +
      "the implicit dep is declared). Routes to `witnessed-values` skill.",
    default_severity: "major",
    depends_on: ["md", "ts"],
    automated: true,
  },
  {
    id: "canonical-script-not-deprecated",
    checker_contributed: true,
    domain: "canonical",
    description:
      "The block's `computation.script` does not reference a deprecated " +
      "or SUPERSEDED module. Checks the script file (if it exists) for " +
      "`SUPERSEDED`, `DEPRECATED`, or imports of known retired modules " +
      "(`mass_endomorphism`, `LAMBDA_PROTON_DOC`, `LAMBDA_NEUTRON_DOC`). " +
      "Routes to compute-audit for migration.",
    default_severity: "major",
    depends_on: ["ts"],
    automated: true,
  },
  {
    id: "canonical-dilogarithm-context",
    checker_contributed: true,
    domain: "canonical",
    description:
      "Φ_q (Faddeev) appears only in mass-anchor blocks; Li_2^q " +
      "(Rogers) appears only in binding-context blocks. Mixing the " +
      "two q-dilogarithms violates bar-symmetry discipline (cheat-" +
      "sheet §4). Scans .md for `Phi_q` / `\\Phi_q` / `faddeev` in " +
      "binding-tagged blocks and `Li_2\\^q` / `rogers` / `li2q` in " +
      "mass-anchor-tagged blocks.",
    default_severity: "major",
    depends_on: ["md", "ts"],
    automated: true,
  },
  {
    id: "canonical-no-hardcoded-observable",
    checker_contributed: true,
    domain: "canonical",
    description:
      "Block .md does not use exact-equality (`=`) with hardcoded " +
      "MeV/keV/eV values for derived observables. Derived values " +
      "must use `≈` / `\\approx` / `\\simeq` or carry an explicit " +
      "error term (CLAUDE.md §7ab). Catches CODATA literals used as " +
      "production inputs.",
    default_severity: "major",
    depends_on: ["md"],
    automated: true,
  },
  {
    id: "canonical-cal4-acknowledged",
    checker_contributed: true,
    domain: "canonical",
    description:
      "Blocks whose .ts or .md contains a CAL-4 caveat comment " +
      "(`CAL-4`, `4th calibration`, `demoted prop → conj`) must be " +
      "kind=conjecture OR carry an explicit acknowledgment banner " +
      "in the .md (`CAL-4 caveat`, `q-source open`). Provable blocks " +
      "with unacknowledged CAL-4 caveats are discipline violations.",
    default_severity: "critical",
    depends_on: ["md", "ts"],
    automated: true,
    applies_to: ["theorem", "lemma", "proposition", "corollary",
      "conjecture"],
  },
  {
    id: "canonical-ck-tiered-not-binary",
    checker_contributed: true,
    domain: "canonical",
    description:
      "Complement to `canonical-no-negative-result-in-paper` (#1574, " +
      "which catches falsified/superseded probe-block leakage via tags " +
      "/ Status banners). This criterion catches the prose-framing " +
      "mode: precision-ladder blocks (Q_β c_k, α_EM Habiro factor, any " +
      "convergent truncation-order series) must report coefficient " +
      "provenance TIERED (proved / near-match / fitted), never as a " +
      "binary negative result. Scans .md for flip-flop signal phrases " +
      "(`un-wire`, `drop c_k`, `just a fit`, `fails to beat`, " +
      "`should be reverted`, `negative result`) in ladder context " +
      "(tags `precision-ladder`/`1ppb-roadmap`/`habiro` or prose " +
      "mentioning `precision ladder`/`truncation order`/`c_k`/`Habiro " +
      "element`). Passes if the block carries tiered vocabulary " +
      "(`near-match`/`tier`) or cites " +
      "`2026-05-31-qbeta-ck-truncation-order-canonical-framing.md` " +
      "(Rule 4). Prevents the four-session wire/un-wire flip-flop from " +
      "re-entering the paper as flat negative-result prose.",
    default_severity: "major",
    depends_on: ["md", "ts"],
    automated: true,
    applies_to: ["theorem", "lemma", "proposition", "corollary",
      "conjecture", "remark"],
  },
  {
    id: "canonical-no-negative-result-in-paper",
    checker_contributed: true,
    domain: "canonical",
    description:
      "Paper block whose primary content is a negative empirical " +
      "finding (tag 'negative-result' / 'falsified' / 'superseded' / " +
      "'scaffolding'; or .md opening with `## Status: ... falsified` " +
      "or `## Status: open R&D — no known` or `**Hypothesis falsified**` " +
      "or an `Errata banner ... superseded`) should be in `docs/audits/`, " +
      "not the paper. Routes to a manual `canonical-watcher` review on " +
      "fail; the fix is to move the content to a dated audit doc and " +
      "cite it from a one-line forward reference. `kind: conjecture` " +
      "blocks are exempt (open conjectures legitimately document " +
      "open / partially-falsified directions). Authoring discipline " +
      "established by `docs/audits/2026-05-31-ck-exploratory-probes-" +
      "removed.md` after the c_k/d_k flip-flop saga.",
    default_severity: "major",
    depends_on: ["md", "ts"],
    automated: true,
    applies_to: ["definition", "theorem", "lemma", "proposition",
      "corollary", "remark", "prose", "equation", "diagram"],
  },
];

// ── Domain: compute ─────────────────────────────────────────────
//
// Owned by `compute-integration-watcher`. Implements the 13-pattern
// I1-I13 audit + LP-dual-witness validator (CLAUDE.md "LP / SDP
// duals — first-class infra").

const COMPUTE: QaCriterionDefinition[] = [
  {
    id: "compute-prop-has-probe",
    checker_contributed: true,
    domain: "compute",
    description:
      "Every `prop:`/`theorem:` block has a corresponding probe witness " +
      "under `folio-assistant/computations/`, OR a sorry-free Lean proof " +
      "(which is a stronger guarantee). The probe is the I1 of the " +
      "13-pattern audit: a numerical check that the proposition's claim " +
      "holds at a representative parameter point.",
    default_severity: "major",
    // `lean` — sorry-free-proof exemption; `md` — §3b-cond conditional-banner
    // exemption (a conditional result is not a numerical prediction).
    depends_on: ["ts", "lean", "md"],
    automated: true,
    applies_to: ["theorem", "lemma", "proposition", "corollary"],
  },
  {
    id: "compute-prop-has-consumer",
    checker_contributed: true,
    domain: "compute",
    description:
      "Every `prop:` is consumed by at least one production script (I2- " +
      "I13 of the 13-pattern audit). A prop with a probe but no consumer " +
      "is a NOT-WIRED prop. Routes to `compute-integration-watcher §B`.",
    default_severity: "major",
    depends_on: ["ts", "lean", "md"],
    automated: true,
    applies_to: ["theorem", "lemma", "proposition", "corollary"],
  },
  {
    id: "compute-witness-exists",
    checker_contributed: true,
    domain: "compute",
    description:
      "If the block's `.ts` declares `computation: { witness: '…' }`, " +
      "the referenced witness JSON exists on disk and is non-empty. " +
      "Routes to the `compute-audit` skill on fail.",
    default_severity: "critical",
    depends_on: ["ts"],
    automated: true,
  },
  {
    id: "compute-lp-dual-present",
    checker_contributed: true,
    domain: "compute",
    description:
      "For LP/SDP/operator-selection witnesses (matched per CLAUDE.md " +
      "`lp_dual_witness_validator.py` hint list), the witness JSON " +
      "includes `y0_star`, `y_star`, `active_set` (or alias), " +
      "`primal_obj`, `dual_obj`, `duality_gap`. Mirrors the standalone " +
      "validator.",
    default_severity: "critical",
    depends_on: ["ts"],
    automated: true,
  },
];

// ── Domain: detangler ───────────────────────────────────────────
//
// Owned by `detangler-integration-watcher`. Enforces the structural
// rules H1-H7 (no forward refs), R1-R3 (section band 3-18 blocks),
// and the cross-chapter forward-edge ban.

const DETANGLER: QaCriterionDefinition[] = [
  {
    id: "detangler-no-forward-ref",
    domain: "detangler",
    description:
      "Block's same-chapter `uses:` targets do not appear later in the " +
      "chapter's ordered `sections[].blocks[]`. Forward refs force the " +
      "reader to skip ahead. Deterministic: `checkDetanglerNoForwardRef` " +
      "builds the block-position map from the chapter manifests and " +
      "fails (major) listing each offending target + its position. " +
      "Cross-chapter forward refs are the separate " +
      "`detangler-no-xchapter-fwd` criterion; reorder-invariant cycles " +
      "are `detangler-no-dependency-cycle`.",
    default_severity: "major",
    depends_on: ["ts"],
    automated: true,
    // Verdict is a property of the chapter uses[] GRAPH, so an edit to
    // ANOTHER block's uses[] changes it while this block's own files are
    // untouched. Without this the entry stays fresh-skip and keeps a stale
    // verdict — seen live in qou, where breaking 3 cycles left 15 blocks
    // still recording a cycle that no longer existed.
    also_invalidated_by: ["graph"],
  },
  {
    id: "foreshadows-point-forward",
    domain: "detangler",
    description:
      "Every `foreshadows:` target appears LATER than the block — later in " +
      "the same chapter's ordered `sections[].blocks[]`, or in a later " +
      "chapter. A foreshadow is a promise that material is coming; naming " +
      "something the reader has already passed is either a prerequisite " +
      "filed in the wrong field or an inert back-reference. Deterministic: " +
      "`checkForeshadowsPointForward` reuses the block-position map and " +
      "fails (major) listing each backward target. `n/a` for blocks with no " +
      "`foreshadows:`. Resolution of the labels themselves is the " +
      "`foreshadows-resolve` constraint, not this criterion.\n\n" +
      "Load-bearing since `foreshadows[]` stopped being a subset of " +
      "`uses[]` (2026-08-10): an entry may now name a block the manifest " +
      "does not otherwise reference, and is zero-cost by construction, so " +
      "direction is the one property left that a machine can check here. It " +
      "cannot distinguish a pure forward pointer from a prerequisite filed " +
      "in the wrong field — both point forward — so that call stays with the " +
      "author. The cost of getting it wrong is reading-order accuracy, not " +
      "correctness: a block's formal content is carried by its `lean.ref` " +
      "sibling and gated by the Lean build, independently of this graph.",
    default_severity: "major",
    depends_on: ["ts"],
    automated: true,
    // Same rationale as detangler-no-forward-ref above: the verdict depends
    // on the chapter's block ORDER, so another block's manifest edit can
    // change it while this block's own files are untouched.
    also_invalidated_by: ["graph"],
  },
  {
    id: "detangler-section-band",
    domain: "detangler",
    description:
      "Each `## Section` in the chapter contains between 3 and 18 " +
      "NON-PROSE blocks (R1-R3). Block kinds are resolved per slug so " +
      "narrative prose is excluded from the count; the sparse (<3) check " +
      "additionally skips intro/overview sections (H4). Out-of-band " +
      "sections invite either skim-and-skip (>18) or trivial-aside " +
      "dilution (<3).",
    default_severity: "minor",
    depends_on: ["ts"],
    automated: true,
    // Verdict is a property of the chapter uses[] GRAPH, so an edit to
    // ANOTHER block's uses[] changes it while this block's own files are
    // untouched. Without this the entry stays fresh-skip and keeps a stale
    // verdict — seen live in qou, where breaking 3 cycles left 15 blocks
    // still recording a cycle that no longer existed.
    also_invalidated_by: ["graph"],
  },
  {
    id: "detangler-no-xchapter-fwd",
    domain: "detangler",
    description:
      "Block's cross-chapter `uses:` references do not point at a chapter " +
      "later in `paper.ts` ordering. Cross-chapter forward edges break the " +
      "linear reading promise of a folio.",
    default_severity: "major",
    depends_on: ["ts"],
    automated: true,
    // Verdict is a property of the chapter uses[] GRAPH, so an edit to
    // ANOTHER block's uses[] changes it while this block's own files are
    // untouched. Without this the entry stays fresh-skip and keeps a stale
    // verdict — seen live in qou, where breaking 3 cycles left 15 blocks
    // still recording a cycle that no longer existed.
    also_invalidated_by: ["graph"],
  },
  {
    id: "detangler-block-tanglement",
    domain: "detangler",
    description:
      "Per-block tanglement score (cross-chapter forward-ref count) plus " +
      "a descriptive graph-metrics payload: out_degree / in_degree / " +
      "cone_size (transitive blast radius) / fwd_received / edge_span / " +
      "depth (longest dependency chain, a proof-depth proxy) / pagerank " +
      "(weighted centrality refining in-degree). High tanglement or deep/" +
      "central placement signals a block that may warrant a split, " +
      "relocation, or dependency-edge pruning.",
    default_severity: "major",
    depends_on: ["ts"],
    automated: true,
    // Verdict is a property of the chapter uses[] GRAPH, so an edit to
    // ANOTHER block's uses[] changes it while this block's own files are
    // untouched. Without this the entry stays fresh-skip and keeps a stale
    // verdict — seen live in qou, where breaking 3 cycles left 15 blocks
    // still recording a cycle that no longer existed.
    also_invalidated_by: ["graph"],
  },
  {
    id: "detangler-graph-energy",
    domain: "detangler",
    description:
      "Per-block contribution to the chapter's graph energy: the sum, " +
      "over same-SECTION `uses:` edges that point forward in the " +
      "manifest order, of the manifest-position distance to each " +
      "target. Cross-section forward edges reflect the chapter's " +
      "intentional face ordering (Algebraic→Geometric→…), not a " +
      "reorderable local tangle, and are excluded. Weights forward " +
      "refs by reach (a definition used 30 " +
      "blocks later is a deeper tangle than one used 2 blocks later) — " +
      "the magnitude that the binary `detangler-no-forward-ref` count " +
      "misses. `pass` at energy 0, `warn` for any forward edge, `fail` " +
      "(major) at energy ≥ 100 (far above the ~18 corpus median nonzero " +
      "energy — gates only pathological tangles). Emits `graph_energy`, " +
      "`fwd_edge_count`, " +
      "`worst_span` in the entry's `metrics`. Mirrors the " +
      "`chapter-complexity-review` energy metric per block.",
    default_severity: "major",
    depends_on: ["ts"],
    automated: true,
    // Verdict is a property of the chapter uses[] GRAPH, so an edit to
    // ANOTHER block's uses[] changes it while this block's own files are
    // untouched. Without this the entry stays fresh-skip and keeps a stale
    // verdict — seen live in qou, where breaking 3 cycles left 15 blocks
    // still recording a cycle that no longer existed.
    also_invalidated_by: ["graph"],
  },
  {
    id: "detangler-topic-coherence",
    domain: "detangler",
    description:
      "Keyword-based topic-fit heuristic (ported from " +
      "`block-density-audit.py`): a block whose prose scores more " +
      "chapter-keyword hits for some OTHER chapter than for its own " +
      "home chapter is a relocation/split candidate. Soft (`warn`, " +
      "minor) since keyword overlap is noisy; the `metrics` payload " +
      "records `home_chapter`, `home_score`, `top_other_chapter`, " +
      "`top_other_score` for reviewer adjudication. Only audits " +
      "substantive blocks (> 20 non-blank .md lines); `n/a` otherwise.",
    default_severity: "minor",
    depends_on: ["md"],
    automated: true,
    // Verdict is a property of the chapter uses[] GRAPH, so an edit to
    // ANOTHER block's uses[] changes it while this block's own files are
    // untouched. Without this the entry stays fresh-skip and keeps a stale
    // verdict — seen live in qou, where breaking 3 cycles left 15 blocks
    // still recording a cycle that no longer existed.
    also_invalidated_by: ["graph"],
  },
  {
    id: "detangler-no-dependency-cycle",
    domain: "detangler",
    description:
      "No `uses[]` dependency CYCLE through this block. Distinct from " +
      "`detangler-no-forward-ref` (a position check that a reorder can " +
      "satisfy): a cycle is reorder-invariant — when two blocks each " +
      "`uses:` the other (e.g. `prop:A` ↔ `prop:B`), or a longer loop " +
      "closes, NO chapter ordering removes the forward edge. A cycle " +
      "signals a genuine structural tangle: prune one dependency edge, " +
      "merge the mutually-defining blocks, or factor the shared content " +
      "into a third block both depend on. Fails (major) with the cycle " +
      "path as evidence.",
    default_severity: "major",
    depends_on: ["ts"],
    automated: true,
    // Verdict is a property of the chapter uses[] GRAPH, so an edit to
    // ANOTHER block's uses[] changes it while this block's own files are
    // untouched. Without this the entry stays fresh-skip and keeps a stale
    // verdict — seen live in qou, where breaking 3 cycles left 15 blocks
    // still recording a cycle that no longer existed.
    also_invalidated_by: ["graph"],
  },
];

// ── Folio-optional: the archimedean wall ────────────────────────
//
// `detangler-archimedean-wall` is a `detangler`-domain criterion by
// mechanism and a SINGLE FOLIO's mathematics by content. Its wall, its
// classifier and its six chapter directory names (`archimedean-universe/`,
// `observations/`, `fluid-dynamics/`, `braids-and-knots/`,
// `quantum-observable-universes/`, `quantum-universes/`) are qou's, and
// `profiles: ["paper"]` does not fence them: any paper folio has a `.lean`
// to read, so every other paper folio was being audited against chapters it
// does not have. Measured here — this platform repo's own sidecars under
// `test/results/block-qa/docs/source/process-publication-workflow/` carry
// `detangler-archimedean-wall` verdicts on workflow documentation.
//
// So it is registered only when the folio opts in:
//
//   // harness.config.json
//   { "qaAxes": ["archimedean-wall"] }
//
// The generic shell underneath — *a node must live on the side of a
// declared partition wall that its content places it on* — is worth keeping
// and is NOT what is fenced; re-expressing the wall, the classifier and the
// chapter list as folio-supplied data (the repair `detangler-topic-coherence`
// already had, when `DETANGLER_CHAPTER_KEYWORDS` migrated out to a
// folio-supplied `topic-keywords.json`) would let the shell return to the
// unconditional `detangler` axis. Until then, fenced.
//
// SAME AXIS as the `wall` domain above, and deliberately so: it is one wall,
// so a folio opens both with one key and cannot end up half-fenced. A second
// axis name would have made that state reachable.
//
// The `wall` domain was recorded here as "not fenced — its checkers are
// called directly from `q-usage-audit.ts` and pinned by two tests, so it is
// its own change with its own measurement." It got that measurement and both
// halves of the caution were non-blocking: discovery is registry-driven, so a
// fenced axis's checkers are simply not surfaced (verified against `q-usage`,
// already fenced, BEFORE changing anything), and the direct callers in
// `q-usage-audit.ts` are untouched by design — a folio's own audit deciding
// the wall applies is a different question from what the platform asserts
// every folio must be measured against.

export const DETANGLER_ARCHIMEDEAN_WALL: QaCriterionDefinition[] = [
  {
    id: "detangler-archimedean-wall",
    domain: "detangler",
    description:
      "Chapter-level archimedean wall placement: blocks whose .lean is " +
      "purely archimedean live in `archimedean-universe/` / `observations/` / " +
      "`fluid-dynamics/`. Generic-R blocks live in `braids-and-knots/` / " +
      "`quantum-observable-universes/` / `quantum-universes/`. " +
      "Companion to `wall-side-correct` (per-block) — this one is " +
      "per-chapter placement.",
    default_severity: "major",
    // Lean. Classifies a block by reading its `.lean` for archimedean
    // constructs, which a document folio cannot have. The chapter list is
    // one folio's directory names, which is why the whole criterion is
    // fenced behind the `archimedean-wall` opt-in axis below rather than
    // relying on `profiles` alone — a paper folio that is not qou has a
    // `.lean` to read and no such chapters.
    profiles: ["paper"],
    depends_on: ["ts", "lean"],
    automated: true,
    // Verdict is a property of the chapter uses[] GRAPH, so an edit to
    // ANOTHER block's uses[] changes it while this block's own files are
    // untouched. Without this the entry stays fresh-skip and keeps a stale
    // verdict — seen live in qou, where breaking 3 cycles left 15 blocks
    // still recording a cycle that no longer existed.
    also_invalidated_by: ["graph"],
  },
];

// ── Domain: uses ────────────────────────────────────────────────
//
// Audits the *proper use of `uses[]`* — the *editorial* dependency
// relation. `uses[]` records what a READER must have read to follow a
// block. It is agent/human maintained and is NOT the formal
// dependency graph; the formal relation is machine-derived from
// `lean.ref` (see `pipeline/content-graph.ts` and the
// `BlockBase.uses` doc comment in `schemas/types.ts`).
//
// The prime directive for this whole domain: **never pollute `uses[]`
// with Lean dependencies.** A formal edge without an editorial
// counterpart is usually correct — a `simp` lemma or library layer
// nobody needs to read about. `uses-formal-coverage` surfaces that
// divergence as an advisory exposition-gap signal for a human, and is
// deliberately `minor` so it can never gate a build or motivate a
// mechanical "fix".
//
// Mechanical + human split, as required: `uses-editorial-hygiene` is
// script-checkable structure; `uses-editorial-completeness` is the
// judgement call only a reader can make.

const USES: QaCriterionDefinition[] = [
  {
    id: "uses-editorial-hygiene",
    domain: "uses",
    description:
      "MECHANICAL. The block's `uses[]` is well-formed as an editorial " +
      "dependency list: no self-reference; every entry resolves to a real " +
      "block label (bare label in-paper, `paper-dir:label` cross-paper, or " +
      "full URL cross-folio); no duplicate entries; and no transitively " +
      "redundant entry (A uses B, B uses C ⇒ A must not also list C — run " +
      "`prune-transitive-deps.ts`). Transitive pruning is sound HERE because " +
      "reading-order is transitive; it is never applied to formal edges. " +
      "Does NOT check agreement with Lean — `uses[]` is not the formal graph. " +
      "STALENESS CAVEAT: the resolvability and transitive-redundancy checks " +
      "read the whole-corpus editorial graph, so editing ANOTHER block's " +
      "`uses[]` can change this block's verdict without changing this " +
      "block's `field_hash`. `extra_inputs` cannot express a whole-corpus " +
      "dependency; re-sweep the axis after any bulk `uses[]` edit.",
    default_severity: "major",
    depends_on: ["ts"],
    automated: true,
    extra_inputs: ["pipeline/content-graph.ts"],
  },
  {
    id: "uses-editorial-completeness",
    domain: "uses",
    description:
      "HUMAN/AGENT. Read the block's `.md` as a reader would and judge its " +
      "`uses[]` on two counts. (1) COMPLETE: every block the narrative " +
      "actually leans on — a definition whose notation it uses unexplained, " +
      "a result it argues against, a construction it presumes — appears in " +
      "`uses[]`. (2) EDITORIAL: every listed entry earns its place " +
      "*expositionally*; a reader genuinely needs it first. FAIL (major) on " +
      "a missing dependency a reader would stumble over. FAIL on an entry " +
      "that is plainly a formal artefact copied in from Lean (a `simp` " +
      "lemma, a typeclass instance, a library lemma the prose never " +
      "mentions) — that is the pollution this domain exists to prevent. " +
      "WARN on a defensible-but-marginal entry. PASS when the list reads " +
      "as a deliberate editorial judgement. Do NOT consult the Lean " +
      "dependency graph to answer this — the question is about the reader, " +
      "not the proof term.",
    default_severity: "major",
    depends_on: ["md", "ts"],
    automated: false,
  },
  {
    id: "uses-formal-coverage",
    checker_contributed: true,
    domain: "uses",
    description:
      "ADVISORY ONLY — never a gate, never auto-fixed. Reports formal Lean " +
      "dependencies (from the `lean.ref` decl graph via " +
      "`content-graph.ts`) whose owning block is NOT reachable through this " +
      "block's *editorial* cone. Each one is a candidate EXPOSITION GAP: " +
      "the proof leans on something the narrative never asks the reader to " +
      "have read. It is NOT a list of missing `uses[]` entries — most " +
      "formal-only edges are correct and should stay absent from `uses[]`. " +
      "A human decides, per edge, whether the narrative owes the reader an " +
      "introduction. Emits `formal_only_count` / `formal_only_sample` / " +
      "`editorial_only_count` to `metrics`. Returns `n/a` when the Lean " +
      "Atlas cache (`docs/audits/lean-atlas-deps.json`) is absent — an " +
      "empty formal edge set means 'unavailable', not 'clean'.",
    default_severity: "minor",
    // Lean. The whole criterion is the difference between the FORMAL (Lean
    // `lean.ref` decl) graph and the editorial `uses[]` graph. A document
    // folio has only the editorial one, so there is no gap to report.
    profiles: ["paper"],
    depends_on: ["ts", "lean"],
    automated: true,
    extra_inputs: [
      "docs/audits/lean-atlas-deps.json",
      "pipeline/content-graph.ts",
    ],
  },
  {
    id: "lean-ref-owns-decl",
    checker_contributed: true,
    domain: "uses",
    description:
      "MECHANICAL. A block's `lean.ref` declaration is not also claimed by " +
      "another STATEMENT-BEARING block (definition / theorem / lemma / " +
      "proposition / corollary / conjecture). A `prop:x` + `prf:x` pair " +
      "sharing one declaration is LEGITIMATE and is not reported — the " +
      "proposition is what the decl states and the proof block documents its " +
      "proof. Two statement-bearing blocks claiming one decl IS a defect and " +
      "a consequential one: the formal graph can attach a declaration to only " +
      "one block, so the other silently loses every formal edge it should " +
      "have had. In practice these are copy-paste errors. Reported from every " +
      "claimant so the finding is visible on each side.",
    default_severity: "major",
    // Lean. The subject is the `lean.ref` field, which the document profile
    // forbids outright (`DOCUMENT_FORBIDS_LEAN`) — so in a document folio the
    // criterion has nothing to collide. Note it does NOT declare `lean` in
    // `depends_on` (it reads the `.ts`), so the companion gate never excluded
    // it: it ran on all 14 crdm-methodology blocks and returned the checker's
    // own bare `n/a`, which says nothing about why.
    profiles: ["paper"],
    depends_on: ["ts"],
    automated: true,
    extra_inputs: ["pipeline/content-graph.ts"],
  },
];

// ── Domain: bibliography ────────────────────────────────────────
//
// Block-level bibliography QA. Per-reference QA lives in the
// separate `pipeline/bib-qa.ts` (writes `bib-qa.json`); this
// domain projects the relevant per-reference findings DOWN to each
// content block that cites the reference, so a block's `.qa.json`
// surfaces its bibliography-readiness alongside its voice / proof /
// canonical / compute / detangler axes.

const BIBLIOGRAPHY: QaCriterionDefinition[] = [
  {
    id: "bib-cite-resolves",
    domain: "bibliography",
    description:
      "Every `\\cite{key}` and `-- Ref: [key]` in the block resolves to a " +
      // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
      "registered entry in `folio/schema/references.ts`. Mirrors the " +
      "`validate-bib` skill's resolution check at block granularity.",
    default_severity: "critical",
    depends_on: ["md", "lean"],
    automated: true,
  },
  {
    id: "bib-cited-ref-has-url",
    domain: "bibliography",
    description:
      "Every reference the block cites has a URL or DOI (resolves to one) " +
      "per `bib-qa.ts` tag `has_url`. A block citing an URL-less reference " +
      "fails — the reader has no way to consult the source.",
    default_severity: "major",
    depends_on: ["md", "lean"],
    automated: true,
  },
  {
    id: "bib-cited-ref-metadata-ok",
    domain: "bibliography",
    description:
      "Every reference the block cites has complete metadata (title, " +
      "author/editor, year) per `bib-qa.ts` tag `metadata_ok`.",
    default_severity: "major",
    depends_on: ["md", "lean"],
    automated: true,
  },
  {
    id: "bib-cited-ref-has-screenshot",
    domain: "bibliography",
    description:
      "Every reference the block cites has a screenshot under " +
      // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
      "`folio/bib-qa-images/<id>.*` per `bib-qa.ts` tag " +
      "`has_screenshot`. Provides provenance for the citation.",
    default_severity: "minor",
    depends_on: ["md", "lean"],
    automated: true,
  },
];

// ── Domain: script-quality ──────────────────────────────────────
//
// Audits **script files** (not content blocks). Sidecar is
// per-script `.script-qa.json`, schema in
// `schemas/sdlc/script-qa.ts`. Driven by
// `pipeline/script-sweep.ts`.
//
// Planned criteria (one PR per checker):
//   - does_not_default_to_float   (implemented, this PR)
//   - respects_archimedean_wall   (TODO — CLAUDE.md §7c)
//   - code_is_commented           (TODO)
//   - variables_typed             (TODO)
//   - has_references_to_paper     (TODO)
//   - connected_to_ci_pipeline    (TODO)
//   - deprecated                  (TODO — also cross-axis to blocks)
//   - uses_library_framework_appropriately (TODO — `_precision`,
//                                  no hardcoded numerics, reads
//                                  from witness JSONs)

// Every entry is marked `subject: "script"` at the bottom of this array
// rather than one criterion at a time, so a criterion added here cannot be
// handed to the block sweep by omission. The block sweep would pass it a
// `CheckerPaths` object where its checker expects a path string.
const SCRIPT_QUALITY: QaCriterionDefinition[] = ([
  {
    id: "does_not_default_to_float",
    domain: "script-quality",
    description:
      "Python script source contains no bare float literals (`1.0`, " +
      "`0.5`, `3.14e-10`, `1_000.5`, …) or unchecked `float(...)` " +
      "casts. Use `mpmath.mpf(\"...\")`, `Decimal(\"...\")`, or pin " +
      "the value via a witness JSON. Allow-listed sentinels (case- " +
      "insensitive, optional trailing comma): `float(\"inf\")`, " +
      "`float(\"-inf\")`, `float(\"nan\")`, `float(\"infinity\")`, " +
      "`float(\"-infinity\")`. Heuristic whole-source regex scan; " +
      "string literals and `#` comments are stripped before matching " +
      "to avoid false positives. Multiline casts and one level of " +
      "nested parens (`float(int(x))`) are handled; deeper nesting, " +
      "PEP 515 underscore validation, and bare floats inside f-string " +
      "expression regions (`f'{1.0}'`) are documented heuristic " +
      "limitations. Format-spec contexts (`{x:.2f}`, `{x:0.4f}`) are " +
      "correctly exempted from false positives via a `:` lookbehind. " +
      "Remaining false positives are addressed with a `human` reviewer " +
      "override on the script's sidecar.",
    default_severity: "major",
    // `"ts"` is the conventional primary-source-file key in
    // `QaFieldHash` across every QA axis (extension-agnostic — the
    // script-quality axis hashes `.py` / `.rs` files under it). With
    // an empty `depends_on` the staleness logic could never detect
    // a script-source change.
    depends_on: ["ts"],
    automated: true,
    source_file: "pipeline/qa-checkers-python.ts",
  },
  {
    id: "compute_no_mpf_to_float_cast",
    domain: "script-quality",
    description:
      "Python script does NOT cast mpmath / sympy precision-bearing " +
      "values to float64. Flags ONLY guaranteed-destroyer patterns: " +
      "`float(<x>.evalf(...))`, `float(mp.<x>)`, `float(mpmath.<x>)`, " +
      "`numpy.float64(<x>)`, `np.float64(<x>)`. These are unambiguous " +
      "precision-loss sites — once a 50-dps value passes through " +
      "float64, the L1 1-ppQ goal becomes unreachable for that compute " +
      "path. Critical severity (vs `does_not_default_to_float` which is " +
      "major and broader). String literals and `#` comments are masked " +
      "before scanning to avoid documentation false positives. Author " +
      "directive (2026-06-09): 'float64 is EVIL'.",
    default_severity: "critical",
    depends_on: ["ts"],
    automated: true,
    source_file: "pipeline/qa-checkers-python.ts",
  },
  {
    id: "respects_archimedean_wall",
    domain: "script-quality",
    description:
      "Python script does not call archimedean-realization " +
      "functions (`math.sqrt`, `math.log`, `math.exp`, `math.cos`, " +
      "`numpy.float64`, …) for substrate-precision values. Per " +
      "CLAUDE.md §7c, archimedean constructs belong in " +
      "`archimedean-universe/` / `observations/` specialised modules; " +
      "the generic algebraic / categorical layer should use the " +
      "mpmath equivalents (`mp.sqrt`, `mp.log`, `mp.exp`, …) which " +
      "preserve the 50-digit working precision. Heuristic scan of " +
      "function names; strings and comments are stripped before " +
      "matching so narrative references do not produce false " +
      "positives. Authors of legitimate archimedean modules " +
      "override with a `human` reviewer `result: \"n/a\"` entry.",
    default_severity: "major",
    depends_on: ["ts"],
    automated: true,
    source_file: "pipeline/qa-checkers-python.ts",
  },
  {
    id: "code_is_commented",
    domain: "script-quality",
    description:
      "Python script has either a module-top docstring " +
      "(`\"\"\"…\"\"\"` immediately after any `from __future__` " +
      "imports) or comment-line density ≥ 10% of non-blank lines. " +
      "A bare script with no docstring and no inline commentary " +
      "becomes opaque to future readers; this criterion encodes " +
      "the minimum-documentation contract. Severity is `minor` — " +
      "an undocumented script is still functionally correct.",
    default_severity: "minor",
    depends_on: ["ts"],
    automated: true,
    source_file: "pipeline/qa-checkers-python.ts",
  },
  {
    id: "variables_typed",
    domain: "script-quality",
    description:
      "Python function definitions carry type annotations on " +
      "every parameter (excluding `self`, `cls`, `*args`, " +
      "`**kwargs`, `_`). Untyped parameters are flagged with the " +
      "function name + offending parameter list. Heuristic — " +
      "regex-based scan of `def NAME(args)` patterns; multi-line " +
      "signatures with line breaks inside the parameter list are " +
      "a known false-negative case. Authors add `: Any` where the " +
      "type genuinely is untyped.",
    default_severity: "minor",
    depends_on: ["ts"],
    automated: true,
    source_file: "pipeline/qa-checkers-python.ts",
  },
  {
    id: "has_references_to_paper",
    domain: "script-quality",
    description:
      "Python script contains at least one `# Ref: [key] …` " +
      "comment citing a bibliography entry (matching the Lean " +
      "convention from CLAUDE.md §1 — every `sorry` requires a " +
      "bibliographic citation; the same discipline applies to " +
      "compute scripts that derive content from the paper). The " +
      "citation lets a reviewer trace the script back to the " +
      "proposition / theorem it computes. Pure-infrastructure " +
      "scripts (no paper-derived content) override with a `human` " +
      "reviewer `result: \"n/a\"` entry.",
    default_severity: "minor",
    depends_on: ["ts"],
    automated: true,
    source_file: "pipeline/qa-checkers-python.ts",
  },
  {
    id: "connected_to_ci_pipeline",
    domain: "script-quality",
    description:
      "Python script is exercised by CI — its basename appears in " +
      "at least one `.github/workflows/*.yml` file, OR it is " +
      "imported (as a library / helper module) by a sibling script. " +
      "Scripts not connected to CI accumulate silent regressions; " +
      "this criterion flags them as candidates for either CI " +
      "wiring or `_deprecated/`. `__init__.py`, `conftest.py`, and " +
      "scripts under `_deprecated/` get an `n/a` result. Note: " +
      "this checker reads workflow files outside the audited " +
      "script — cached per sweep run for performance.",
    default_severity: "minor",
    depends_on: ["ts"],
    automated: true,
    source_file: "pipeline/qa-checkers-python.ts",
  },
  {
    id: "deprecated",
    domain: "script-quality",
    description:
      "Python script is flagged as deprecated when ANY of: path " +
      "contains `/_deprecated/`, file contains a `# DEPRECATED` " +
      "comment line, or the module docstring contains the word " +
      "\"DEPRECATED\" verbatim. Severity `minor` — deprecation is " +
      "a status flag, not a correctness bug. A `human` reviewer " +
      "entry can move an intentionally-retained deprecated script " +
      "to `pass`. Cross-axis to content blocks: a sibling " +
      "criterion in the block-QA axis flags deprecated `.md` / " +
      "`.ts` content the same way.",
    default_severity: "minor",
    depends_on: ["ts"],
    automated: true,
    source_file: "pipeline/qa-checkers-python.ts",
  },
  {
    id: "uses_library_framework_appropriately",
    domain: "script-quality",
    description:
      "Python script consumes the standard library framework " +
      "appropriately: (1) scripts that write `.witness.json` " +
      "must import `WitnessBuilder` from `witness_base` so the " +
      "payload is stamped with provenance + script-hash metadata; " +
      "(2) no hardcoded math constants (`pi = 3.14…`, `e = 2.71…`) " +
      "— use `mpmath.mp.pi` / `mpmath.mp.e` for 50-digit substrate " +
      "precision. Strings and `#` comments are stripped before " +
      "scanning to avoid false positives on narrative references.",
    default_severity: "major",
    depends_on: ["ts"],
    automated: true,
    source_file: "pipeline/qa-checkers-python.ts",
  },
  {
    id: "assertions_are_falsifiable",
    domain: "script-quality",
    description:
      "A witness assertion must be able to FAIL. Fires when an " +
      "`add_assertion(...)` call passes the same expression as both " +
      "`computed` and `expected`, so the assertion holds by construction " +
      "and the resulting `allPassed: true` says nothing about what the " +
      "script produced — which is what a block's `computation.status: " +
      "\"verified\"` rests on. Keyword and positional forms both checked. " +
      "Regex, not AST (no Python runtime in the sweep): measured 90% recall " +
      "at 100% sampled precision against an AST census, and it " +
      "under-reports by design, since a missed tautology stays a backlog " +
      "item while a false one costs an author an argument with the checker. " +
      "Remedy: supply the real expected value; if none exists yet, assert a " +
      "different property that can fail rather than re-deriving the " +
      "computation under test, which is the same defect spelled out.",
    default_severity: "critical",
    depends_on: ["ts"],
    automated: true,
    source_file: "pipeline/qa-checkers-python.ts",
  },
] satisfies QaCriterionDefinition[]).map((c) => ({ ...c, subject: "script" as const }));

// ── Domain: devils-advocate ─────────────────────────────────────
//
// Owned by `local/devils-advocate-watcher` (adversarial review).
// All criteria are agent-only (automated: false).

const DEVILS_ADVOCATE: QaCriterionDefinition[] = [
  { id: "da-false-claim", domain: "devils-advocate", description: "Stated proposition is mathematically false (counterexample / quantifier slip / failing special case).", default_severity: "critical", depends_on: ["md", "ts", "lean"], automated: false },
  { id: "da-vacuous", domain: "devils-advocate", description: "True but content-free: ': True := trivial', self-assuming projection, tautology, or trivializing hypothesis.", default_severity: "major", depends_on: ["md", "ts", "lean"], automated: false },
  { id: "da-circular", domain: "devils-advocate", description: "Derivation assumes its conclusion: back-fitted target, smuggled calibration, self-referential justification.", default_severity: "critical", depends_on: ["md", "ts", "lean"], automated: false },
  { id: "da-overclaim", domain: "devils-advocate", description: "Conclusion stronger than the argument supports: scope-limited negative as structural, fitted-as-derived, conditional-as-proved, approximate-as-absolute.", default_severity: "major", depends_on: ["md", "ts", "lean"], automated: false },
  { id: "da-hidden-dof", domain: "devils-advocate", description: "Undisclosed free parameter: 4th calibration, off-menu coefficient, constant with no canonical-chain origin.", default_severity: "major", depends_on: ["md", "ts", "lean"], automated: false },
  { id: "da-non-sequitur", domain: "devils-advocate", description: "Logical gap: step B does not follow from step A; 'therefore' with a missing lemma.", default_severity: "major", depends_on: ["md", "ts", "lean"], automated: false },
  // `automated: false` here is a MEASURED necessity, not a convenience. A
  // prototype scanner flags all 4 known layers but fires IDENTICALLY on the
  // CORRECTED text — it detects the topic, not the defect, because the
  // discriminating fact (does the index bind across the equivalence? is the
  // symbol level-indexed in its Lean type? are the two legs the same instance?)
  // is semantic, not lexical.
  //
  // ADJUDICATED PRECISION IS 0% — 0 defects in 29 candidates over 6395 files,
  // on the first real agent pass (2026-08-16). An earlier revision of this
  // comment said "~10%"; that was a TRIAGE estimate (three hits that looked
  // worth opening) reported as if it were an adjudication. All three were then
  // adjudicated legit — one of them, "at Kummer level n, kappa_0 mod n vanishes
  // iff n | chi(A)", is in fact a MODEL of the correct form, since the index
  // binds on both sides. Per-candidate verdicts: qou PR #5191.
  //
  // That strengthens this `automated: false` rather than weakening it: a
  // checker with 0% adjudicated precision must not write sidecars. The
  // criterion itself stands — the four historical layers were real, and it
  // is the DISCIPLINE (the four questions) that catches them, not the regex.
  //
  // Candidate lister is print-only; only an agent verdict writes a sidecar.
  // Four questions + full measurement: qou `local/devils-advocate-watcher`.
  { id: "da-arity-conflation", domain: "devils-advocate", description: "A predicate that VARIES (over states, levels, or instances) conflated with the single truth value of its universal closure: a level-indexed family read as one Prop; a pointwise claim (forall P, v <-> Pred P) refuted where the corpus asserts the universal closure (v <-> forall P, Pred P, which is trivially inhabited); a one-instance theorem read as a cross-instance identification; a set-level fact (undecidable / not cut out by an ideal / cofinite locus) used to deny a truth-value equivalence.", default_severity: "major", depends_on: ["md", "ts", "lean"], automated: false },
  // Lean. The only `da-*` entry whose whole question is Lean-vs-narrative;
  // the rest (overclaim, citation misuse, reproducibility, non sequitur, …)
  // are objections a reviewer can raise against any prose and stay unscoped.
  //
  // Scoped to the paper profile (folio-assistant-nba0): `qa-sweep` runs
  // adapter, profile, and companion gates before reporting `needs-agent`,
  // so this criterion is correctly excluded (n/a) on document folios.
  { id: "da-lean-narrative-divergence", domain: "devils-advocate", description: "Lean proves something weaker/different/vacuously-implied vs the .md claim (proof-statement-integrity).", default_severity: "major", profiles: ["paper"], depends_on: ["md", "ts", "lean"], automated: false },
  { id: "da-citation-misuse", domain: "devils-advocate", description: "Cited reference (cites[] or -- Ref:) does not contain / is mis-attributed for the invoked result.", default_severity: "minor", depends_on: ["md", "ts", "lean"], automated: false },
  { id: "da-definitional-ambiguity", domain: "devils-advocate", description: "Key term undefined / multiple incompatible readings / 'the unique X' without uniqueness / implicit regime or base ring.", default_severity: "minor", depends_on: ["md", "ts", "lean"], automated: false },
  { id: "da-empirical-fragility", domain: "devils-advocate", description: "Numerical match inside fit noise / cherry-picked precision / hidden cross-anchor swing / stale vs current q0 pin.", default_severity: "major", depends_on: ["md", "ts", "lean"], automated: false },
  { id: "da-physical-implausibility", domain: "devils-advocate", description: "Physics claim a domain expert rejects: wrong units, broken conservation, contradiction with a measurement.", default_severity: "major", depends_on: ["md", "ts", "lean"], automated: false },
  { id: "da-reproducibility", domain: "devils-advocate", description: "Backing compute/witness irreproducible / stale (scriptHash or scriptCommitSha drift) / value contradicts prose approximate.", default_severity: "major", depends_on: ["md", "ts", "lean"], automated: false },
  { id: "da-referee-verdict", domain: "devils-advocate", description: "Block-level rollup; carries the 'verdict' field + the strongest objection in 'referee_argument'.", default_severity: "major", depends_on: ["md", "ts", "lean"], automated: false }
];

// ── Domain: expo (Milnor exposition raters) ─────────────────────
//
// Agent-judged exposition criteria held to John Milnor's expository
// standard. The full rubric + agent prompt for each lives in the
// requirements doc `docs/requirements/2026-07-04-folio-assistant-
// proof-narrative-checkers.md` (§5A expo-milnor-clarity, §5B
// milnor-brevity), not in this registry — the `description` here is
// the one-liner; the rater carries the rubric.
//
// Narrative-bearing kinds only; `n/a` on pure equation / diagram /
// simulator / glossary blocks and near-empty (< ~50-word) prose.

const EXPO_NARRATIVE_KINDS = [
  "definition",
  "theorem",
  "proposition",
  "lemma",
  "corollary",
  "remark",
  "prose",
  "example",
  "conjecture",
];

// ── Domain: voice overlays (opt-in, one criterion per voice) ────
//
// One criterion per shipped voice rather than one per RULE, and that is the
// whole design decision here.
//
// A rule-level criterion would put 34 rows on every block's sidecar, 30 of them
// `judgementOnly` and therefore permanently `needs-agent` — a sidecar nobody
// reads and a queue nobody drains. The unit an agent actually adjudicates is a
// block against a voice: it loads that voice's rules, checks the mechanical
// halves, opens the citations it needs, and records ONE verdict with the
// findings as evidence. `voice-review.bpmn` is that loop, and these criteria are
// where its verdict lands.
//
// Each names its voice in `voices`, so `voiceExcludesCriterion` makes it `n/a`
// on a folio that has not activated it — with the reason written into the entry
// rather than left to a reader to infer. This layer activates none, so all
// four read `n/a` here, which is the correct and intended output.
//
// `automated: false` on all four: the mechanical half belongs to the individual
// rule's `patterns` and `terminology`, and three of the four voices are mostly
// judgement. Declaring a checker that can only ever confirm a handful of regexes
// would misreport what the criterion covers.
const VOICE_OVERLAYS: QaCriterionDefinition[] = [
  // ── The voice-overlay criteria are DERIVED, not written here ────────────
  //
  // Four entries stood at this point, one per voice, each restating that
  // voice's rules in prose — three of them describing files in ANOTHER
  // layer, and every one of them restating rules WITHOUT the citation the
  // voice itself carries. The platform held an uncited copy of rules the
  // owning layer holds cited, in the subsystem whose whole argument is that
  // a voice is auditable rather than asserted. Bean `btuv`.
  //
  // `voice-criteria.ts` derives them from the voices instead, so a voice
  // shipping in any layer gets its criterion with no edit here. They are
  // NOT spliced into this array: deriving reads the filesystem, and this is a
  // module-scope const — the work `1hkj` deferred and `check:module-scope-
  // resolution` gates. Use `qaCriteriaFor(root)` below, which is lazy.

];

const EXPO: QaCriterionDefinition[] = [
  {
    id: "expo-milnor-clarity",
    domain: "expo",
    description:
      "Reads with the clarity of John Milnor's exposition (H1–H8: economy, " +
      "concrete-before-abstract, why-before-what, uncluttered notation, linear " +
      "argument, prose-carries-argument, right-tool framing, respect for the " +
      "reader). STRICT gate: pass iff a perfect 16/16 (§5A).",
    default_severity: "major",
    depends_on: ["md"],
    automated: false,
    applies_to: EXPO_NARRATIVE_KINDS,
  },
  {
    id: "milnor-brevity",
    domain: "expo",
    description:
      "Companion to expo-milnor-clarity: no content is repeated / duplicated " +
      "within the block. Resolve discipline is STRICTER than clarity — a repeat " +
      "may be deleted ONLY when the two occurrences are semantically identical " +
      "(content unchanged); if the content DIFFERS you may NOT delete, and never " +
      "delete math content (diagram / equation / derivation). When de-duplication " +
      "would lose distinct content, keep it or SPLIT the block into multiple " +
      "blocks if that aids explication (§5B).",
    default_severity: "major",
    depends_on: ["md"],
    automated: false,
    applies_to: EXPO_NARRATIVE_KINDS,
  },
];

// ── Folio-optional axes ─────────────────────────────────────────
//
// Some criterion families encode a specific folio's subject matter
// rather than platform concerns. Registering them unconditionally puts
// permanently-inapplicable criteria into every other folio's sweep and
// backlog, so a folio opts in explicitly:
//
//   // harness.config.json
//   { "qaAxes": ["q-usage"] }
//
// Absent config ⇒ no optional axes. That default is deliberate: a folio
// that has not asked for an axis should not be audited against it.
//
// Read once at module load. `qa-sweep` and the watchers import the
// registry at startup, so a config change needs a fresh process — which
// is the normal case for these CLIs.

let _optionalAxes: string[] | null = null;

export function folioOptionalAxes(): string[] {
  if (_optionalAxes) return _optionalAxes;
  const axes: string[] = [];
  _optionalAxes = axes;
  try {
    // `undefined` when nothing declares a layer here — no name, so no
    // filename, so no axes. Same answer as an absent config and for the same
    // reason: a folio that has not asked for an axis is not audited against
    // it, and neither is a directory that is not a folio.
    // The index entry when one lists the layer, else `<name>.config.json`.
    const eff = readEffectiveConfig(findContentRepoRoot());
    if (eff.state === "ok") {
      const cfg = eff.config as { qaAxes?: unknown };
      if (Array.isArray(cfg.qaAxes)) {
        axes.push(
          ...cfg.qaAxes.filter((a: unknown): a is string => typeof a === "string"),
        );
      }
    }
  } catch {
    // Unreadable config ⇒ no optional axes, same as absent. Failing
    // closed keeps a malformed file from silently enabling an axis.
  }
  return _optionalAxes;
}

// ── Domain: render ──────────────────────────────────────────────
//
// Source patterns that abort the pdflatex build. Folio-generic: every
// folio renders through the same LaTeX pipeline, so these apply
// everywhere (unlike `q-usage`, which encodes one folio's mathematics).
//
// Admission bar: a criterion belongs here only if it maps to a *fatal*
// pdflatex error class that a corpus scan shows recurring. Cosmetic
// issues (overfull/underfull boxes) never abort a build and would
// drown the signal.

const RENDER: QaCriterionDefinition[] = [
  {
    id: "render-math-mode-envelope",
    domain: "render",
    description:
      "Block's `.md` opens an inner-only math environment (`aligned`, " +
      "`gathered`, `split`, `cases`, `pmatrix`, `array`, …) without an " +
      "enclosing outer math context (`$$…$$`, `\\[…\\]`, `equation`, " +
      "`align`, `gather`, `multline`). A ```tex fence is raw passthrough, " +
      "so such a fence lands in horizontal mode and pdflatex aborts with " +
      '"! Package amsmath Error: \\begin{aligned} allowed only in math ' +
      'mode" plus two "Missing $ inserted" — three errors per slip. ' +
      "Fix by wrapping the environment in `\\[ … \\]`, or by switching " +
      "to the outer `align`/`gather` form. Recurring class: fixed once " +
      "in afdf60d667, then returned in two further blocks.",
    default_severity: "critical",
    // The defect is entirely in the narrative md; ts/lean are irrelevant.
    depends_on: ["md"],
    automated: true,
    // The rule stays here; the checker is the science layer's (bean saqd):
    // it checks LaTeX math environments. See `checker_contributed`.
    checker_contributed: true,
  },
];

// ── Exported registry ───────────────────────────────────────────

// ── Domain: dak ─────────────────────────────────────────────────

/**
 * WHO SMART Guidelines axes — the first criteria scoped to a non-paper
 * adapter.
 *
 * These check **structural presence and well-formedness**, not semantic
 * conformance. Whether a profile validates against its base, whether CQL
 * compiles, whether a decision table is complete over its inputs — those need
 * the real validators (`fhir-validation`, SUSHI, a DMN engine) and belong to
 * the L3 pipeline. A grep-level reimplementation would produce a second,
 * weaker verdict that disagrees with the authoritative one.
 *
 * Every entry declares `adapters: ["dak"]`. Omitting it would silently scope
 * the criterion to `paper` — see `criterionAdapters` — and it would then
 * never run on the blocks it was written for.
 *
 * ## The rule stays here; the checker is the contributor's
 *
 * `dak` is a CONTRIBUTED adapter since bean `1335`: the harness that owns it
 * contributes it, its kinds and these five checkers from its own
 * `contributions.ts` (see `dak-kinds-contribution-2026-10-02.md`). The
 * criteria stay declared in core, marked `checker_contributed`, which is the
 * cut the science layer made for the elaboration-cost checkers — a
 * criterion is a rule about content, a checker is the tooling that answers it.
 * `adapters: ["dak"]` is a plain string: it names the adapter as data, not as
 * an import, so core holds no edge to the contributor for it. Where the
 * contributor is not loaded the criteria resolve no checker and are reported as such, never
 * as a pass — and no block can reach them anyway, because without the
 * contribution no block is a `dak` block.
 */
const DAK: QaCriterionDefinition[] = [
  {
    id: "dak-companion-present",
    domain: "dak",
    adapters: ["dak"],
    // The rule is core's; the checker is contributed (bean `1335`). See the
    // domain note above and `checker_contributed`.
    checker_contributed: true,
    description:
      "A DAK block declares the artefact its kind promises: business-process " +
      "has a .bpmn, decision-table and scheduling-logic a .dmn, cql-library a " +
      ".cql, and the FHIR kinds a .fsh. A manifest without one is a label and " +
      "a title that looks like content in every listing and carries none.",
    default_severity: "major",
    // NOT the artefact itself. `depends_on` gates applicability, so listing
    // `.dmn` here would `n/a` exactly the blocks this exists to flag — the
    // trap documented on `QaCriterionDefinition.depends_on`.
    depends_on: ["ts"],
    also_invalidated_by: ["bpmn", "dmn", "fsh", "cql"],
    automated: true,
  },
  {
    id: "dak-bpmn-has-process",
    domain: "dak",
    adapters: ["dak"],
    // The rule is core's; the checker is contributed (bean `1335`). See the
    // domain note above and `checker_contributed`.
    checker_contributed: true,
    description:
      "The .bpmn parses as XML and declares at least one <process>. Catches a " +
      "placeholder or truncated export before it reaches the IG build.",
    default_severity: "major",
    depends_on: ["bpmn"],
    automated: true,
  },
  {
    id: "dak-dmn-has-decision-table",
    domain: "dak",
    adapters: ["dak"],
    // The rule is core's; the checker is contributed (bean `1335`). See the
    // domain note above and `checker_contributed`.
    checker_contributed: true,
    description:
      "The .dmn declares a <decision> containing a <decisionTable>. A " +
      "definitions shell with no table is decision logic that expresses no " +
      "decision.",
    default_severity: "major",
    depends_on: ["dmn"],
    automated: true,
  },
  {
    id: "dak-fsh-declares-kind",
    domain: "dak",
    adapters: ["dak"],
    // The rule is core's; the checker is contributed (bean `1335`). See the
    // domain note above and `checker_contributed`.
    checker_contributed: true,
    description:
      "The .fsh declares a resource of the kind the block claims — a " +
      "value-set block's FSH says ValueSet, not Profile. Catches the " +
      "copy-paste error a schema cannot see, because both files are " +
      "individually valid.",
    default_severity: "major",
    depends_on: ["fsh"],
    also_invalidated_by: ["ts"],
    automated: true,
  },
  {
    id: "dak-label-prefix-matches-kind",
    domain: "dak",
    adapters: ["dak"],
    // The rule is core's; the checker is contributed (bean `1335`). See the
    // domain note above and `checker_contributed`.
    checker_contributed: true,
    description:
      "The label prefix matches the kind its builder introduces. Zod enforces " +
      "this at construction, so this catches a manifest hand-edited " +
      "afterwards.",
    default_severity: "minor",
    depends_on: ["ts"],
    automated: true,
  },
];
// ── Domain: trap (language-trap / model-idiom audit) ────────────
//
// Ten trap categories marking unedited model idiom in scholarly
// prose (owner specification 2026-08-15). The mechanical scanner
// `pipeline/language-trap-audit.ts` emits high-recall
// script candidates; the authoritative verdict is the per-block
// agent adjudication defined in
// `.claude/skills/local/language-trap-agent-audit.md` (full-context
// judgement, false-positive classes: substantive mathematical
// contrast, temporal status, cross-reference closers, load-bearing
// disambiguation). Agent entries are appended with
// `pipeline/qa-agent-entry.ts`. The diagnostic five
// (negation-contrast, rhetorical-pivot, closing-aphorism,
// meta-commentary, thesis-restatement) are rare in human scholarly
// drafting and near-universal in unedited model output — severity
// `major`; the density four plus the corroborating one are `minor`.

const TRAP: QaCriterionDefinition[] = [
  { id: "trap-negation-contrast", domain: "trap", description: "Asserting by denying the opposite (', not X.' appositive tails; 'not (just) X but Y'). State the positive claim; mathematical contrast that IS the claim passes with a note.", default_severity: "major", depends_on: ["md", "ts"], automated: false },
  { id: "trap-rhetorical-pivot", domain: "trap", description: "Setup-then-reframe ('the question is whether…', 'what matters is…') — the second clause carries the content.", default_severity: "major", depends_on: ["md", "ts"], automated: false },
  { id: "trap-em-dash", domain: "trap", description: "Stylistic spaced dash substituting for sentence structure; density signal, ranges and true parentheticals pass.", default_severity: "minor", depends_on: ["md", "ts"], automated: false },
  { id: "trap-triples", domain: "trap", description: "The reflex three-item list regardless of content; density signal, substantive enumerations pass.", default_severity: "minor", depends_on: ["md", "ts"], automated: false },
  { id: "trap-closing-aphorism", domain: "trap", description: "A quotable-sounding final line placed because documents 'end with quotable lines'. End on content.", default_severity: "major", depends_on: ["md", "ts"], automated: false },
  { id: "trap-meta-commentary", domain: "trap", description: "Narrating one's own emphasis ('worth noting', 'we emphasize', 'the key takeaway'). Place the emphasis, do not announce it; plain 'note that' passes.", default_severity: "major", depends_on: ["md", "ts"], automated: false },
  { id: "trap-thesis-restatement", domain: "trap", description: "Block-final sentence restating what the text already established ('This establishes …' as a closer). 'This completes the proof' and cross-reference closers pass.", default_severity: "major", depends_on: ["md", "ts"], automated: false },
  { id: "trap-performed-warmth", domain: "trap", description: "Personal register in institutional prose ('thank you', 'we are excited', 'journey').", default_severity: "minor", depends_on: ["md", "ts"], automated: false },
  { id: "trap-superlative", domain: "trap", description: "Maximum-strength claims without qualification ('most importantly', 'near-universal', 'single most'); includes intensifier-inflation registers ('rigorously evades', 'seamlessly').", default_severity: "minor", depends_on: ["md", "ts"], automated: false },
  { id: "trap-nonspeakable", domain: "trap", description: "Noun-heavy chains that parse on the page but stall aloud — written for the eye, not the ear.", default_severity: "minor", depends_on: ["md", "ts"], automated: false },
];

// ── ids: a block's label is its identity (bean 5xzc) ────────────
//
// The content graph, a block-level diff against `main`, review comments and
// heat maps all key on the label, so these two gate everything the review
// epic (q4jm) builds. Both are mechanical. Implemented in
// `qa-checkers-ids.ts`, which also says why `id-reingest-stable` is not
// registered yet.

const IDS: QaCriterionDefinition[] = [
  {
    id: "id-unique",
    domain: "ids",
    description:
      "MECHANICAL. No other block in the folio declares this block's label, " +
      "and no other block lists it in `renamedFrom`. A shared label is " +
      "silently collapsed: `buildContentGraph` overwrites the earlier node and " +
      "`validate.ts` adds labels to a Set, so one block takes the other's " +
      "place in every graph, diff and review. `validate.ts` catches a block " +
      "NAME listed twice in a manifest; it does not catch two blocks declaring " +
      "one LABEL. Reusing a retired label is the same defect in time: the old " +
      "block's review history re-attaches to an unrelated block. " +
      "STALENESS CAVEAT: reads the whole-corpus label index, so adding a block " +
      "elsewhere can change this verdict without changing this block's hash; " +
      "re-sweep the axis after adding or relabelling blocks.",
    default_severity: "critical",
    depends_on: ["ts"],
    automated: true,
    source_file: "pipeline/qa-checkers-ids.ts",
  },
  {
    id: "id-stable",
    domain: "ids",
    description:
      "MECHANICAL. A block whose manifest existed at the base ref (env " +
      "`QA_ID_BASE_REF`, default `origin/main`) keeps that label, or lists " +
      "the old one in `renamedFrom`. Moves are followed (`git diff -M`), so a " +
      "block that moved AND was relabelled is still compared with its old " +
      "self. A new block is an addition and passes. `n/a` when the base ref " +
      "cannot be reached: an unreachable base is undetermined, never stable. " +
      "STALENESS CAVEAT: the verdict depends on the base ref, which is not in " +
      "the block's hash; re-sweep after the base moves.",
    default_severity: "major",
    depends_on: ["ts"],
    automated: true,
    source_file: "pipeline/qa-checkers-ids.ts",
  },
];

export const QA_CRITERIA_REGISTRY: QaCriterionDefinition[] = [
  ...VOICE,
  ...VOICE_OVERLAYS,
  ...FIT,
  // Folio-optional — see `FRAMEWORK` above. One folio's notation, on the same
  // `archimedean-wall` axis as the wall criteria, because it is the same
  // folio's mathematics.
  ...(folioOptionalAxes().includes("archimedean-wall") ? FRAMEWORK : []),
  ...RENDER,
  // Folio-optional — see `WALL` above. One folio's wall and one folio's
  // chapter names; the same `archimedean-wall` axis as the detangler
  // criterion below, because it is the same wall.
  ...(folioOptionalAxes().includes("archimedean-wall") ? WALL : []),
  // Q_USAGE is FOLIO-OPTIONAL — see `folioOptionalAxes()` below. It
  // encodes one folio's mathematics (a substrate deformation parameter
  // `q` and its regimes), so it is registered only when the folio opts
  // in. Spread unconditionally it would put 7 inapplicable criteria in
  // every other folio's sweep.
  ...(folioOptionalAxes().includes("q-usage") ? Q_USAGE : []),
  ...PROOF,
  ...CANONICAL,
  ...COMPUTE,
  ...DETANGLER,
  // Folio-optional — see `DETANGLER_ARCHIMEDEAN_WALL` above. One folio's
  // wall and one folio's chapter names; `profiles: ["paper"]` does not
  // fence them, because every paper folio has a `.lean` to read.
  ...(folioOptionalAxes().includes("archimedean-wall")
    ? DETANGLER_ARCHIMEDEAN_WALL
    : []),
  ...USES,
  ...BIBLIOGRAPHY,
  ...SCRIPT_QUALITY,
  ...DEVILS_ADVOCATE,
  ...EXPO,
  ...DAK,
  ...TRAP,
  ...IDS,
];

export const SCRIPT_QUALITY_CRITERIA: string[] = SCRIPT_QUALITY.map(
  (c) => c.id,
);

export const QA_CRITERIA_BY_ID: Record<string, QaCriterionDefinition> =
  Object.fromEntries(QA_CRITERIA_REGISTRY.map((c) => [c.id, c]));

export const QA_CRITERIA_BY_DOMAIN: Record<string, QaCriterionDefinition[]> =
  QA_CRITERIA_REGISTRY.reduce(
    (acc, c) => {
      (acc[c.domain] ??= []).push(c);
      return acc;
    },
    {} as Record<string, QaCriterionDefinition[]>,
  );

// Per-watcher criterion subsets. Each integration watcher reads
// its own subset to compute backlog + dispatch agent reviews.

/**
 * The set of criteria the `one-voice-integration-watcher` is
 * responsible for. Mirrors the historical voice + fit + framework +
 * wall buckets.
 */
export const ONE_VOICE_WATCHER_CRITERIA: string[] = [
  ...VOICE.map((c) => c.id),
  ...FIT.map((c) => c.id),
  ...FRAMEWORK.map((c) => c.id),
  // Gated with the registry, never apart from it: a bucket naming a
  // criterion the registry never registered is a watcher axis reporting on
  // nothing and looking clean doing it (bean `dh4f`).
  ...(folioOptionalAxes().includes("archimedean-wall")
    ? WALL.map((c) => c.id)
    : []),
];

export const PROOF_WATCHER_CRITERIA: string[] = PROOF.map((c) => c.id);
export const CANONICAL_WATCHER_CRITERIA: string[] = CANONICAL.map((c) => c.id);
export const COMPUTE_WATCHER_CRITERIA: string[] = COMPUTE.map((c) => c.id);
export const DETANGLER_WATCHER_CRITERIA: string[] = [
  ...DETANGLER.map((c) => c.id),
  // Present only when the folio opts in (see folioOptionalAxes). The
  // watcher bucket has to agree with the registry: a bucket naming a
  // criterion the registry never registered is a watcher axis that
  // reports on nothing and looks clean doing it (bean `dh4f`).
  ...(folioOptionalAxes().includes("archimedean-wall")
    ? DETANGLER_ARCHIMEDEAN_WALL.map((c) => c.id)
    : []),
];
export const USES_WATCHER_CRITERIA: string[] = USES.map((c) => c.id);
export const BIBLIOGRAPHY_WATCHER_CRITERIA: string[] = BIBLIOGRAPHY.map(
  (c) => c.id,
);
export const Q_USAGE_WATCHER_CRITERIA: string[] = Q_USAGE.map((c) => c.id);
export const EXPO_WATCHER_CRITERIA: string[] = EXPO.map((c) => c.id);

/**
 * All watcher buckets, keyed by watcher short name (matches the
 * `/integration-watch` / `/integration-backlog` axis arguments).
 */
export const WATCHER_CRITERIA_BY_AXIS: Record<string, string[]> = {
  "one-voice": ONE_VOICE_WATCHER_CRITERIA,
  proof: PROOF_WATCHER_CRITERIA,
  canonical: CANONICAL_WATCHER_CRITERIA,
  compute: COMPUTE_WATCHER_CRITERIA,
  detangler: DETANGLER_WATCHER_CRITERIA,
  uses: USES_WATCHER_CRITERIA,
  bibliography: BIBLIOGRAPHY_WATCHER_CRITERIA,
  // Present only when the folio opts in (see folioOptionalAxes).
  ...(folioOptionalAxes().includes("q-usage")
    ? { "q-usage": Q_USAGE_WATCHER_CRITERIA }
    : {}),
  expo: EXPO_WATCHER_CRITERIA,
};

// ── Source-file + extra-input declaration (script staleness) ────

/**
 * Path (repo-relative) to the source file containing each automated
 * checker function. Used by qa-sweep to compute the entry's
 * `script_hash` and write per-criterion script sidecars.
 *
 * `qa-checkers-voice.ts` hosts the original voice / framework /
 * wall checkers (10 criteria); `qa-checkers-extended.ts` hosts
 * everything else (proof, canonical, compute, detangler,
 * bibliography, voice-title-scholarly).
 */
export const VOICE_CHECKER_FILE =
  "pipeline/qa-checkers-voice.ts";
export const EXTENDED_CHECKER_FILE =
  "pipeline/qa-checkers-extended.ts";
/**
 * Hosts the `uses` axis checkers. Both read the typed content graph,
 * so `content-graph.ts` is declared as an extra input below — a change
 * to the graph builder must invalidate their sidecar entries.
 */
export const USES_CHECKER_FILE = "pipeline/qa-checkers-uses.ts";
// The elaboration-cost checkers USED to be hosted here, and this constant
// named them: `pipeline/qa-checkers-cost.ts`. They moved to
// the science layer on 2026-09-21 (bean `rfev`) because elaboration cost
// is a Lean measurement, so the checker is the science layer's tooling while
// the criterion stays core's rule.
//
// The constant is GONE rather than repointed. A core module holding a path
// string into the science layer would be core naming a higher layer — invisible to
// `check:partition`, which counts imports and not strings, and precisely the
// runtime edge bean `zlmp` measured five of. Both criteria now carry
// `checker_contributed: true`, and `resolveCriterionSource` asks the
// contribution registry.
// The machine-triviality checker was hosted here as
// `pipeline/qa-checkers-triviality.ts`, named by a `TRIVIALITY_CHECKER_FILE`
// constant. It moved to the science layer on 2026-10-30 (bean saqd) with the
// Lean vacuity and render-math-mode-envelope checkers; the constant is gone
// rather than repointed, for the reason the cost checkers' is.

// The WHO L2 DAK companion checkers were hosted in core as
// `pipeline/qa-checkers-dak.ts`, named by a `DAK_CHECKER_FILE` constant
// here. They moved out on 2026-10-02 (bean `1335`), with the `dak`
// adapter itself, and the constant is gone rather than repointed for the same
// reason the cost checkers' is: a core module holding a path into another
// layer is core naming a higher layer. The five criteria carry
// `checker_contributed: true`.

// ── The allow-list, and why getting it wrong is silent ─────────────
//
// `getCriterionSourceFile` falls through to EXTENDED_CHECKER_FILE for
// anything it does not recognise. That default is not a harmless guess: the
// resolved path is what `script_hash` is computed over, so a criterion
// pointed at a file that does not contain its checker NEVER INVALIDATES.
// Its verdicts stay "fresh" forever, and editing the real checker changes
// nothing — the sweep keeps serving the answer it cached before the fix.
//
// Measured 2026-09-18: ELEVEN criteria were in exactly that state — the six
// added below plus all five `dak-*`. Found because a fix to
// `checkAuthorNotesPollution` (in qa-checkers-voice.ts) did not change its
// verdict: the sidecar was hashing qa-checkers-extended.ts, which the fix
// never touched. A wrong `pass` is believed; a verdict that cannot go stale
// is worse, because nothing about it ever looks wrong.
//
// `scripts/tests/qa-criterion-source-file.test.ts` now pins declared ==
// actual for every automated criterion, so a new checker in a new file
// cannot re-enter this state unnoticed. Prefer an explicit `source_file` on
// the registry entry over adding an id here.
const VOICE_FILE_IDS = new Set<string>([
  "voice-status-leak",
  "voice-emoji-content",
  "voice-first-person-work",
  "voice-time-stamped-notes",
  "voice-unicode-crash",
  "voice-editorializing",
  "voice-ai-slop",
  "voice-scholarly-default",
  // Added 2026-09-18 — all six dispatch from qa-checkers-voice.ts and were
  // silently hashing qa-checkers-extended.ts.
  "voice-probe-narrative",
  "voice-agent-speak",
  "voice-author-notes-pollution",
  "voice-status-section",
  "cite-named-theorem",
]);

/**
 * Resolve a criterion's source file. Honours the explicit
 * `source_file` field on the registry entry; otherwise applies
 * the dispatch-table heuristic above.
 */
export function getCriterionSourceFile(criterionId: string): string {
  const def = QA_CRITERIA_BY_ID[criterionId];
  // A criterion whose checker a DEPENDENCY owns has no answer here, and the
  // cascade below ends in a default — so without this it would quietly resolve
  // to `qa-checkers-extended.ts`, whose bytes have nothing to do with it. That
  // is the never-invalidates state this whole block exists to prevent, so the
  // state is made unreachable rather than merely avoided by every caller
  // remembering. `resolveCriterionSource` is the one that can answer.
  if (def?.checker_contributed) {
    throw new Error(
      `criterion "${criterionId}" declares checker_contributed, so its checker is ` +
        `not in this instance and this function cannot locate it. Use ` +
        `resolveCriterionSource(id, root, registry), which asks the contribution ` +
        `registry and reports an unsupplied checker as unresolved rather than ` +
        `resolving it to a default whose hash would never go stale.`,
    );
  }
  if (def?.source_file) return def.source_file;
  if (VOICE_FILE_IDS.has(criterionId)) return VOICE_CHECKER_FILE;
  if (criterionId.startsWith("uses-") || criterionId === "lean-ref-owns-decl")
    return USES_CHECKER_FILE;
  return EXTENDED_CHECKER_FILE;
}

/**
 * Extra-input files some criteria consult beyond the block under
 * audit. Paths are repo-relative. Listed inputs are concatenated
 * + hashed into the entry's `deps_hash`.
 *
 * Criteria absent from this map have no extra inputs and write no
 * `deps_hash`.
 */
export const CRITERION_EXTRA_INPUTS: Record<string, string[]> = {
  "proof-no-conj-propagation-violation": [
    "docs/audits/2026-05-01-p3-1-conjectural-propagation.witness.json",
  ],
  "proof-no-trivial-skeleton": [
    "docs/audits/2026-05-08-trivial-skeleton-audit.json",
  ],
  "proof-conditional-class-banner": [
    "docs/audits/2026-05-09-conditional-class-banner.witness.json",
  ],
  "proof-lean-compiles": [
    "docs/audits/lean-compile-diagnostics.json",
  ],
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  "bib-cite-resolves": ["folio/schema/references.ts"],
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  "bib-cited-ref-has-url": ["folio/schema/references.ts"],
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  "bib-cited-ref-metadata-ok": ["folio/schema/references.ts"],
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  "bib-cited-ref-has-screenshot": ["folio/schema/references.ts"],
};

/** Resolve a criterion's extra-input list (`[]` if none). */
export function getCriterionExtraInputs(criterionId: string): string[] {
  const def = QA_CRITERIA_BY_ID[criterionId];
  if (def?.extra_inputs) return def.extra_inputs;
  return CRITERION_EXTRA_INPUTS[criterionId] ?? [];
}

// ── The whole set: written + derived ──────────────────────────────────────

/**
 * Every criterion that applies to a layer — the static ones above plus the
 * voice overlays derived from whatever voices the repository ships.
 *
 * **Callers should prefer this over {@link QA_CRITERIA_REGISTRY}.** That array
 * is the criteria a reader can see by opening this file; it is no longer the
 * whole set, and a consumer that iterates it alone silently skips every voice.
 *
 * It is a FUNCTION rather than a second const because deriving reads the
 * filesystem, and module-scope filesystem work is what bean `1hkj` deferred and
 * `check:module-scope-resolution` gates: a malformed declaration must not be
 * able to abort this module and strand `QA_CRITERIA_REGISTRY` itself. The
 * derivation memoises per root, so the cost is one read per process.
 */
export function qaCriteriaFor(instanceRoot: string): QaCriterionDefinition[] {
  return [...QA_CRITERIA_REGISTRY, ...voiceCriteriaFor(instanceRoot)];
}

/** {@link qaCriteriaFor}, indexed by id. */
export function qaCriteriaByIdFor(
  instanceRoot: string,
): Record<string, QaCriterionDefinition> {
  const out: Record<string, QaCriterionDefinition> = { ...QA_CRITERIA_BY_ID };
  for (const c of voiceCriteriaFor(instanceRoot)) out[c.id] = c;
  return out;
}
