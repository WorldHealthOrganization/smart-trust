# library-strip — the two Library strippers, placed in the base layer

`strip_library_binaries.py` and `strip_library_content.py` are **byte-identical
copies** of the WHO SMART Guidelines build's post-processing scripts. They are
here because nothing in either is DAK-shaped: any IG that depends on
`hl7.fhir.uv.cql` publishes `Library` resources carrying compiled CQL/ELM
twice, once inline and once as standalone files. That makes them a property of
the FHIR IG pipeline, which is this layer
([`ig-build-pipeline`](../../skills/fhir-ig-base/ig-build-pipeline.md)
§"Generic post-processing scripts").

## Provenance

| | |
|---|---|
| source | <https://github.com/WorldHealthOrganization/smart-base>, `input/scripts/` |
| commit | `5891a220e8ebbbd2d107282876a085641c5c767f` |
| licence | CC-BY-3.0-IGO (the source repository's `LICENSE.md`). Attribution: World Health Organization, SMART Guidelines Team. |
| copied | 2026-10-04, unmodified |
| sha256 | `strip_library_binaries.py` 23f2d8192a6f9206f1774a0a1e59b67ff4893006e1ecc4ea54e9fc003c0f4c91 |
| sha256 | `strip_library_content.py` 14f0ea0b902ffd833c86e2ffef79ec7f936d825dd12a846001e8fb7214f167ec |

Both files are kept **unmodified** so that a diff against upstream stays
meaningful. Their docstrings still say "WHO SMART Guidelines"; that is a
statement of origin, and the exclusion gate (`check:fhir-harness-exclusions`)
grades no rule against it. A change belongs upstream first. Re-copy it and
update the commit and hashes above (`library-strip.test.ts` fails until you do).

One known upstream nit: `strip_library_content.py` imports `typing.Optional`
and never uses it (ruff F401). It is left as is here so the copy stays
byte-identical; the fix is upstream's.

## Running them

Both take the Publisher's `output/` directory as their only argument, and both
run **after** the build, because the resources they edit are the published ones:

```sh
python3 fhir-harness/scripts/library-strip/strip_library_binaries.py output
python3 fhir-harness/scripts/library-strip/strip_library_content.py output
```

Upstream runs them as adjacent steps, binaries first. The Tools that declare
them are `strip-library-binaries` and `strip-library-content` in
[`../../tools/index.ts`](../../tools/index.ts).
