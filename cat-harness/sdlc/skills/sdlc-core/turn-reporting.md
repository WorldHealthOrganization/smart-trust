---
name: turn-reporting
description: >
  Say which work item you are on, every turn — the opening and closing report
  formats, the rules that make a report worth reading (two sentences and a link
  per work item, every mention), and the STRICT rule that the "next" line is a
  question and must carry its own context.
allowed-tools: Read Grep Glob AskUserQuestion
consulted: true
---

# Turn reporting — say which bean you are on, every turn

This skill governs what you say **during and after** the work;
[`opening-brief.md`](../../../skills/conduct/conduct-core/opening-brief.md) governs what you say before starting
it; `todo-manager.md` (opt-in `cat-harness.work-plan`)
keeps the work item mechanics.

## Say which bean you are on — every turn

Claiming a work item records the work; **reporting** it is what lets a human steer
and a sibling session avoid you. Both are required.

### Opening a turn

**When you begin work on a work item**, open that turn by naming it and what you are
attempting — before the first tool call, not after the work lands:

> **Starting `fwr7`** — retargeting the seven edges the forward-ref arc left
> alone, because the edge is wrong rather than the block's position.

### Closing a turn

**End every turn** with the work items you touched and what is next.

> **Work items**
> - **worked** `fwr8` — Re-baseline the forward-ref arc endpoints. Re-ran both with the fixed parser: the arc is 274 → 195, not 274 → 192. This corrects my own earlier claim that the start figure was understated — only the post-mid-arc figures are short, and only by 3.
> - **next** `fwr7` — Retarget seven `uses[]` edges that point at the wrong block. Two of the seven are now confirmed detangler findings rather than reader reports, which raises their priority above the remaining five.

### Before you send the report — one pass for named decisions (STRICT)

Knowing the §"next" rule below does not stop a closing report from handing
over a teaser — "two decisions still yours: `35nj` (three options) and `wlqd`
(pinned-commit vs `ref: main`)" names choices whose options and costs live
elsewhere. **So do a write-time pass.** Before sending a closing report, scan your own text for anything that hands over a choice — a work item id, an
option name, a "your call", a "needing X vs Y" — and for each one:

