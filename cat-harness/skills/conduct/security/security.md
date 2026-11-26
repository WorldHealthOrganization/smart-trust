---
name: security
description: >
  The security sub-KG's entry point. What the boundaries are, which machinery
  already guards each one, and the single rule that unifies them — refuse,
  never repair. Read this before adding a check, so the answer that already
  exists is reused rather than rebuilt in a fourth place.
consulted: true
---

# Security — one question, asked at every boundary

> **This value came from outside. What may I do with it?**

Everything in this package is that question at a different boundary. The split
is **not** by attack name: the same untrusted string is command injection at a
shell, path traversal at a `join`, and XSS at a template, and filing the rule
under each name is how a correct guard ends up in one file while other call
sites hand-roll it.

## The rule that unifies them: refuse, never repair

**A check returns a refusal, not a cleaned-up value.** A repair silently
changes which artefact is named: a slug pipeline that replaces disallowed
characters can turn a branch of `---` into the empty string, so
`rm -rf "pages/branches/$SLUG"` names every preview. A refusal makes the caller
decide, and only the caller knows whether that is a 400, an `exit 1`, or a skip.

**And check by VALUE, never by provenance.** Re-run a guard after the value
crosses a job boundary (`feature-staging.yml` does): "where it came from" is not
a property you can read off a variable.

## The boundaries, and what guards each one today

| boundary | the hazard | machinery | state |
|---|---|---|---|
| `${{ }}` → a `run:` or `script:` block | the value is substituted into the script TEXT before bash or V8 parses it, so a quote is enough — and inside a JS template literal `${…}` is EVALUATED, so it need not even close one. A step OUTPUT carries whatever the step put in it, so the gate resolves provenance rather than trusting the band | `scripts/check-workflow-injection.ts` + baseline + 2 test files | **gated**; two surfaces with two remedies, `with:`/`env:`/`if:` still ungraded |
| an external id → a path | `join(base, external)` escapes the store; `mkdirSync` + `writeFileSync` make it a write primitive | [`path-containment`](path-containment.md), `src/core/safe-path.ts` | **guarded; narrowly gated** — `server-path-sinks.test.ts`, a source ratchet |
| a shell string → a process | `execSync("cmd " + value)` gives the shell a program | [`injection-boundaries`](injection-boundaries.md) | partly (`execFileSync` at the fixed sites) |
| an archive → a filesystem | a LINK member writes through to its target, which `..`-refusal does not cover | member-TYPE whitelist (`tar tvzf`, accept only `-` and `d`) at the one call site, `tar-member-guard.test.ts` against real archives | **closed at one site** |
| a `.po` catalogue → a render | translated content is authored elsewhere | `scripts/translation/translation_security.py` | exists, unaudited here |
| a hand-over → a model | a sub-agent report, delegated prompt, tool result or third-party comment carries an instruction the receiver follows because it trusts the sender (protocol pivoting) | `bun run cat handover:screen` (`src/core/handover-screen.ts`): field by field over a declared schema; control fields and undeclared fields refused, data fields quarantined; `fenceUntrusted` labels the origin | **guarded and wired**: every in-code site where foreign text reaches a model calls `guardUntrusted` or `screenHandover`; the sites and the deliberate gaps are in [`zero-trust-handover`](zero-trust-handover.md) §"Where the screen is wired" |
| a remote graph → this layer | a mounted harness's skills steer agents and its code runs, so an untrusted pin is a supply-chain compromise | `bun run cat mount:remote` (Tool `remote-mount`) refuses a mount that is neither consented for its exact pin nor signed in a declared trust network (`schemas/kg/mount-trust.ts`); a signature with no verifier is could-not-determine; `--staging` needs neither | **gated at the mount**; signature verification (e.g. GDHCN) **not built** |
| content → HTML | XSS in a rendered surface | declared XSS hints on tools and skills | **open** |
| a third-party action → a runner | a moved tag or rewritten branch runs new code with the job's token and secrets | `bun run cat actions:pin` (`pin-actions.ts`) pins to a full commit SHA; `security:gate` **blocks** on any unpinned action except in a staging-only workflow that holds no write token and has no `pull_request_target` trigger (`stagingExempt`) | **gated**: the counts are what `bun run cat security:gate` reports now |

## Where to look when adding a check

1. **Is the boundary in the table?** Then the machinery exists — extend it.
   Adding a second guard for a guarded boundary is how they drift apart.
2. **Is there already a helper?** `src/core/safe-path.ts` is the path one. A
   correct helper in one file does not protect call sites that hand-roll the
   check.
3. **Can a gate hold the property?** A hand-maintained invariant drifts, and the
   symptom of forgetting is invisible. A guard without a gate is a guard with an
   expiry date.

## What this package does NOT own

**Shell `rm -rf` is not where the open surface is.** The staging deletion
sites are guarded by value; the surface that needed this package is the
TypeScript I/O layer.

**Deletion policy is not security.** Whether an agent may remove a durable
artefact at all is
[`deletion-requires-confirmation`](../conduct-core/deletion-requires-confirmation.md),
and it governs cases where the path is perfectly safe and the deletion is still
wrong.
