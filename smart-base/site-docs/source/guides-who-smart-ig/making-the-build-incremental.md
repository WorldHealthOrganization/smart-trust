On the immunizations IG the median artefact has no dependents and the 90th
percentile has six, so almost every edit invalidates a handful of resources and
the index. The build therefore rebuilds only the change's dependency cone where
it can.

The process above is the L3 pipeline's build lane with the derived artefacts
cached by dependency cone. Restore the cache; compute the change's cone with
`bun run fhir-harness/scripts/fsh-cone.ts <ig-root> --changed <files>`; compile
and validate only the cone against the warm validator; re-render the cone's
records; rebuild the meta-index; assemble the site. A cache miss or a moved
toolchain falls back to a full build, and only a green build of `main` or a
release seeds the cache. A release is always cut from a full build. The rules
are fhir-harness's `ig-build-pipeline` skill.

| Step | Implemented by |
|------|----------------|
| Restore and seed the derived state | `fhir-harness/scripts/ig-cache.sh` (`restore`, `verify`, `seed`) |
| Compute the cone of the change | `fhir-harness/scripts/fsh-cone.ts` |
| Validate the cone | [`fhir-validation`]({{ site.baseurl }}/reference/skills/fhir-validation.html) over the warm validator service (proposed MCP tools) |
| Rebuild the meta-index, assemble the site | `ig_metaindex_rebuild` (proposed), [`ig-publication`]({{ site.baseurl }}/reference/skills/ig-publication.html) |
| QC gates, deploy | [`quality-control`]({{ site.baseurl }}/reference/skills/quality-control.html), [`content-publish`]({{ site.baseurl }}/reference/skills/content-publish.html) |