- **carries its options with their costs, a recommendation and a default** → send it;
- **does not** → delete the name and put a count in its place
  ([`interaction-modality.md` §4.1](../../../skills/conduct/conduct-core/interaction-modality.md) §"More than one
  decision pending");
- **you are unsure whether it reads as a question** → treat it as one. The
  framing sentence does not decide this; the reader's next keystroke does.

The test is unchanged and takes one pass: **can they answer without opening
anything?** Apply it to the report you just wrote, not to the question you
planned to ask.

### The rules that make a report worth reading

**1. Every work item reference carries TWO sentences and a link — what it is, then
what you would do.**
`fa/nvbr` is an opaque four-character string. A reader cannot tell whether it
is urgent, adjacent, or already obsolete without opening the store — and asking
someone to go look things up is the cost this report exists to remove. Link to
the work item file so one click gets the full body.

A gloss says what the work item IS; the second sentence says what you would DO, which
is what somebody deciding whether to let you do it needs. **Titles alone are a
menu with no prices** — a reader can see that `rlp5` is two scripts disagreeing
about a flag and still not know whether your answer is a one-line fix or a
question back to them.

> ✗ **next** [`rlp5`](…) — `pdf-ocr` and `pdf-structure` disagree about what `-o` means.
>
> ✓ **next** [`rlp5`](…) — they disagree about what `-o` means, so a command that works with one silently writes elsewhere with the other. I would measure which spelling each script's callers assume, make the minority match, and keep an alias only if an outside caller needs it.

First person and a proposal — *"I would …"* — because rule 5 already says expect
to be overruled; the passive hides whose call it is. Applies to **worked** too
(what you did, and whether it is finished) and to anything you are declining, or
a reader assumes it is queued. Two sentences settle a work item somebody can say yes
to; when **next** hands over a real decision between costed routes, §"The `next`
line is a question" below is the binding form.

**EVERY MENTION, not every report.** A work item id in an ordinary sentence is
exactly as opaque as one in a list, and a reader hunting for its meaning cannot
see which section of your message it came from. So the rule binds a one-line status, a
mid-paragraph aside, a commit message, a PR body, an issue comment — anywhere
the id appears at all. If naming the work item is not worth two sentences, do not
name it: say "nothing outstanding" or describe the work without the id.

**2. Asking for review means linking the artefact — deep, not the root, and naming the host.** If a
turn ends with "please look at this", it must carry the **PR link** and a
**direct link to every page that changed**, not the staging root. It must also
**explicitly state which host rendered it**, drawn from declared architecture /
`deployment-awareness` (opt-in `cat-harness.platform-ui`) (e.g. `GitHub Pages`,
`local server`, `chat discussion only`, or `could not determine`).

> ✗ `https://…/branches/claude-my-branch/` *(root only, host unstated)*
>
> ✗ `https://owner.github.io/repo/branches/claude-my-branch/page.html` *(assumed github.io on private repo)*
>
> ✓ **Staging (GitHub Pages):**
> - [Swarm management](https://…/branches/claude-my-branch/swarm-management.html) — new page
> - [process-state](https://…/branches/claude-my-branch/reference/skill-instructions/process-state.html) — new skill
> - [Architecture](https://…/branches/claude-my-branch/architecture.html) — nav entry added
>
> ✓ **Staging (local server at http://127.0.0.1:4007):**
> - [Swarm management](http://127.0.0.1:4007/<repo>/branches/claude-my-branch/swarm-management.html) — new page
>
> ✓ **Review (chat discussion only — no web surface):**
> - `docs/concepts/architecture/swarm-management.md` — new page (outline provided in chat)
>
> ✓ **Review (could not determine staging host):**
> - `docs/concepts/architecture/swarm-management.md` — repo-relative path for review

Handing over the root makes the reader navigate a site to find what you
changed. You already know which pages those are — you wrote them — so the
lookup is yours to do, not theirs. Say what each link *is*, too: a bare URL
does not tell a reader whether it is new, changed, or just context.

**Never assume `github.io` or compose a URL from a git remote.** On a private
repository there is no public Pages; on a local-git-only topology there is no
forge at all. In both cases an agent that guesses hands over a URL that
**does not resolve**. The staging host is an architectural fact, not an
inference from a remote name.

A human cannot assess a rendered artefact from a description, and
withholding it makes assessment harder rather than safer
([`continual-progress`](../../../skills/conduct/conduct-core/continual-progress.md)). **A root-only link is a
partial withholding** — the artefact is technically reachable and practically
hidden.

**Where to get the links.** Look to the declared topology and configuration
(`deployment-awareness`), never a
guess:
1. **GitHub Pages (static host):** When Pages is configured (e.g. `pagesBaseUrl`
   is declared in the layer's `index.config.json` entry), the staging workflow deploys to
   `…/branches/<branch-slug>/`, and Jekyll rewrites `baseurl` so paths mirror
   `docs/`. A page at `docs/concepts/architecture/foo.md` is at
   `…/branches/<slug>/architecture/foo.html`; a skill at
   `skills/<pkg>/bar.md` is at
   `…/branches/<slug>/reference/skill-instructions/bar.html`. Those paths say where a page *would* land; the links themselves come from the
   preview's page list, each looked up in the publish ref, as
   [`feedback-deep-links`](../../../skills/authoring/content-lifecycle/feedback-deep-links.md) requires, never built
   from a source path.
2. **Local server (dynamic host):** When running a local preview (e.g. Bun
   `serve:rendering`), report the local loopback host and port.
3. **Chat discussion only:** When no web server or UI canvas is active,
   degrade gracefully to chat: list the modified file paths and provide an
   outline or structured summary in chat.
4. **The third state ("could not determine"):** If the host or staging URL
   cannot be determined from declared configuration, explicitly state
   **"could not determine"** and provide the repo-relative file paths (or
   commit permalinks under Rule 8) for review instead of guessing a broken URL.

**3. Say what to review, not just that it is green.** "Green on all three
workflows" says the PR is not broken. It does not say what the change **does**,
what to **look at**, or what **judgement** is wanted. A reader should be able to
act on the report without opening the diff, and then open the diff knowing what
they are looking for.

**4. Length follows content.** There is no word budget, because a cap reads
as a budget to spend rather than a floor to clear, and rewards terseness. A one-line fix gets a
line; a design change that needs a decision gets a paragraph. Err long — the
cost of a sentence the reader skims is far below the cost of a round-trip
asking what you meant, especially for an author who types with difficulty.

**5. "Next" is your judgement, not a fact.** Work items carry no priority order
beyond what an agent asserts — so say *why* it is next, and expect to be
overruled.

**6. Prefix across repos** (`qou/fwr7`, `fa/fsl7`) when a turn spans both.

**7. Report unclaimed work as unclaimed.** If you did durable work without a
work item, say so and open one; that omission is the failure this exists to catch.

**8. A link to a file is an absolute GitHub permalink** —
`https://github.com/<owner>/<repo>/blob/<sha>/<path>`, pinned to a commit sha,
never a repo-relative path and never a branch. A repo-relative path is not
clickable when the reader's working directory is not that repository, and a
branch link shows whatever was pushed since the reader was asked to look. The
rule and its reasons live with the plan-request operation, in the content layer:
the `plan-request-gate` skill (`skill_fetch plan-request-gate`)
§"Hand over both as permalinks".

### A failing report, for contrast

> **worked** `fa/fsch` — Green on all three workflows. Also corrected the PR
> body, which had drifted from the code after your detangle instruction.
> **next** `fa/nvbr`, `fa/rnfl` — both gated on #251.

It breaks the first three rules at once: bare ids with no gloss or link, a
request for review with no staging link, and "green" in place of what the
change does and what judgement is wanted.

### The "next" line is a question, so it carries its context (STRICT)

Rules 1 and 5 above say the next item needs a gloss and a reason. This is the
stronger form for the case where **next** also hands over a *decision*:
[`interaction-modality.md` §4.1](../../../skills/conduct/conduct-core/interaction-modality.md)
governs it — context → options → recommendation → question — and the test is
whether the author can answer **without opening anything**.

A work item id plus a term you coined is the specific failure:

> **next** `x4mt` — Cross-agent skill install + `fa-` prefix (#247). Unstarted,
> and I'd want your call on prefix-at-rest vs prefix-at-install before writing
> anything.

`x4mt` is opaque, `fa-` is undefined, and "prefix-at-rest vs prefix-at-install"
names two options that exist only inside issue #247 — so the author had to open
it to find out what was being asked. It could have read:

> **next** `x4mt` — Install this platform's skills into whichever agent is
> running, each name prefixed `fa-` so it cannot collide with the host's own
> commands. One call needed: add the prefix **when a skill is installed**
> (nothing in this repo moves — recommended), or **rename the files here**,
> which also drags the manifests, the BPMN skill refs and two generators.

Barely longer, and answerable in one character.

**A deferred decision is stated in full, or not stated at all.** If it genuinely
will not fit, say the decision exists and that you will put it properly when you
reach it — never post a teaser whose only resolution is a document.
