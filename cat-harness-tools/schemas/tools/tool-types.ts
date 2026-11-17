/**
 * The shared I/O type vocabulary Tool ports reference.
 *
 * `ToolDefinition.io.*.schema` is an **absolute IRI**, so the types it names
 * have to exist somewhere fetchable. This is that somewhere: one published
 * JSON Schema per type (`tool-types/<Name>.schema.json`) and a combined
 * document of `$defs`, generated from Zod like every other schema here.
 *
 * ## A shared document rather than a schema per tool
 *
 * A Task's inputs are checked against the Tool that will execute it, so two
 * tools satisfying one skill — `beans-cli` and `beans-manual` — must declare
 * the *same* input type for "these are interchangeable" to be verifiable. A
 * shared `$defs` makes that identity rather than a structural comparison.
 *
 * It is also what `mcp-contract` checks against: a served MCP tool's
 * `inputSchema` must agree with the Tool node's `io`, and agreement is only
 * decidable if both sides name the same type.
 *
 * @module schemas/tool-types
 * @graphNode schema
 */
import { z } from "zod";

import type { TermLayer } from "../content/vocabulary.js";

import { renderingPath } from "../kg/cat-harness.js";
import { ProvActivitySchema as ProvActivityRecordSchema } from "../content/prov.js";

/** A bean's identifier, e.g. `folio-assistant-1dfh`. */
export const BeanIdSchema = z.string().regex(/^[a-z0-9-]+$/).describe("A bean identifier, e.g. folio-assistant-1dfh");

/** Exactly the statuses the beans CLI can produce. */
export const BeanStatusSchema = z
  .enum(["draft", "todo", "in-progress", "completed", "scrapped"])
  .describe("A bean status. Exactly what `beans update --status` accepts.");

/**
 * A repository-relative path.
 *
 * Constrained rather than a bare string, for two reasons that both matter.
 * Shell metacharacters are excluded, so the value cannot be a payload even if a
 * careless caller ever built a command string. And **`..` segments are
 * excluded**, so a path argument cannot escape the repository — traversal is
 * the injection-shaped bug that path types actually get hit with, and it is
 * invisible to any amount of argv-array discipline.
 */
export const RepoPathSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9._][A-Za-z0-9._/-]*$/, "a repo path is alphanumerics, dot, underscore, slash and hyphen")
  .refine((p) => !p.split("/").includes(".."), "a repo path may not contain a `..` segment")
  .describe("A path relative to the repository root. No `..` segments.");

/**
 * A repository path to a delimited text file (CSV or TSV).
 *
 * Distinct from {@link WorkbookPathSchema} because the Tools taking them read
 * different formats: typed alike, they read as interchangeable, and
 * `deriveAlternatives` (#1168, B9a) would call them alternatives.
 *
 * The same shape as `RepoPath`, and NOT refined by extension: a CSV has no
 * magic bytes, and routing one must not become an extension guess (bean
 * `p67i`). The distinction is the NAME — what the Tool is declared to read.
 */
export const DelimitedTextPathSchema = RepoPathSchema.describe("A repository path to a delimited text (CSV or TSV) file.");

/** A repository path to a spreadsheet workbook. See {@link DelimitedTextPathSchema}. */
export const WorkbookPathSchema = RepoPathSchema.describe("A repository path to a spreadsheet workbook.");

/** An absolute http(s) URL. */
export const UrlSchema = z.string().url().describe("An absolute http(s) URL");

/**
 * A git branch name.
 *
 * Narrower than git's own rules on purpose: git permits characters this
 * excludes, and a Tool argument is not the place to find out which. The set
 * here covers every branch this project has ever used (`claude/…`, `main`,
 * `release-…`) and contains no shell metacharacter.
 */
export const BranchSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, "a branch name is alphanumerics, dot, underscore, slash and hyphen")
  .refine((b) => !b.includes(".."), "a branch name may not contain `..`")
  .describe("A git branch name");

/**
 * A package script name (`check:catalogue`, `site:catalogue`): what a Tool
 * runs as `bun run <name>`, so the thing executed is what the layer's own
 * package.json says. Alphanumerics, colon, dot, underscore and hyphen, and it
 * cannot start with a hyphen (no flag injection). Owner, 2026-10-10 (bean n3h9).
 */
export const ScriptNameSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9][A-Za-z0-9:._-]*$/, "a script name is alphanumerics, colon, dot, underscore and hyphen")
  .describe("A package script name");

import { RepoFullNameSchema } from "../kg/repo-full-name.js";
import { BeanClaimCheckSchema, BeanQueryRowsSchema, DrainQueueSchema, OpenWorkLookupSchema, SessionSweepSchema } from "./store-tool-results.js";
import { HarnessStatesSchema } from "../sdlc/harness-state.js";
import { GatesReportTypeSchema, MergedGatesReportTypeSchema } from "../sdlc/gates-report.js";
import {
  WorkflowCompletionSchema,
  WorkflowGateAnswerSchema,
  WorkflowListingSchema,
  WorkflowPositionSchema,
  WorkflowStartedSchema,
} from "./workflow-tool-results.js";
export { RepoFullNameSchema };

/** A pull/merge request number. */
export const ChangeProposalNumberSchema = z
  .number()
  .int()
  .positive()
  .describe("A change-proposal number — a pull request on GitHub, a merge request on GitLab");

