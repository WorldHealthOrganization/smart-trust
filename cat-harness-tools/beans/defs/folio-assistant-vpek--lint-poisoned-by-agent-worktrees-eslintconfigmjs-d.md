---
# folio-assistant-vpek
$schema: bean/1.0.0
title: 'LINT POISONED BY AGENT WORKTREES: eslint.config.mjs does not ignore .claude/worktrees/**, so one worktree-isolated agent reports 3158 errors on an unrelated branch'
status: completed
type: bug
priority: high
created_at: 2026-09-30T13:53:15Z
updated_at: 2026-09-30T18:43:06Z
parent: folio-assistant-1xhc
---

`eslint.config.mjs`'s `ignores` does not cover `.claude/worktrees/**`. A
worktree-isolated agent puts a **complete second checkout of this repository**
there, so `bun run cat lint` walks into it and reports thousands of errors that
belong to nobody's diff.

Measured 2026-09-30, on `claude/declare-bootstrap-tools-need`, a branch whose
whole diff is three lines of JSON:

```
✖ 3163 problems (3158 errors, 5 warnings)
error: script "lint" exited with code 1
```

The errors are all typescript-eslint's project-service refusing files outside
the tsconfig program, and the message names both roots:

```
 - /home/user/folio-assistant
 - /home/user/folio-assistant/.claude/worktrees/agent-abd3b9d1e1508f539
You'll need to explicitly set tsconfigRootDir in your parser options.
```

## Falsified

Same tree, same commit, one added ignore:

```
$ bunx eslint . --ignore-pattern '.claude/worktrees/**'
✖ 5 problems (0 errors, 5 warnings)
exit=0
```

**0 errors.** The same 5 warnings `main` carries. So all 3158 came from the
worktree and none from the branch.

## Why it is worth a bean rather than a shrug

It is the **`ymsu` witness-2 symptom** in a different gate: *a gate that fails
for something that is not its subject and not the diff's.* An agent that sees
`lint` red on a three-line JSON diff has two plausible readings — "my change
broke something I do not understand" or "the harness is broken" — and neither
is right. The cost is a diagnosis, every time, by every agent sharing the
checkout.

And it is **not rare**. Any agent dispatched with worktree isolation in this
repository creates one, and they are long-lived: three were live in this
checkout at once during this session. **It poisons `lint` for every concurrent
session in the same checkout, including ones that dispatched nothing.**

## Why the existing ignores do not already cover it

Every entry in that list was added for the same underlying reason — eslint does
not read `.gitignore`, so anything generated or vendored has to be named. The
list's own comments say so twice:

> Jekyll + TypeDoc build output. **Gitignored, but eslint does not read
> .gitignore** — so without this, anyone who builds the docs site locally and
> then runs `bun run cat lint` gets a wall of errors from TypeDoc's bundled assets.

That is this defect exactly, one directory over. `.claude/worktrees/` simply
did not exist when the list was last extended.

## Done when

- [x] `.claude/worktrees/**` is in `eslint.config.mjs`'s `ignores`, with a
      comment saying why — an agent worktree is a second checkout, and its
      files are already linted on their own branch.
- [x] The **general** question is answered rather than only this instance:
      are there other tools that walk the tree from the repository root and
      would find a worktree there? `root-scan-census` counts 65 enumerating
      scripts in `cat-harness/scripts` alone. Whether any of them has this
      problem is **not determined** by this bean and must not be read as no.

## The dot-prefix note

`.claude/worktrees/` is dot-prefixed, and this repository's own
`check:harness-dirs` guard rejects a dot-prefixed segment in a *declared*
directory. That guard does not reach here — `.claude/` is the agent host's
directory, not a declared graph — so this is not an instance of that rule
being broken. Worth stating so the next reader does not file it as one.

## Summary of Changes

Closed on evidence 2026-09-30.

- **Box 1:** `.claude/worktrees/**` is in `eslint.config.mjs`'s ignores with the reason stated. It landed in 30e42937d33 ("vpek: eslint ignores .claude/worktrees/** — a worktree is a second checkout") and is present on main.
- **Box 2, the general question:** answered by bean `g43f`'s sweep. 205 enumerating scripts were examined: the loose filter matched 142 and the tight filter 2, and both tight candidates were false positives on inspection. **No fourth instance was found** beyond eslint and g43f's two. Since #1602 (bean `tqv4`), `root-scan-census` also scans every declared instance, so the instrument now covers the class repository-wide.
