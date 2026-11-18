Its metadata exports, measured on two IGs:

| export | trust IG | immunizations IG |
|---|---|---|
| `valueset-ref-list.json` ValueSet→CodeSystem edges | 17 over 14 | 431 over 252 |
| `codesystem-ref-list.json` `uses` populated | 0 of 15 | 0 of 14 |
| `usage-stats.json` extension→path | 6 | 35 (+5 profiles) |

- **`uses` is declared but never populated**, so "no dependencies" and "not
  computed" look the same.
- **No dependencies among `Library`, `PlanDefinition` or `Measure`.** In the
  immunizations IG that is 279 + 138 + 41 artefacts, about **61 %**: the CQL
  and decision logic.

The exports reach terminology, not logic. Logic dependencies need an AST
emitted by the tool itself, which means changing `org.hl7.fhir.core`, not only
the Publisher. Re-measure before quoting: a release can close either gap.