/**
 * A review thread on a change proposal, as the forge names it: a GitHub
 * review-thread node id (`PRRT_kwDO…`), or a GitLab discussion id (40 hex, or
 * a prefix of 8 or more) or note id. Owner, 2026-10-20 (bean
 * `folio-assistant-4dbr`, "Add the type"), so that resolving a thread can be a
 * Tool node with the id on the command line.
 *
 * Letters, digits, underscore and hyphen only, and it cannot start with a
 * hyphen, so no value can be read as a flag or carry a shell metacharacter.
 * Wide enough for both forges' shapes and no wider; the length cap bounds an
 * opaque token, not a known format.
 */
export const ReviewThreadIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{6,127}$/, "a review thread id is 7 to 128 letters, digits, underscores and hyphens, not starting with a hyphen")
  .describe("A review thread id — a GitHub review-thread node id or a GitLab discussion id");

/**
 * A GitLab username, e.g. `litlfred` or `jane.doe`. Owner, 2026-10-24 (bean
 * `folio-assistant-4dbr`, "Fill both gaps"), so that requesting review on a
 * merge request can be a Tool node: GitLab usernames may hold `.` and `_` and
 * run past GitHub's 39 characters, so `Login` refuses some of them.
 *
 * GitLab's own rule: letters, digits, `_`, `-` and `.`; not starting with `-`
 * or `.`, not ending with `.`, `.git` or `.atom`, at most 255 long. No value
 * can be read as a flag or carry a shell metacharacter.
 */
export const GitLabUsernameSchema = z
  .string()
  .regex(/^[A-Za-z0-9_](?:[A-Za-z0-9_.-]{0,253}[A-Za-z0-9_-])?$/, "a GitLab username is letters, digits, '_', '-' and '.', not starting with '-' or '.' and not ending with '.'")
  .refine((u) => !/\.(git|atom)$/i.test(u), "a GitLab username does not end with .git or .atom")
  .describe("A GitLab username, e.g. jane.doe");

/**
 * Free prose — a bean body, a comment, a note. **Deliberately unconstrained, and
 * therefore not admissible as a command-line argument.**
 *
 * See `INJECTION_SAFE` below. Markdown is the honest exception: prose can
 * legitimately contain a semicolon, a backtick and a `$(`. There is no regex
 * that admits real prose and excludes a payload, and pretending otherwise is
 * worse than saying so — a type that claims to be safe and is not is how an
 * escape gets skipped downstream.
 */
export const MarkdownSchema = z.string().describe("Markdown text. Not admissible as a command-line argument — see INJECTION_SAFE.");

/**
 * The name of a skill, as an activity's `<bootstrap.processes:skill ref>` writes it.
 *
 * Same shape as a file stem under `skills/<package>/`, because that is what it
 * resolves to — `knownSkills()` in `scripts/known-skills.ts` builds its set by
 * stripping `.md`, so a name that cannot be a stem cannot be a skill.
 */
export const SkillNameSchema = z
  .string()
  .min(1)
  .regex(/^[a-z][a-z0-9-]*$/, "a skill name is lowercase alphanumerics and hyphens, starting with a letter")
  .describe("A skill name, e.g. todo-manager");

/**
 * A reference to a skill: a bare name, or `package/name`.
 *
 * #1168 B8, owner 2026-09-30 (*"both; qualify if ambiguous"*): a bare name is
 * enough while it names one skill, and `package/name` says which when two
 * packages hold a skill of that name. `resolveSkillRef` in
 * `scripts/known-skills.ts` resolves either form and reports an ambiguous bare
 * name rather than picking one.
 */
export const SkillRefSchema = z
  .string()
  .min(1)
  .regex(
    /^(?:[a-z][a-z0-9-]*\/)?[a-z][a-z0-9-]*$/,
    "a skill reference is a skill name, optionally qualified by its package: `name` or `package/name`",
  )
  .describe("A skill reference, e.g. todo-manager or sdlc-core/todo-manager");

/** A skill package — the directory under `skills/`, e.g. `folio-core`. */
export const PackageNameSchema = z
  .string()
  .min(1)
  .regex(/^[a-z][a-z0-9-]*$/, "a package name is lowercase alphanumerics and hyphens, starting with a letter")
  .describe("A skill package, e.g. folio-core");

/**
 * A BPMN process id — the stem of a `.bpmn` under a declared workflow
 * directory, e.g. `crdm-requirements`.
 * @general — a node others depend on: it points only at other general nodes,
 * never at its dependents (data-modelling step 8; checked by `arrow-direction`).
 */
export const ProcessIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z][a-z0-9-]*$/, "a process id is lowercase alphanumerics and hyphens, starting with a letter")
  .describe("A BPMN process id, e.g. crdm-requirements");

/**
 * A node id **inside** a BPMN document — `A_Implement`, `Gateway_EditorDecision`.
 *
 * Broader than the ids above because BPMN ids are authored by whoever drew the
 * diagram: mixed case and underscores are the house style here and excluding
 * them would make every real diagram unaddressable. It is still a single word
 * with no shell metacharacter in it.
 */
export const NodeIdSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z_][A-Za-z0-9_-]*$/, "a BPMN node id is alphanumerics, underscore and hyphen, starting with a letter or underscore")
  .describe("A node id within a BPMN process, e.g. A_Implement");

/**
 * A running process instance — the stem of a file in the `workflow-state` node
 * of the bean graph.
 *
 * **Named by its graph typology rather than by a path, deliberately.** An earlier
 * draft of this comment named a directory that had already been relocated, and
 * a path written into a doc comment is checked by nothing. The layer
 * declares where that node lives (`beans/beans.json`), so a reader who needs
 * the directory resolves it there and a relocation costs one edit rather than a
 * corpus sweep.
 *
 * Constrained to the same word shape as a filename stem on purpose: the id is
 * used to *build a path* into that store, so a value containing a slash or a
 * `..` would be a traversal rather than a lookup.
 */
