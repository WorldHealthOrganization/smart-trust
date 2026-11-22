SMART Base deploys to **GitHub Pages** only. The options, and what each would
take, are on the FHIR IG layer's page:
[Deployment targets: GitHub Pages and Cloudflare](https://litlfred.github.io/folio-assistant/fhir-harness/fhir/publishing.html#deployment-targets).

Two points are particular to this IG:

- **The canonical is `http://smart.who.int/base`.** It names WHO's
  publication, not this site, so moving this site to another host or domain
  does not change the canonical. It does change every link to
  `litlfred.github.io/smart-base/` that is already published.
- **The site is large**, with six languages and an OpenAPI page per
  operation. Count the files on `gh-pages` before choosing Cloudflare Pages,
  which limits the number of files per deployment.
