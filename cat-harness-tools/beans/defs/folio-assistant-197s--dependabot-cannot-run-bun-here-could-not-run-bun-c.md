---
# folio-assistant-197s
$schema: bean/1.0.0
title: 'Dependabot cannot run Bun here: ''could not run Bun … configuration error'' on #908, and the npm ecosystem never touches bun.lock'
status: completed
type: bug
priority: normal
created_at: 2026-09-26T16:58:15Z
updated_at: 2026-10-24T09:08:00Z
parent: folio-assistant-1xhc
---

Measured 2026-09-26.

## What happened

- At 15:26Z dependabot commented on #908: *"Dependabot could not run Bun to update your dependencies due to a configuration error."* That came about 13 minutes after #1407 put the same bumps on main.
- **This is not evidence of a defect in our config.** The same message appeared on 25–26 Sep across many unrelated repos with different setups. Examples: [bun-chat#19](https://github.com/johannesjahn/bun-chat/pull/19) on Sep 25, and [lazyit#1303](https://github.com/joacominatel/lazyit/pull/1303), [firetg#7](https://github.com/Mergemat/firetg/pull/7) and [hermes#31](https://github.com/mdhishaamakhtar/hermes/pull/31). None has a stated cause.
- **The known lockfile causes do not apply.** Other repos fail on `lockfileVersion: 2`, which bun 1.4 writes (e.g. [lsimons/ai-training#512](https://github.com/lsimons/ai-training/issues/512)). Ours is `lockfileVersion: 1`, `configVersion: 1`, bun 1.3.11. [dependabot-core#13623](https://github.com/dependabot/dependabot-core/issues/13623), which strips `configVersion`, is closed.
- `bunfig.toml` only sets a test preload.

## The gap that IS ours

`.github/dependabot.yml` declares `package-ecosystem: npm` for the five bun-installed directories. That is why #908 changed `package.json` and never `bun.lock`, so under `--frozen-lockfile` its PRs could never go green. The file's own comment predicted this. Dependabot has a dedicated `bun` ecosystem. Whether switching fixes the lockfile half cannot be verified until a weekly run, and the Sep 2026 failures affect the bun ecosystem too.

## Done when

- [ ] one weekly dependabot run after the upstream failure clears, observed: does it open PRs, and do they touch bun.lock?
- [ ] if not: try `package-ecosystem: bun` in one PR, verified by the next weekly run, not asserted
- [x] the header comment in `.github/dependabot.yml` updated with the answer

## Note (2026-10-10, drain ml9h)

Lane B scrapped the cat-harness-tools copy: the subject is folio-assistant's own dependabot.yml, so THIS copy is the owning one and stays open.

## 2026-10-20 — the config named directories this repository no longer holds (drain coordinator, session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6)

Since the separation the index tracks one `package.json` (the root's, zero dependencies, workspaces = mounts). Four npm directories and the pip `/cat-harness-tools/python` named mounts, so Dependabot scanned nothing there. litlfred/folio-assistant#2609 keeps only `/.github/scripts` pip and Actions; litlfred/cat-harness-tools#469 gives tools its own pip `/python` + Actions. npm/bun for instances is deferred until `@litlfred/*` resolve from a reachable registry. Box 1 (observe a weekly run) still open.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): the subject is not in this repository. The bean is about folio-assistant's `.github/dependabot.yml` (its npm-vs-bun ecosystem choice), and every remaining done-when is an observation of that repository's weekly Dependabot run. cat-harness-tools has no `dependabot.yml`. The copy of this bean in the folio-assistant store (`cat/cat-harness/beans`) is the live one; it should stay open there and not be closed as a mirror.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: todo, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: the scrap in the ch/cht copies was store placement only ("the subject is not in this repository"); no done-when was met, and the folio-assistant copy records that it is the owning one and stays open. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

## Closed 2026-10-24 — the subject left this repository (https://claude.ai/code/session_01WJw1NBGSTLWvBnyQzJHXjx)

Measured on folio-assistant `main` a540e5e:
- `.github/dependabot.yml` declares only `pip` (`/.github/scripts`) and `github-actions`. There is no `npm` or `bun` entry, since litlfred/folio-assistant#2609.
- The root `package.json` has no `dependencies` or `devDependencies`. Its `workspaces` name mounts, not committed directories.
- The file's header now carries the answer (box 3): "The bun question … is answered in a repository whose `package.json` has dependencies, not in one whose root has none."

Boxes 1 and 2 observe a weekly Dependabot run on bun manifests, and this repository has none left to run on, so they cannot be met here. They are not ticked. **The bun question itself is unowned.** None of the instance repositories declares an npm or bun Dependabot entry today (cat-harness-tools has pip and Actions, per #469). Whichever adds one first inherits it.

## Kept from cat-harness-tools' copy (copy sync, 2026-10-24)

These notes were only in this copy. The newer copy from the bean branch is above them.

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): the subject is not in this repository. The bean is about folio-assistant's `.github/dependabot.yml` (its npm-vs-bun ecosystem choice), and every remaining done-when is an observation of that repository's weekly Dependabot run. cat-harness-tools has no `dependabot.yml`. The copy of this bean in the folio-assistant store (`cat/cat-harness/beans`) is the live one; it should stay open there and not be closed as a mirror.

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] the header comment in `.github/dependabot.yml` updated with the answer

## Note (2026-10-10, drain ml9h)

Lane B scrapped the cat-harness-tools copy: the subject is folio-assistant's own dependabot.yml, so THIS copy is the owning one and stays open.

## 2026-10-20 — the config named directories this repository no longer holds (drain coordinator, session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6)

Since the separation the index tracks one `package.json` (the root's, zero dependencies, workspaces = mounts). Four npm directories and the pip `/cat-harness-tools/python` named mounts, so Dependabot scanned nothing there. litlfred/folio-assistant#2609 keeps only `/.github/scripts` pip and Actions; litlfred/cat-harness-tools#469 gives tools its own pip `/python` + Actions. npm/bun for instances is deferred until `@litlfred/*` resolve from a reachable registry. Box 1 (observe a weekly run) still open.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): the subject is not in this repository. The bean is about folio-assistant's `.github/dependabot.yml` (its npm-vs-bun ecosystem choice), and every remaining done-when is an observation of that repository's weekly Dependabot run. cat-harness-tools has no `dependabot.yml`. The copy of this bean in the folio-assistant store (`cat/cat-harness/beans`) is the live one; it should stay open there and not be closed as a mirror.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: todo, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: the scrap in the ch/cht copies was store placement only ("the subject is not in this repository"); no done-when was met, and the folio-assistant copy records that it is the owning one and stays open. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

## Closed 2026-10-24 — the subject left this repository (https://claude.ai/code/session_01WJw1NBGSTLWvBnyQzJHXjx)

Measured on folio-assistant `main` a540e5e:
- `.github/dependabot.yml` declares only `pip` (`/.github/scripts`) and `github-actions`. There is no `npm` or `bun` entry, since litlfred/folio-assistant#2609.
- The root `package.json` has no `dependencies` or `devDependencies`. Its `workspaces` name mounts, not committed directories.
- The file's header now carries the answer (box 3): "The bun question … is answered in a repository whose `package.json` has dependencies, not in one whose root has none."

Boxes 1 and 2 observe a weekly Dependabot run on bun manifests, and this repository has none left to run on, so they cannot be met here. They are not ticked. **The bun question itself is unowned.** None of the instance repositories declares an npm or bun Dependabot entry today (cat-harness-tools has pip and Actions, per #469). Whichever adds one first inherits it.
```

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [x] the header comment in `.github/dependabot.yml` updated with the answer


## Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): the subject is not in this repository. The bean is about folio-assistant's `.github/dependabot.yml` (its npm-vs-bun ecosystem choice), and every remaining done-when is an observation of that repository's weekly Dependabot run. cat-harness-tools has no `dependabot.yml`. The copy of this bean in the folio-assistant store (`cat/cat-harness/beans`) is the live one; it should stay open there and not be closed as a mirror.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: todo, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: the scrap in the ch/cht copies was store placement only ("the subject is not in this repository"); no done-when was met, and the folio-assistant copy records that it is the owning one and stays open. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

## Closed 2026-10-24 — the subject left this repository (https://claude.ai/code/session_01WJw1NBGSTLWvBnyQzJHXjx)

Measured on folio-assistant `main` a540e5e:
- `.github/dependabot.yml` declares only `pip` (`/.github/scripts`) and `github-actions`. There is no `npm` or `bun` entry, since litlfred/folio-assistant#2609.
- The root `package.json` has no `dependencies` or `devDependencies`. Its `workspaces` name mounts, not committed directories.
- The file's header now carries the answer (box 3): "The bun question … is answered in a repository whose `package.json` has dependencies, not in one whose root has none."

Boxes 1 and 2 observe a weekly Dependabot run on bun manifests, and this repository has none left to run on, so they cannot be met here. They are not ticked. **The bun question itself is unowned.** None of the instance repositories declares an npm or bun Dependabot entry today (cat-harness-tools has pip and Actions, per #469). Whichever adds one first inherits it.
```
