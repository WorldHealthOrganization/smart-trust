# IRIS subsets

Inputs to [`../run.ts`](../run.ts) in mode `subset`, which catalogues part of WHO IRIS by
reference: each item's Dublin Core record plus a link to its PDF on IRIS, no
bytes (who-iris#207).

| file | what it is |
|---|---|
| [`hiv-immunization.query`](hiv-immunization.query) | The owner's match rule (Q-IRIS-1 = A, 2026-11-10): HIV, immuni\* or vaccin\* in title, subject, MeSH or abstract. Full text is left out on purpose: it matches PDFs that only mention a vaccine. |
| [`hiv-immunization-dak-citations.txt`](hiv-immunization-dak-citations.txt) | IRIS items cited by the HIV and immunization DAKs, catalogued first. |

```sh
bun scripts/iris-cdn/run.ts subset --root . \
  --handles scripts/iris-cdn/subsets/hiv-immunization-dak-citations.txt \
  --query "$(cat scripts/iris-cdn/subsets/hiv-immunization.query)" --sample 100 --seed 207
```

The match count is printed by the run, not written here (a count in prose
goes stale).
