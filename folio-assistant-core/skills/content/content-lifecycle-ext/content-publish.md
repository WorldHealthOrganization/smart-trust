---
satisfies:
  - "req:content-lifecycle#publish-authorized"
input: schemas/skills/content-publish/input.schema.json
output: schemas/skills/content-publish/output.schema.json
---

# Content Publication

Package, version, and publish approved content.

## Responsibilities
- Update version numbers (semantic versioning: major.minor.patch)
- Create publication metadata required by the target content type
- Build final artifacts using the content type's publication pipeline
- Create release branches and tags
- Create GitHub releases with release notes
- Deploy to the target publication platform — the push is
  the general [`render-kg-to-cdn`](../../../../cat-harness/skills/process/workflow/render-kg-to-cdn.md)
  step with the release root as its publication root URL; the target's Tool
  (`gh-pages` for GitHub Pages) carries the platform-specific steps
- Reset development branch to draft status for next cycle

## Actors
- Publication Manager (lead)
- Programme Manager (release authorization)

## Inputs
- Approved and tested content
- Version increment decision (major/minor/patch)
- Release notes

## Outputs
- Published artifacts (HTML site, PDF, or content-type package)
- GitHub release with tags
- Publication URL
- Updated version in development branch