export const InstanceIdSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "an instance id is alphanumerics, dot, underscore and hyphen")
  .refine((i) => !i.includes(".."), "an instance id may not contain `..`")
  .describe("A workflow instance id — the stem of a file in the bean graph's workflow-state node");

/**
 * An instant, as an ISO-8601 UTC timestamp — `2026-09-20T14:03:11Z`.
 *
 * **Required on a log line, which is the whole reason it is constrained rather
 * than free text.** A log whose times are written three ways cannot be sorted,
 * and a reader cannot tell "before" from "after" without knowing which writer
 * produced which line. The pattern admits one spelling and refuses the rest.
 *
 * `Z` and not an offset, deliberately. An offset is a second fact — where the
 * writer was — smuggled into a field that answers when, and two lines an hour
 * apart in different offsets compare wrongly as strings. Where the local time
 * matters it is prose, and prose has a home: the optional markdown body.
 *
 * Injection-safe by construction: digits, hyphens, colons, `T` and `Z`, and
 * nothing else parses.
 */
export const TimestampSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/,
    "a timestamp is an ISO-8601 UTC instant, e.g. 2026-09-20T14:03:11Z",
  )
  .describe("An ISO-8601 UTC instant, e.g. 2026-09-20T14:03:11Z");

/**
 * A time window for a history sweep — `4h`, `2d`, `1w`, or a calendar date.
 *
 * Bean `ab3n`'s sweep takes one, and `check:tools` refused the first draft for
 * declaring it `Text`: free text on a command line can express a shell
 * payload, and `--since "$(...)"` is the whole of the objection. The remedy
 * this repository prefers is not escaping but **unrepresentability** — the
 * grammar here admits a count with a unit, or an ISO date, and nothing else
 * parses.
 *
 * Deliberately NARROWER than `git log --since`, which also accepts
 * "yesterday", "last monday" and much else. A tool's declared input type is a
 * contract, not a description of what the underlying program tolerates, and
 * the phrase forms buy nothing a count with a unit does not already give.
 */
export const TimeWindowSchema = z
  .string()
  .regex(
    /^(\d{1,4}[hdw]|\d{4}-\d{2}-\d{2})$/,
    'a time window is a count with a unit (4h, 2d, 1w) or an ISO date (2026-09-20)',
  )
  .describe("A history window: a count with a unit (4h, 2d, 1w) or an ISO date.");

/** A BCP-47 language tag, e.g. `en`, `fr-CA`. */
export const LocaleSchema = z
  .string()
  .min(2)
  .regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, "a locale is a BCP-47 language tag")
  .describe("A BCP-47 language tag, e.g. en or fr-CA");

/**
 * A boolean switch.
 *
 * Injection-safe for a reason no regex gives: it is **not a string**, so there
 * is no value of it that could be a payload. A `Flag` port projects to a bare
 * `--name` with no value word at all.
 */
export const FlagSchema = z.boolean().describe("A boolean switch — projects to a bare flag, with no value word");

/**
 * A short, single-line human string — a title, a person's name, a subject line.
 *
 * **Not injection-safe**, and separate from `Markdown` for a reason that is
 * about Tool *design* rather than about safety: `Markdown` is a body and its
 * home is stdin or a file, while a `Text` is a field. Both are refused as
 * command-line words, so nothing rests on telling them apart at the boundary;
 * the distinction is there so a Tool node says which shape it wants.
 */
export const TextSchema = z
  .string()
  .min(1)
  .max(400)
  .refine((t) => !t.includes("\n") && !t.includes("\r"), "a Text is a single line")
  .describe("A short single-line human string. Not admissible as a command-line argument.");

/**
 * A filesystem path that may point **outside** the repository.
 *
 * Deliberately distinct from `RepoPath` and deliberately **not**
 * injection-safe. `folio_init --assistant-path ../folio-assistant` is a real,
 * correct invocation, and `..` is exactly what `RepoPath` exists to forbid.
 * Rather than weaken `RepoPath` — which would silently remove traversal
 * protection from every port that uses it — the escaping case gets its own type
 * and is refused as a command-line word.
 */
export const FilesystemPathSchema = z
  .string()
  .min(1)
  .describe("A filesystem path, possibly outside the repository. Not admissible as a command-line argument.");

/**
 * A library document's id — the `doc_id` a record carries, e.g.
 * `WPR-RDO-2020-003-eng` or `who-dpi-h-reference-architecture-draft-v1`.
 *
 * Not {@link SlugSchema}: library ids keep the publisher's case and may hold a
 * dot. Constrained so that it cannot be a shell payload: letters, digits, dot,
 * underscore and hyphen, starting with a letter or digit, so neither a
 * metacharacter nor a leading `-` (an option) can parse.
 */
export const DocIdSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "a document id is letters, digits, dot, underscore and hyphen, starting with a letter or digit")
  .describe("A library document id, e.g. WPR-RDO-2020-003-eng");

/**
 * A repository at one pin: `<owner/repo>@<40-hex sha>`, e.g. the checkout a
 * Tool's output was built in, recorded as provenance. The same shape as the
 * right-hand side of `MountSeed`, so no shell metacharacter can parse.
 */
export const PinnedRepoSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9._-]+@[0-9a-f]{40}$/, "a pinned repository is <owner/repo>@<40-hex sha>")
  .describe("A repository at one commit, e.g. <owner>/<repo>@<40-hex sha>");

/**
 * One `mount:remote --seed`: `<name>=<owner/repo>@<40-hex sha>`, the layer to
 * create or re-pin in `index.config.json`. Constrained to that exact shape, so
 * no shell metacharacter can parse.
 */
