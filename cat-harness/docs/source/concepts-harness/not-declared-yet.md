Two parts of the model above are intended and **not implemented**. Each says
what a reader will actually hit, because a page that described them as working
would send somebody to look for code that is not there.

### 1. Harness is not yet a node kind

Harness is intended to be **one node kind**, and an instantiated harness an
instance of it (cat-harness#1138 phase P2). Nothing in the schemas registers
that kind today: a layer declares a `name`, directories, assets and `needs`, and what makes it
a Harness rather than a dependency is the presence of a config file, which is a
fact about the filesystem rather than a declared type.

Without a kind there is nowhere to say what a
Harness of a given sort **MUST** supply, so every obligation on this page is
prose rather than something a declaration can be validated against.

### 2. The stub is NOT free of the definition's name

The model says a Harness defined as `folio-assistant` **MAY** be instantiated
as `my-folio-assistant.config.json`, with the config pointing at the
definition. Three places refuse it, and they refuse it consistently:

- `instanceConfigFilename` **composes** the filename from the declared name,
  so the stub is derived rather than chosen.
- The left-hand navigation tests for `<declared name>.config.json` when
  deciding whether a harness is instantiated on a layer — a differently-named config
  would leave the layer with no tile.
- `check:instance-config` reports a config whose filename does not match its
  layer's name as a finding, reading it as a rename half-done.

And the config carries **no field pointing at a definition**, so even were the
filename freed there is nothing for it to point with. Freeing the stub means
adding that pointer first; the filename rule is the symptom.

---

Neither item blocks the other. Instantiation works, the dependency
walk works, and all four coverage obligations are carried and checked. What is
missing is the part that would let a Harness be **validated as** a Harness
rather than recognised as one.
