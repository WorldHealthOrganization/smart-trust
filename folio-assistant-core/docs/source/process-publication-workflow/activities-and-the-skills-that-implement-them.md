| Activity | Lane | Skill |
|----------|------|-------|
| Describe the intended change | Editor / author | — (human) |
| Claim or open the bean | Work plan | [`todo-manager`]({{ site.baseurl }}/reference/skill-instructions/todo-manager.html) |
| Draft the block edit | Authoring agent | [`content-author`]({{ site.baseurl }}/reference/skills/content-author.html) |
| Schema and constraint checks | Mechanical validation | [`content-validate`]({{ site.baseurl }}/reference/skills/content-validate.html) |
| Syntax, spelling and links | Mechanical validation | [`content-validate`]({{ site.baseurl }}/reference/skills/content-validate.html) |
| Build and QA gates | Mechanical validation | [`content-test`]({{ site.baseurl }}/reference/skills/content-test.html) |
| Agent review of the change | Non-mechanical validation | [`content-review`]({{ site.baseurl }}/reference/skills/content-review.html) |
| Human / SME review | Non-mechanical validation | [`content-review`]({{ site.baseurl }}/reference/skills/content-review.html) |
| Collate findings into a report | HCI validation pipeline | — (pipeline) |
| Log findings on the bean | Work plan | [`todo-manager`]({{ site.baseurl }}/reference/skill-instructions/todo-manager.html) |
| Review the findings | Editor / author | — (human — this is the gate) |
| Revise the proposed change | Authoring agent | [`content-author`]({{ site.baseurl }}/reference/skills/content-author.html) |
| Commit into the corpus | Corpus | — (subject to the `commit-hygiene` requirement) |
| Resolve or re-open the bean | Work plan | [`todo-manager`]({{ site.baseurl }}/reference/skill-instructions/todo-manager.html) |

The domain-specific checks hang off `content-validate` / `content-test` by
content type:
[`lean-formalization`]({{ '/reference/skills/lean-formalization.html' | relative_url }}) and
[`proof-verification`]({{ '/reference/skills/proof-verification.html' | relative_url }}) for papers,
[`fhir-validation`]({{ '/reference/skills/fhir-validation.html' | relative_url }}) and
[`quality-control`]({{ '/reference/skills/quality-control.html' | relative_url }}) for IGs,
[`latex-authoring`]({{ '/reference/skills/latex-authoring.html' | relative_url }}) for rendering.

---