export const MountSeedSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*=[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9._-]+@[0-9a-f]{40}$/, "a mount seed is <name>=<owner/repo>@<40-hex sha>")
  .describe("A remote instance to seed, e.g. <instance>=<owner>/<repo>@<40-hex sha>");

/**
 * One `mount:remote --choose`: `<harness>` or `<harness>:<instance>`, the mount
 * entry (and closure instance) a review's choice is written to (bean `mo75`).
 * Layer names only, so no shell metacharacter can parse.
 */
export const MountChoiceSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)?$/, "a mount choice is <harness> or <harness>:<instance>")
  .describe("A mount entry and instance to write a choice to, e.g. cat-harness or cat-harness:cat-harness-tools");

/**
 * A comma-separated list of ids — directory ids, nested ids such as
 * `processes/sdlc`, concern names, Tool ids. Letters, digits, dot,
 * underscore, hyphen and slash only, so no shell metacharacter can parse.
 */
export const IdListSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*(?:,[A-Za-z0-9][A-Za-z0-9._/-]*)*$/, "an id list is comma-separated ids of letters, digits, dot, underscore, hyphen and slash")
  .describe("Comma-separated ids, e.g. skills,processes/sdlc or bean-query,agent-memory");

/** A GitHub account name, as `consent.by` records who consented. */
export const LoginSchema = z
  .string()
  .regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/, "a login is letters, digits and hyphens, starting with a letter or digit")
  .describe("A GitHub account name, e.g. litlfred");

/** A folio's short name — the directory stem and the URL segment. */
export const SlugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "a slug is lowercase alphanumerics and hyphens")
  .describe("A folio slug, e.g. quantum-observable-universe");

/** Which content profile a folio follows. `paper` extends `document`. */
export const ContentTypeSchema = z
  .enum(["paper", "document"])
  .describe("A folio's content type. `paper` extends `document` — see AGENTS.md on content types.");

/** How a scaffolded folio reaches the platform. */
export const LinkModeSchema = z
  .enum(["submodule", "sibling", "remote"])
  .describe("How a new folio links the platform: a git submodule, a sibling checkout, or pinned remote mounts in index.config.json.");

/**
 * The id of one ArchiMate model in a layer's `cat-archimate.config.json`,
 * which is the SemVer version it describes (`0.2.0`, `0.2.0-draft.3`). The
 * config's own pattern, less a leading `.` or `-`, so neither a metacharacter
 * nor an option can parse.
 */
export const ArchimateModelIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "an ArchiMate model id is letters, digits, dot, underscore and hyphen")
  .describe("An ArchiMate model's id in cat-archimate.config.json, e.g. 0.2.0");

/** What `archimate-metamodel` prints. */
export const ArchimateMetamodelFormatSchema = z
  .enum(["text", "json", "dot", "mmd"])
  .describe("A plain-text report, archimate-metamodel/v1 JSON, Graphviz DOT, or a Mermaid class diagram.");

/** What a preferences call does. */
export const PreferenceActionSchema = z
  .enum(["get", "set", "reset"])
  .describe("Read, write or clear the stored preferences.");

/**
 * A render target a preference can name.
 *
 * Narrower than `PreviewFormat`, and the two are **not** merged. Preferences
 * choose what to build (`pdf`, `html`); preview opens what was built, which
 * includes a `png` nothing chooses to render as a whole document. One union
 * would make each Tool's contract claim a value it rejects, which is the
 * failure mode a contract exists to prevent.
 */
/**
 * A render-log event — `rendered` | `removed` | `restored` | `retained`.
 *
 * The closed half of `render-log`'s vocabulary. `RENDER_SUBJECT_KINDS` is
 * deliberately open and takes `Slug`; this one is a fixed four, because
 * `EVENTS_REQUIRING_REASON` branches on it and a fifth event would need a
 * decision about whether it owes a reason rather than a schema edit.
 *
 * Injection-safe by construction: a value outside the member list does not
 * parse, and no member contains a shell metacharacter.
 */
/**
 * A git commit SHA — full or abbreviated.
 *
 * Declared rather than borrowing `Slug`, which a 40-hex string does match: a
 * type's `describe` is part of a Tool's published contract, and "A folio slug,
 * e.g. quantum-observable-universe" is the wrong thing for a reader to be told
 * about a commit. Reusing a type because its REGEX happens to admit the value is
 * how a contract ends up asserting something nobody meant.
 *
 * Hex only, so injection-safe by construction. Abbreviated forms are admitted
 * because every caller here passes `$GITHUB_SHA` or a `git rev-parse --short`.
 */
export const CommitShaSchema = z
  .string()
  .regex(/^[0-9a-f]{7,40}$/, "a commit sha is 7-40 lowercase hex digits")
  .describe("A git commit sha, full or abbreviated (7-40 hex digits).");

export const RenderEventSchema = z
  .enum(["rendered", "removed", "restored", "retained"])
  .describe("A render-log event: rendered, removed, restored or retained.");

export const RenderFormatSchema = z.enum(["pdf", "html"]).describe("A render target: pdf or html.");

/** A render a preview can open, including images the render path emits. */
export const PreviewFormatSchema = z
  .enum(["pdf", "html", "png"])
  .describe("A previewable artefact: pdf, html or png.");

/** How much of the folio a render covers. */
export const RenderScopeSchema = z.enum(["full", "chapter", "section"]).describe("How much of the folio to render.");

/** Which TeX engine builds the PDF. */
export const LatexEngineSchema = z.enum(["pdflatex", "lualatex", "xelatex"]).describe("The TeX engine.");

