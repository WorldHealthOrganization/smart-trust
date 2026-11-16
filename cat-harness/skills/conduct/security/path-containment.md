---
name: path-containment
description: >
  Turning a value from outside into a path. The two different questions —
  a URL path versus a single identifier — why collapsing them is a defect,
  and how to find every sink that needs a check.
consulted: true
---

# Path containment — two questions that look like one

`src/core/safe-path.ts` is the implementation. The two checks are not
interchangeable:

| you have | you want | use |
|---|---|---|
| a **URL path** (`/a/b.html`), possibly percent-encoded | the file it names inside a root | `resolveWithin`, then `realPathWithin` |
| a **single identifier** (`paperId`, a slug, a work item id) | one path segment, or a refusal | `safeSegment` / `joinSegments` |
| a path you are about to **write** that does not exist yet | containment despite an absent leaf | `writableWithin` |

**Why not one function.** `resolveWithin` relies on a URL pathname beginning
with `/`, so `normalize` absorbs leading `..` against the root and traversal by
spelling cannot escape it. An identifier
has no leading slash, so `a/b` passed to it resolves to a *contained nested*
path. When the caller meant one directory, contained is not the question, and a
collapsed check would accept it.

**The lexical check is the weaker half.** `resolve` is string arithmetic and
never touches the filesystem, so a symlink inside the root pointing out of it
passes. `realPathWithin` catches it. `writableWithin` walks up to the nearest
existing ancestor, because a target that does not exist yet has no realpath to
compare.

## Rules for a sink

**Enumerate the sink shape, not a list of instances.** Every `join()` reached
from a request is a sink; a fix aimed at the sinks an audit listed leaves the
ones it did not.

**Check every external value.** A function that takes two external values (say
`paperId` and `rootName`) needs both checked, which is why `joinSegments`
checks every segment rather than the first.

**Check the value you were given, not the fallback.** `id = paperId ||
file.name.replace(/[^a-z0-9-]/gi, "-")` sanitises only the branch nobody
attacks.

**A file name needs `basename` AND `safeSegment`, in that order.** `basename`
reduces `../../etc/passwd` to `passwd`, but `basename("..")` is `".."`, which is
not a name. Either alone admits something.

**Ask where each element of a parsed structure came from.** A list of member
names read from a stored manifest was written from user input, so validating
the identifier alone leaves a read reachable through a member name. Where a
member may legitimately sit in a subdirectory, the check is `realPathWithin`
(containment), not `safeSegment`.

**A refused read and a refused write behave differently.** A reader that
already returns `[]` for "nothing there" returns `[]` on refusal and *logs*,
since a traversal attempt and a typo look identical in an empty array. A writer
**throws**, because a refused write has no correct no-op: the caller believes
the item was saved.

### The gate, and what it cannot do

`scripts/tests/server-path-sinks.test.ts` is a **source ratchet**: it proves the
guard has not been deleted, never that a value is checked on every path to a
sink. It asserts its own non-vacuity, because a renamed server would otherwise
make every `not.toContain` pass.
