| Message or symptom | Cause | What to do |
|---|---|---|
| `cat: mounting failed` | the mounter could not fetch a layer, or a layer's bytes did not match the lock | run `bash .github/mount-from-lock.sh` to see which layer and why |
| the AST is stale, cannot-tell, or missing | no AST matches your commit's inputs | run `bun run cat prepare:fhir-harness`, or the `ig-ast-refresh` workflow |
| no review, or a stale review, in `qa/ig-content-qa.json` | the content gate has no agent review for this exact content | record one (`ig-content-qa:scan`, then `ig-content-qa:record`); for a local look only, `IG_CONTENT_QA_ACCEPT_UNREVIEWED=1` |
| `qa/ig-content-qa.json exists but is not in contentTypes.ig.include` | the IG does not let the harness read the file | add `qa/ig-content-qa.json` to `include` in the IG's `index.config.json` |
| a content pattern hit or an open finding | text that looks like an injection attempt | fix the text in the IG's source; nothing overrides this |
| `index.config.json` has no `site.landing` | the IG is harnessed but does not say which layer's chrome it wears | add `"site": { "landing": "<layer>" }` |
| a prerequisite is missing | `docker`, `python3 -m venv`, `bash` or `curl` was not found | install it; the plan names which one |
| `ig-ast-build: the AST just built is not valid` | the inputs changed during the build | commit or stash, then build again |
| the Publisher cannot fetch a package | `packages.fhir.org` is unreachable | see the `fhir-validation` skill, §"When a package host refuses you" |

Exit codes of `ig-ast-site.sh`: `1` means no AST could be restored; `3`
means the AST was restored but could not be turned into pages.