/** Which browser-side math renderer the HTML uses. */
export const MathRendererSchema = z.enum(["katex", "mathjax"]).describe("The browser-side math renderer.");

/** Formal or compact typesetting. */
export const PrintModeSchema = z.enum(["formal", "compact"]).describe("Typesetting density.");

/**
 * How a generated README link addresses its target.
 *
 * `blob` is the default and the only one that works for a private folio — see
 * the README-sections note in AGENTS.md on why `raw` is not the private answer.
 */
export const LinkStyleSchema = z.enum(["blob", "pages", "raw"]).describe("How a README link addresses its target.");

/** One generated README region, named by its marker. */
export const ReadmeSectionSchema = z
  .enum(["folio:toc", "folio:lean-coverage", "folio:lean-modules", "folio:simulators", "folio:workflows", "skills:index"])
  .describe("A generated README section, named by its marker.");

/**
 * One namespace layer, as a command-line word.
 *
 * ## Why this exists rather than `Text`
 *
 * `check:tools` refuses free text on a flag, because an argv word that can hold
 * arbitrary characters can hold a shell payload. It caught `ns-vocabulary`'s
 * `--layer` on exactly that rule. The fix for an enumerable input is the enum,
 * never a looser type that happens to pass.
 *
 * ## Why it is guarded rather than merely copied
 *
 * The members duplicate `TermLayer` in `schemas/content/vocabulary.ts`, and zod needs a
 * literal tuple so the duplication cannot be avoided. What CAN be avoided is the
 * duplication going stale silently, which is the only reason a duplicate is
 * dangerous — `directory-conventions` puts it as: an unavoidable duplicate is
 * fine while an unchecked one is not.
 *
 * `satisfies` catches a member that stops being a layer. `NamespaceLayerCovers`
 * catches the other direction — a layer added to `TermLayer` and not added here
 * fails `tsc`, rather than producing a Tool contract that quietly refuses a
 * value the script accepts.
 */
const NAMESPACE_LAYERS = ["bootstrap", "harness", "core"] as const satisfies readonly TermLayer[];

/** Fails to compile if `TermLayer` gains a member this tuple does not list. */
type NamespaceLayerCovers = Exclude<TermLayer, (typeof NAMESPACE_LAYERS)[number]> extends never
  ? true
  : never;
const _namespaceLayersAreExhaustive: NamespaceLayerCovers = true;
void _namespaceLayersAreExhaustive;

/**
 * A `lake-cache` verb.
 *
 * ## Why an enum and not `Text`
 *
 * Same rule as `NamespaceLayer`: `check:tools` refuses free text on a flag or a
 * positional, because an argv word that can hold arbitrary characters can hold a
 * shell payload. A subcommand is enumerable, so the enum is the fix — and
 * reaching for `Slug` because it happens to be injection-safe would type the
 * input as something it is not.
 *
 * Read from the script's own usage block rather than guessed, which is why
 * `contribute` and `doctor` are here: a list of the four obvious verbs would have
 * refused two real ones and looked complete doing it.
 */
export const LakeCacheActionSchema = z
  .enum([
    "status",
    "restore",
    "restore-toolchain",
    "install-toolchain",
    "verify",
    "seed",
    "contribute",
    "list",
    "doctor",
  ])
  .describe("A lake-cache verb: restore prebuilt oleans, seed them, or diagnose why a restore missed.");

export const IgCacheActionSchema = z
  .enum([
    "status",
    "restore",
    "seed",
    "contribute",
    "verify",
    "list",
    "doctor",
  ])
  .describe("An ig-cache verb: restore AST, seed it, or diagnose.");

/**
 * A change-set verb of a public review: write the records (`seed`, `propose`,
 * `add`, `adopt`), read them (`list`, `body`), check them, bring them back in
 * line with GitHub (`reconcile`), handle one issue event (`github`), or
 * install the workflow templates. Read from the script's own command switch.
 */
export const ChangeSetActionSchema = z
  .enum(["seed", "propose", "add", "list", "body", "adopt", "check", "reconcile", "github", "install"])
  .describe("A change-set verb: check or reconcile the records, or handle one GitHub issue event.");

export const NamespaceLayerSchema = z
  .enum(NAMESPACE_LAYERS)
  .describe("A namespace layer: bootstrap resolves before anything else, then harness, then core.");

/**
 * What a wireframe is drawn for: `design` (a new or changed surface, at least
 * two candidates compared blind) or `as-is` (an existing visualiser, drawn as it
 * renders on main). The members are the `use` enum of the
 * `wireframe-design-review` input contract; an enum, so it is a command-line
 * word that cannot carry a payload.
 */
export const WireframeUseSchema = z
  .enum(["design", "as-is"])
  .describe("Why a wireframe is drawn: `design` for a new or changed surface, `as-is` for an existing visualiser.");

/**
 * A rendered surface, as a command-line word.
 *
 * ## Why this exists rather than `Text`
 *
 * The `wireframe-design-review` contract types `surface` as a bare string ("a
 * page, a visualiser ref, the navbar, a form, an app screen"), and `check:tools`
 * refuses free text on a flag. What the harness actually names a surface by is
 * a visualiser's route key, `<harness>/<visualiser>` with an optional sub-graph
 * (`cat-harness/auto-docs/index/skills`, the keys of
 * `docs/wireframes/index.json`), or a kebab-case name for chrome no visualiser
 * declares (`navbar`, `kg-viewer`). This is that shape and nothing wider: no
 * space, no dot, no `..`, so it is injection-safe by construction. Not
 * `RepoPath`, which happens to admit the same words and would type a route as a
 * file.
 */
