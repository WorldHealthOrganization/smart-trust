---
name: injection-boundaries
description: >
  Where a value becomes program rather than data — workflow expressions, shell
  strings, and archive members. What the gate covers, why a step output carries
  a severity rather than having one, and the argv rule.
consulted: true
---

# Injection — the value became program

## Workflow expressions: the remedy is not quoting

A `${{ }}` expression is substituted into the script **text** before bash parses
it, so a value containing a quote closes the surrounding string and the rest
executes. `check-workflow-injection.ts` demonstrates the payload rather than
asserting it, and its three bands are worth knowing:

| class | example | verdict |
|---|---|---|
| **free text** | `pull_request.title`, `.body`, `comment.body`, a dispatch input | FAIL |
| **constrained** | `pull_request.number`, `head_ref`, `repository.name` | reported and baselined |
| **safe** | `github.workspace`, `matrix.*`, `secrets.*` | not reported |

The fix is `env:` plus `"$VAR"`, where bash sees a value rather than source.

### `steps.*.outputs` is not a class — it is a PIPE

A step output holds whatever the step put in it, so it has no severity of its
own:

```yaml
- id: version
  env:
    INPUT_VERSION: ${{ github.event.inputs.version }}   # free text — FAIL band
  run: |
    echo "$VERSION" >> "$GITHUB_OUTPUT"                 # ...written out
# a later step:
  run: |
    mv *.tgz "pkg-${{ steps.version.outputs.version }}.tgz"
```

A dispatch of `1.0";id;"` renders `mv *.tgz "pkg-1.0";id;".tgz"` and runs `id`.
**`env:` protects the step that binds, not the value's onward journey.**

**Provenance is resolved, not assumed.** `resolveProvenance` reads each step
that writes `$GITHUB_OUTPUT`, takes the worst severity among the expressions
that step binds, and a consumption of its output inherits it — keyed
`job.stepId`, since step outputs are job-scoped and two jobs may reuse an id. A
job's `outputs:` block is followed one more hop, so `needs.<job>.outputs.<name>`
inherits too. **Enumerate the whole band, not the examples an audit named.**

**Graded free text even when sanitised, on purpose.** A producer that reduces
its value to `[A-Za-z0-9._-]` with a `sed` cannot carry a payload, but the gate
does not decide per site whether a sanitiser is good enough: it reports the
site and takes an `env:` line as the answer. This is stricter than
[`untrusted-input`](../conduct-core/untrusted-input.md), which lists *"an output
your own workflow sanitised"* as trusted for a person reading the workflow. A
reviewer may conclude a value is fine; the gate makes sure somebody concluded
it.

### `script:` blocks are the SECOND surface

`actions/github-script` runs JavaScript, and `${{ }}` is substituted into its
source text the same way, although `script:` sits under `with:`. **A scope
exclusion is a place defects collect, not a place they are absent.**

**One position there is worse than any in bash.** Inside a template literal
`${…}` is *evaluated*, so a value need not close a quote to become program, and
git accepts such branch names:

```
git check-ref-format --branch 'a${process.exit(1)}b'   → LEGAL
git check-ref-format --branch 'x`id`'                  → LEGAL
git check-ref-format --branch 'x${7*7}'                → refused, for the `*`
```

A raw fork branch name interpolated into a template literal is arbitrary
JavaScript execution reachable by opening a fork PR.

**The remedy differs, so it is a separate surface and not a wider regex.** A
`script:` block is Node: bind on the step's `env:` and read `process.env.VAR`
(e.g. `const slug = process.env.SLUG`). The gate emits a different sentence,
and `baselineKey` carries the surface — the same expression in the two surfaces
is two decisions.

**Position is deliberately NOT modelled.** Deciding whether an interpolation
sits inside a template literal means tracking backticks across lines, and a
detector that quietly missed the multi-line case would be worse than none. The
bands grade the value.

## Shell strings: pass an argv, not a sentence

`execSync("tar xzf " + name)` hands bash a program. `execFileSync("tar", ["xzf",
name])` has no shell to parse, so a filename can never become a command. Prefer
the argv form even where nothing is attacker-controlled today, so it cannot
become so by an edit somewhere else.

An argv still leaves **argument** injection: a value beginning with `-` can be
read as a flag. Where a value is a filename, `--` before it, or a `./` prefix,
settles it.

## Archives: `..`-refusal is not containment — check the member TYPE

GNU tar refuses a `..` member and strips a leading `/`, so traversal **by
spelling** is covered by tar itself. What that does not cover is a **link
member**, which writes through to its target — the same residual class the
lexical path check has.

**Refuse on the member's TYPE, and make it a whitelist.** `tar tvzf` (not `tzf`)
puts the type in the first character of the mode; accept only `-` (regular file)
and `d` (directory). Then extract with `--no-same-owner --no-same-permissions`.
A whitelist, because a refuse-list admits whatever tar feature nobody thought
of, and a source archive has no legitimate device, fifo or link member.

**Name checks cannot substitute:**

```
-rw-r--r-- root/root  2 2026-09-26 12:13 main.tex        ← accepted
lrwxrwxrwx root/root  0 2026-09-26 12:13 evil.tex -> /etc/passwd
hrw-r--r-- root/root  0 2026-09-26 12:13 hard.tex        ← hardlink
```

The symlink member is named `evil.tex`: **not absolute, no `..`, no NUL**. It
passes every name check there is. Only the type distinguishes it.

### Parsing the listing, and reporting a refusal

**The member name is everything after the FIFTH field of a `tvzf` line**, so a
name containing spaces survives intact. **Parse a listing against real output
(e.g. a tarball with a space in a member name), never against its shape as you
remember it.**

**A refusal is not a format mismatch.** An unsafe-member refusal must not be
swallowed by a "might be a single file" fallback: it gets a distinct error
type, so a handler can answer 422 for a hostile archive and carry on for a file
that is not a tarball.
