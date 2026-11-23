A Harness does not only *hold* directories. It **harnesses** them — and a
datastore such as a git repository is harnessed the same way, **through
Tools**: the Harness names the Skills that reach the store, and a Tool supplies
the mechanism. That indirection is what lets the same Harness be driven against
a different store without rewriting a Skill.

**Declaring a directory is a promise.** It says this layer holds a graph of
that kind and a consumer may scan it, and the obligations below are what make
the promise keepable. They are stated in full by
[`harness-requirements`]({{ '/reference/skill-instructions/harness-requirements.html' | relative_url }})
and measured by `check:subgraph-coverage`.

| obligation | declared as | the question it answers |
|---|---|---|
| **serialisations** | `coverage.serialisations` | is each node addressable as `json`, `jsonld` and `schema.json`? |
| **visualiser** | `coverage.visualiser` | can a person LOOK at this? |
| **docs** | `coverage.docs` | can a person READ ABOUT this? |
| **skill** | `coverage.skill` | is an agent handed something that GOVERNS this? |

The first four are per declared directory. A fifth, a starting README, is per
layer and is ranked harder still: without one a reader cannot enter the
layer.

### `coverage.process` is DECLARED and is not an obligation

A directory may also name the BPMN process that **governs** it —
`coverage.process`, a diagram's basename such as `document-ingestion`. The
generated subgraph README then draws that diagram, links its `.bpmn` source and
lists the subprocesses it calls, so the page a reader lands on says how the
directory is worked rather than only what is in it.

It sits apart from the four above in two ways.

**It is not owed.** Most directories are not the subject of a process, so an
absent `coverage.process` means NOT DECLARED and never "no process" — the same
third state `readOnly` keeps — and a directory declaring none gets no such
section and is not a finding. What *is* a finding, ranked major, is a declared
name that resolves to no diagram: somebody said, and what they said points at
nothing. There is no `exempt.process`: declaring nothing already says it.

**It is declared rather than inferred** from a diagram's event names. An
event's name is editorial text, so rewording it would silently unlink the page,
and a diagram touches several directories while being *about* one —
`document-ingestion` reads `uploads/` and writes `library/`.

### The serialisation is the one obligation a Harness MAY NOT waive

A Harness **MUST** serve `json`, `jsonld` and `schema.json` at a harnessed
directory's own URL and at every node beneath it, and **MUST NOT** be excused
it. `coverage.exempt` carries three keys — `visualiser`, `docs`, `skill` — and
deliberately not a fourth, and the coverage check ranks a missing serialisation
as an unmet obligation with no by-kind test at all.

`bootstrap` is excused a visualiser because its `json` and `jsonld` *are its
existence*, so the serialisation cannot itself be excusable, or the exemption
would excuse everything. **The visualiser
is the courtesy; the serialisation is the existence claim.**

A Harness **SHOULD** provide a visualisation, and which kinds owe one is a
question about the kind rather than a blanket rule: an active state directory
in the repository root — `beans/`, `todos/`, `fsh-guts/` — owes one because a
Harness renders something for each state directory it initialises, while a kind
that was never going to need one is not carrying a debt.

That difference is why the coverage axis ranks findings **major** and **minor**
rather than counting them: major is an obligation this kind owes and the
layer has not met; minor is nobody having said yet, for a kind that never
owed one. A single count would rank `beans/` having no viewer alongside a kind
that never needed one.

A Harness **SHOULD** also carry a `docs/` directory documenting itself, and
every Harness **SHOULD** have one. `cat-harness` renders its own through the
plain documentation path — no extensions, no JavaScript where it can be avoided
— which is why it is the one layer that owns a renderable kind at all: **a
layer owns the kinds it can render.**