export const SurfaceRefSchema = z
  .string()
  .min(1)
  .regex(
    /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/,
    "a surface is a route key (`<harness>/<visualiser>[/<sub-graph>]`) or a kebab-case name",
  )
  .describe("A rendered surface: a visualiser route key such as cat-harness/beans, or a kebab-case name such as navbar.");

/** The granularity a translation sign-off covers. */
export const TranslationLevelSchema = z
  .enum(["block", "section", "chapter", "folio"])
  .describe("What a translation sign-off covers.");

/**
 * A plain non-negative count — how many of something, or how many to show.
 *
 * ## Why this exists, and why it did not until 2026-09-20
 *
 * This vocabulary had **no general numeric type**. `Dpi` and `Port` are both
 * numbers and both mean something specific, so neither can stand in for "a
 * number of things", and the honest move at each call site was to leave the
 * input undeclared and say so in a comment. Two nodes did exactly that:
 * `content-graph-build`, whose edge counts became one `Text` report, and
 * `fsh-cone`, whose `--top N` and `--history N` are still not declared.
 *
 * **Two independent needs is the bar.** The rule this repository keeps is that
 * adding a type to fit ONE flag is how a vocabulary stops meaning anything —
 * and that rule was applied, twice, by refusing to invent `Count` for a single
 * node. It is a different judgement once the same gap has been met from two
 * directions by two different mechanisms.
 *
 * ## The bounds, and what each is for
 *
 * `min(0)` because a count of zero is a real answer and the commonest one worth
 * reporting: zero findings, zero blocks, zero edges. Excluding it would push
 * every such case into a sentinel or an absent field, which is the third-state
 * confusion this vocabulary exists to prevent.
 *
 * `int()` and a finite `max` because that is what makes it **injection-safe by
 * construction**, the same argument `Dpi` and `Port` carry: a value bearing a
 * shell metacharacter does not parse, so it can reach argv. An unbounded number
 * would admit `Infinity` and `1e21`, which stringify into argv as words no
 * consumer expects. The ceiling is deliberately far above any real corpus —
 * it bounds the TYPE, not the domain, and a node needing a tighter limit says so
 * in its port description rather than by minting a narrower type.
 *
 * NOT for a limit that must be positive. `--top 0` is a legitimate request for
 * nothing, and a type that forbade it would be asserting a policy that belongs
 * to the flag.
 */
export const CountSchema = z
  .number()
  .int()
  .min(0)
  .max(1_000_000_000)
  .describe("A non-negative count — how many of something, or how many to show. Zero is a real answer.");

/** Resolution for rendered formulae. */
export const DpiSchema = z.number().int().min(24).max(1200).describe("Dots per inch for rendered formulae.");

/**
 * A TCP port for a locally bound server.
 *
 * **0 is admitted deliberately** — it asks the OS for a free port, which is
 * what `scripts/tests/serve-rendering.test.ts` binds so that a test run does
 * not collide with a developer's own server or with a sibling test. Excluding
 * it would have forced the tests onto a fixed port, which is the flake.
 *
 * Bounded and integral, so it is injection-safe by construction like `Dpi`:
 * a value carrying a shell metacharacter does not parse.
 */
export const PortSchema = z
  .number()
  .int()
  .min(0)
  .max(65535)
  .describe("TCP port for a locally bound server; 0 asks the OS for a free one.");

/**
 * The facts a DMN decision table is evaluated against.
 *
 * **Not injection-safe**, and one of the two structured types in the vocabulary
 * (the other is {@link ProvActivitySchema}).
 * Values are scalars rather than `unknown` because a decision table compares
 * them — a nested object is not something FEEL can test, so admitting one would
 * let a caller build a fact that no table can ever match.
 *
 * It is refused as a command-line word for the ordinary reason: keys and values
 * come from a caller. `workflow_complete` is invoked in-process, so the
 * question does not arise there — but a future shell projection must not be the
 * moment the constraint is discovered.
 */
export const DecisionFactsSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  .describe("Facts for a DMN decision table. Scalar values only. Not admissible as a command-line argument.");

/**
 * One PROV-O activity, as a Tool returns it and `workflow_complete` keeps it.
 *
 * `skill_update` returns one for an accepted write that named its step, and
 * `workflow_complete` takes them back as `activities` and keeps them on the
 * step's history entry (cat-harness-tools#887, bean `cat-tools-ycn6`). Until
 * this type existed the Tool nodes could not declare either port, so the
 * served surface and the declared one disagreed (bean `w1gy`, finding 2).
 *
 * The schema is `schemas/content/prov.ts`'s, not a copy: two definitions of
 * one record are free to drift, and the one the engine checks against is the
 * one that counts. `workflow_complete` also requires that each activity's
 * `prov:qualifiedAssociation.prov:hadPlan` end in `#<node>`; that is a fact
 * about the call, not the value, so it is checked there, not here.
 *
 * **Not injection-safe**, for the reason {@link DecisionFactsSchema} is not: it
 * is a structured value whose strings come from a caller. It is passed
 * in-process, never as a command-line word.
 */
export const ProvActivitySchema = ProvActivityRecordSchema.describe(
  "A PROV-O activity (schemas/content/prov.ts). Structured. Not admissible as a command-line argument.",
);

