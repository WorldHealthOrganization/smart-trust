---
name: initialization-steps
description: >
  Walk every initialization step the declarations name (the layer's own
  and each one it needs), check each before doing anything, do what can be
  done, ask for what only a person can do, and report every step as done,
  not done, could not determine, or stated.
---

# Every initialization step, as the declarations name them

**You are making sure a harness's initialization is complete**: right after
installing it (`initialize-harness` calls
[`complete-initialization`](../processes/complete-initialization.bpmn)), or
because you were dispatched to do exactly this with nothing but the diagram
and the repository. Either way the steps are the same, and they are **not
listed in this file**. They are named by the declarations.

## Where the steps come from

Read `<name>.json` at the root, then each name in its `needs`, from a
sibling checkout at `../<name>/<name>.json`. Each step below names the
declaration that names it, so a reader can see why it is there.

| step | named by | done when |
|---|---|---|
| `declaration` | the file itself | `<name>.json` parses and its `name` is its file name |
| `needs:<name>` | `needs` | the dependency is beside it, and its declaration parses |
| `instructions:<name>` | FR-4 | *stated*: `<name>/docs/bootstrap/initialization.md` was read and followed |
| **`schemas:staged`** | each `$id` / `@id` under `iriBase` (FR-11) | the site build stages every JSON Schema and JSON-LD document at its IRI |
| **`schemas:published`** | the same IRIs (FR-11) | every one of those IRIs answers |
| `directory:<id>` | `directories[]` | the declared path exists |
| `asset:<id>` | `assets[]` | the declared file exists |
| `readme` | FR-8 | the root has a `README.md` |
| `readme-sections` | the README's own markers | every section the README opts into is current |
| `site:workflow` | `repository` | a workflow commits the rendered site onto `gh-pages` |
| `site:branch` | `repository` | a `gh-pages` branch exists — it must, before Pages can be switched on |
| `site:enabled` | `repository` | Pages is on, serving `gh-pages` |
| `site:live` | `iriBase`, else the Pages address | the address answers |

**The two `schemas:` steps are the primary ones.** They are checked first
once the declarations are read, and the report leads with them:
[`publish-documents`](publish-documents.md).

A harness above bootstrap names more steps **the same way**. A work-plan
store it declares as a directory is a `directory:` step, and a harness's own
set-up instructions are its `instructions:` step. Bootstrap does not need to
know which harness declares what.

The site steps are in [`publish-site`](publish-site.md).

## Four states, not two

- **done**: checked, and it holds.
- **not done**: checked, and it does not. Say exactly what to do next.
- **could not determine**: the check could not run (no forge CLI, no
  network). **Never reported as done.** A check that could not look is not a
  pass.
- **stated**: the declarations name it but nothing can observe it (reading
  and following a harness's instructions). Follow it, say you did, and leave
  it *stated*.

## Idempotent by construction

**Check before doing, every time.** A done step is left alone, so running
the process twice changes nothing the second time, and an interrupted run is
resumed by running it again. **Performing is not the same as done**: after
you do a step, check it again, and only the check says *done*.

**Replace nothing.** A step that would overwrite what somebody wrote (an
existing README, a Pages site built from a branch, a declaration that
disagrees with the directories on disk) is a step for the person. Ask
through [`human-agent-discussion`](human-agent-discussion.md), with the exact
step written out.

**Do not create an empty declared directory to make its step pass.** Git
does not track an empty directory, so the check would pass on your machine
and fail on every clone. Put its first file in it, or ask whether the entry
should go.

## Where tools are available

A toolset may perform the checks for you — for example https://github.com/litlfred/bootstrap-tools, whose `init` command
reads the same declarations, does what a tool can (regenerating README
sections; switching Pages on when an authenticated `gh` is present), and
prints each step in these four states with what to do next:

```sh
bun run scripts/init.ts --root ../<instance>        # from a toolset checkout beside it
bun run scripts/init.ts --root ../<instance> --dry-run   # check only
```

Where no tools are available, do the same by reading files. The diagram is
the same either way, and so is the report.

## The report

One report through [`log-message`](log-message.md), **led by the primary
step's state** (the JSON Schemas and JSON-LD at their IRIs): then every step, the
declaration that named it, its state, what was seen, and for anything not
done, what to do and who does it. End with the counts (done, not done, could
not determine, stated). An initialization that finished with steps open says
which. It is not hidden behind "installed".
