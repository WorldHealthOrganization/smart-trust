| Variable | Read by | Meaning |
|---|---|---|
| `SITE_WORK` | `ig-repo-site.ts` | working directory; the default for `--work` |
| `FOLIO_SITE_BASEURL` | `ig-repo-site.ts compose` | the site's base URL when `--baseurl` is not given |
| `SITE_ACCEPT_STALE_AST=1` | `ig-repo-site.ts ast` | accept a stale AST. Use it **for a preview only**; never for the site root |
| `IG_CONTENT_QA_ACCEPT_UNREVIEWED=1` | the content gate in `ig-site:compose` | accept a missing or stale content review for a **local** build; the QA page says so. A pattern hit or an open finding is refused anyway |
| `IG_TEMPLATE_REPOS` | `ig-ast-build.sh` | extra `--template-repo ID=OWNER/REPO` values, for an IG template that is not on the CI build server |
| `TMPDIR` | `ig-ast-build.sh` | where the work directory goes (default `$TMPDIR/ig-ast-build`) |

`stage-local.ts` sets the others itself (`SITE_INSTANCE`, `SITE_BASEURL`,
`SITE_URL`, `SITE_SOURCE`, `SITE_DIR` and the rest) when it calls each step.