/** Everything published in the shared types document, keyed by `$defs` name. */
export const TOOL_TYPES = {
  BeanId: BeanIdSchema,
  SkillName: SkillNameSchema,
  PackageName: PackageNameSchema,
  ProcessId: ProcessIdSchema,
  NodeId: NodeIdSchema,
  InstanceId: InstanceIdSchema,
  Locale: LocaleSchema,
  Timestamp: TimestampSchema,
  TimeWindow: TimeWindowSchema,
  Flag: FlagSchema,
  BeanStatus: BeanStatusSchema,
  RepoPath: RepoPathSchema,
  DelimitedTextPath: DelimitedTextPathSchema,
  WorkbookPath: WorkbookPathSchema,
  Url: UrlSchema,
  Branch: BranchSchema,
  ScriptName: ScriptNameSchema,
  RepoFullName: RepoFullNameSchema,
  ChangeProposalNumber: ChangeProposalNumberSchema,
  ReviewThreadId: ReviewThreadIdSchema,
  GitLabUsername: GitLabUsernameSchema,
  Markdown: MarkdownSchema,
  Text: TextSchema,
  FilesystemPath: FilesystemPathSchema,
  Slug: SlugSchema,
  DocId: DocIdSchema,
  MountSeed: MountSeedSchema,
  MountChoice: MountChoiceSchema,
  IdList: IdListSchema,
  PinnedRepo: PinnedRepoSchema,
  Login: LoginSchema,
  ContentType: ContentTypeSchema,
  LinkMode: LinkModeSchema,
  LakeCacheAction: LakeCacheActionSchema,
  IgCacheAction: IgCacheActionSchema,
  ChangeSetAction: ChangeSetActionSchema,
  NamespaceLayer: NamespaceLayerSchema,
  PreferenceAction: PreferenceActionSchema,
  ArchimateModelId: ArchimateModelIdSchema,
  ArchimateMetamodelFormat: ArchimateMetamodelFormatSchema,
  CommitSha: CommitShaSchema,
  RenderEvent: RenderEventSchema,
  RenderFormat: RenderFormatSchema,
  PreviewFormat: PreviewFormatSchema,
  RenderScope: RenderScopeSchema,
  LatexEngine: LatexEngineSchema,
  MathRenderer: MathRendererSchema,
  PrintMode: PrintModeSchema,
  LinkStyle: LinkStyleSchema,
  ReadmeSection: ReadmeSectionSchema,
  TranslationLevel: TranslationLevelSchema,
  WireframeUse: WireframeUseSchema,
  SurfaceRef: SurfaceRefSchema,
  Count: CountSchema,
  Dpi: DpiSchema,
  Port: PortSchema,
  DecisionFacts: DecisionFactsSchema,
  ProvActivity: ProvActivitySchema,
  // The data store tools' typed results (owner, 2026-11-01, Q-DS-10 A).
  BeanClaimCheck: BeanClaimCheckSchema,
  DrainQueue: DrainQueueSchema,
  OpenWorkLookup: OpenWorkLookupSchema,
  SessionSweep: SessionSweepSchema,
  BeanQueryRows: BeanQueryRowsSchema,
  HarnessStates: HarnessStatesSchema,
  WorkflowListing: WorkflowListingSchema,
  WorkflowStarted: WorkflowStartedSchema,
  WorkflowPosition: WorkflowPositionSchema,
  WorkflowGateAnswer: WorkflowGateAnswerSchema,
  WorkflowCompletion: WorkflowCompletionSchema,
  GatesReport: GatesReportTypeSchema,
  MergedGatesReport: MergedGatesReportTypeSchema,
} as const;

export type ToolTypeName = keyof typeof TOOL_TYPES;

/**
 * The IRI of one shared type, against a publication base.
 *
 * One function, so a Tool node never hand-writes an IRI. A hand-written one is
 * a string that looks like a reference and is checked by nothing — and the
 * owner's standing rule is that a consumer must never have to assume a rule to
 * follow a link, which applies to the author of the link first.
 *
 * **It still hand-wrote half of one, and that is the lesson.** The fragment was
 * computed here while the document's own path — `kg/tool-types.schema.json` —
 * was a literal, duplicating `harness-schema-export.ts`'s `$id` for the very
 * same file. Two functions minting URLs for one document is the same defect as
 * none, one level up. When the renderings moved from `kg/` to the base this was
 * the SIXTH site, and the only one not reached by searching the two exporters:
 * 95 `schema` refs across the published graph would have pointed at a URL that
 * 404s while the document they name sat one directory away.
 * {@link renderingPath} is now the single answer to "where is it published".
 *
 * Bean `tdir` adds a whole document per type,
 * `<base>/tool-types/<Name>.schema.json` ({@link toolTypeDocumentIri}); ports
 * move to it in a second step — see there.
 */
export function toolTypeIri(base: string, name: ToolTypeName): string {
  return `${renderingPath(base, "tool-types.schema.json")}#/$defs/${name}`;
}

/**
 * The per-type document's IRI, `<base>/tool-types/<Name>.schema.json`: the
 * `$id` each published per-type schema carries (bean `tdir`).
 *
 * **Two phases, so no layer is ever broken by another's main.** A port's
 * `schema` still uses {@link toolTypeIri}'s fragment form, because the tools
 * layer's main reads that form; this PR adds the per-type documents and
 * {@link toolTypeNameOf}, which reads both. Once the tools layer reads ports
 * through `toolTypeNameOf`, `toolTypeIri` returns this IRI and the fragment
 * form retires.
 */
export function toolTypeDocumentIri(base: string, name: ToolTypeName): string {
  return renderingPath(base, toolTypePath(name));
}

