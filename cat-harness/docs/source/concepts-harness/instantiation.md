A Harness is **instantiated** on a layer when that layer's `index.config.json`
names it. The index is the one file that says which harnesses are instantiated
here, as opposed to which layers are merely mounted for their content:

```
index.config.json       which harnesses are instantiated HERE, and where each layer comes from
<stub>.config.json      how one instantiated harness is configured
<stub>.json             what a layer DECLARES — its directories and assets
```

Three files, three questions, and three filenames: two schemas and two readers
behind one spelling is a distinction a reader would have to already know.

**Not yet what the schema says.** Today `index.config.json` has one list,
`instances[]`, and it does double duty: it says where every mounted layer comes
from, and every name in it is read as an instantiated harness
(`instantiatedHarnessNames` returns the whole list). So a content layer whose
index lists nine layers, itself and `bootstrap` included, has all nine counted
as instantiated harnesses.
Splitting the list into the harnesses instantiated here and the layers only
mounted is cat-harness#1138 phase P2. A layer with no `index.config.json` falls
back to the older rule: a root `<name>.config.json` instantiates that harness,
and a layer that declares directories but carries no config is a dependency,
inherited by whoever depends on it, with no interface of its own.

An instantiated Harness **MUST** own the visualisation published at
`<baseurl>/<stub>`. The stem every published artefact is named with is computed
in exactly one place — `artefactStub`, which returns the declared `stub` when
there is one and the `name` otherwise — so the site build, the Knowledge Graph
export and any future artefact cannot disagree about what a layer is called.

> **The stub is intended to be free of the definition's name.** A Harness
> *defined* as `folio-assistant` should be instantiable as
> `my-folio-assistant.config.json`, with the config pointing at the definition,
> and `<baseurl>/my-folio-assistant` then live. **That is not what the code
> does today** — see the last section. It is stated here because the rest of
> this page assumes it; a reader who tries it is stopped by a gate, not a
> schema.
