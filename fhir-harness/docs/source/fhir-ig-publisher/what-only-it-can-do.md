1. **Profile validation**: every resource against its profiles and FHIR version.
2. **Dependency-closure resolution** with version pinning (for a clinical
   guideline IG: `hl7.terminology`, `hl7.fhir.uv.extensions.r4`,
   `hl7.fhir.uv.cql`, `hl7.fhir.uv.cpg`, `hl7.fhir.uv.crmi`, `hl7.fhir.uv.sdc`).
3. **Terminology expansion** against a terminology server.

None can be recomputed from its output, so a cached build is a *cache*: its
indices, dependency edges and versions were true when it was written.

**Expansion fails quietly.** Against a dead or restricted terminology server
there are fewer expansions and the consuming steps warn and continue. A thin
vocabulary is not evidence of a thin `ValueSet`; check that expansion ran.