/**
 * The directory, at the harness's publication base, holding one JSON Schema
 * per shared type.
 *
 * Bean `tdir`. The owner, 2026-10-15: *"input ouput schemas should be their
 * own files/json schema when published w/ IRIs so can be referernced easy."*
 * A port's `schema` was `<base>/tool-types.schema.json#/$defs/<Name>`: a
 * pointer INTO one document, which a consumer had to fetch whole and then
 * walk, and which a draft-07 reader (the draft that document declares) does
 * not resolve at all, since `$defs` is a 2019-09 keyword (see
 * `staging.test.ts` for the same trap in the skill contracts). Now each type
 * is its own document, `<base>/tool-types/<Name>.schema.json`, whose `$id`
 * is that IRI. `harness-schema-export.ts` writes them on publish, beside the
 * combined `tool-types.schema.json` it keeps for existing readers; neither
 * is committed.
 */
export const TOOL_TYPES_DIR = "tool-types";

/** One type's published path under the base: `tool-types/<Name>.schema.json`. */
export function toolTypePath(name: ToolTypeName): string {
  return `${TOOL_TYPES_DIR}/${name}.schema.json`;
}

/**
 * The type a port's `schema` IRI names, or `undefined` when it names none of
 * {@link TOOL_TYPES}.
 *
 * The inverse of {@link toolTypeIri}, so a reader never splits the IRI on a
 * literal of its own: four did, on `#/$defs/`, and each would have read every
 * port as untyped the day the form changed. Whatever the base, only the
 * `tool-types/<Name>.schema.json` tail is read.
 */
export function toolTypeNameOf(iri: string): ToolTypeName | undefined {
  // Both forms, during the two-phase move (see toolTypeDocumentIri): the
  // fragment `tool-types.schema.json#/$defs/<Name>` and the per-type document.
  const m =
    new RegExp(`(?:^|/)${TOOL_TYPES_DIR}/([A-Za-z][A-Za-z0-9]*)\\.schema\\.json$`).exec(iri) ??
    /tool-types\.schema\.json#\/\$defs\/([A-Za-z][A-Za-z0-9]*)$/.exec(iri);
  return m !== null && Object.prototype.hasOwnProperty.call(TOOL_TYPES, m[1]) ? (m[1] as ToolTypeName) : undefined;
}


/**
 * Types whose *values cannot be a shell payload*, because the type refuses to
 * construct one.
 *
 * ## Why this is the defence, and argv arrays are only the second line
 *
 * The usual answer to command injection is "pass an argv array, never build a
 * shell string". That is necessary and this repo does it — but it is a property
 * of the *caller*, and a caller is one refactor away from a template literal.
 *
 * The property that survives a careless caller is the **value never being
 * dangerous in the first place**. `BeanStatus` is an enum: `"; rm -rf /"` is not
 * a member and `parse` rejects it. `BeanId` is `^[a-z0-9-]+$`: no space, no
 * semicolon, no `$(`, no backtick. A constrained type makes the payload
 * unrepresentable rather than merely unexecuted.
 *
 * So a Tool input **may not reference an unconstrained type**. That is checked,
 * not documented — see `scripts/check-tools.ts`.
 *
 * ## Markdown is excluded, on purpose
 *
 * Prose genuinely can contain any character, so no pattern admits real markdown
 * and excludes a payload. Rather than pretend, `Markdown` is simply not
 * admissible as an *argument*. A Tool that needs free text takes it on **stdin**
 * or from a file, where it is data rather than part of a command line. That is a
 * real constraint on Tool design and it is the right one: a tool whose prose
 * argument is a command-line word was always going to need quoting nobody
 * checks.
 */
export const INJECTION_SAFE: ReadonlySet<ToolTypeName> = new Set<ToolTypeName>([
  "BeanId",
  "SkillName",
  "PackageName",
  "ProcessId",
  "NodeId",
  "InstanceId",
  "Locale",
  "Timestamp",
  // A count with a unit or an ISO date; nothing else parses. See the schema.
  "TimeWindow",
  // Not a string at all, so it cannot carry a payload.
  "Flag",
  "BeanStatus",
  "RepoPath",
  // The same shape as `RepoPath` (see each schema); only the name differs.
  "DelimitedTextPath",
  "WorkbookPath",
  "Url",
  "Branch",
  "ScriptName",
  "RepoFullName",
  "ChangeProposalNumber",
  "ReviewThreadId",
  "GitLabUsername",
  "Slug",
  "DocId",
  "MountSeed",
  "MountChoice",
  "IdList",
  "PinnedRepo",
  "Login",
  // Every enum below is injection-safe by construction: a value outside the
  // member list does not parse, and no member contains a shell metacharacter.
  // This is the cheapest form of the whole argument — the payload is not
  // rejected, it is unrepresentable.
  "ContentType",
  "LinkMode",
  "LakeCacheAction",
  "IgCacheAction",
  "ChangeSetAction",
  "NamespaceLayer",
  "PreferenceAction",
  "ArchimateMetamodelFormat",
  // A pattern type: no leading `.` or `-`, no metacharacter. See the schema.
  "ArchimateModelId",
  "CommitSha",
  "RenderEvent",
  "RenderFormat",
  "PreviewFormat",
  "RenderScope",
  "LatexEngine",
  "MathRenderer",
  "PrintMode",
  "LinkStyle",
  "ReadmeSection",
  "TranslationLevel",
  "WireframeUse",
  // A pattern type: kebab-case segments joined by `/`. See the schema.
  "SurfaceRef",
  "Count",
  "Dpi",
  "Port",
  // Deliberately absent: `Text`, `FilesystemPath`, `DecisionFacts`,
  // `ProvActivity`. Each is documented above with the reason it cannot be a
  // command-line word.
]);

/** Is this type admissible as a command-line argument? */
export function isInjectionSafe(name: string): boolean {
  return INJECTION_SAFE.has(name as ToolTypeName);
}
