Three things to note:

1. **A red draft is fixed in the editing process, not in the artifact.** The
   `no` branch off `Draft QA green?` goes back through the editing call
   activity — which means back through the HCI validation gate. Nobody patches
   a built PDF or a generated IG.
2. **Review is parallel, and both halves must land.** The review team (content
   reviewer, QC reviewer, technical officer) reviews the draft as a publication;
   the clinical or scientific SMEs sign off on the domain content. The join
   waits for both.
3. **Change requests become beans.** Each `changes requested` item is opened
   as a bean, so whoever picks the work up next sees exactly what review asked
   for.

| Activity | Lane | Skill |
|----------|------|-------|
| Open or claim the release bean | Work plan | [`todo-manager`]({{ site.baseurl }}/reference/skill-instructions/todo-manager.html) |
| Build the draft publication | Corpus + build pipeline | [`content-publish`]({{ site.baseurl }}/reference/skills/content-publish.html) |
| Run publication QA gates | Corpus + build pipeline | [`content-test`]({{ site.baseurl }}/reference/skills/content-test.html) · [`quality-control`]({{ site.baseurl }}/reference/skills/quality-control.html) |
| Editing and HCI validation | Editors + authoring agents | call activity → [diagram 3](#editing-and-the-hci-validation-gate) |
| Circulate the draft | Publication manager | [`content-review`]({{ site.baseurl }}/reference/skills/content-review.html) |
| Review the draft publication | Review team | [`content-review`]({{ site.baseurl }}/reference/skills/content-review.html) |
| Clinical / scientific sign-off | SMEs | [`content-review`]({{ site.baseurl }}/reference/skills/content-review.html) |
| Open beans for the change requests | Work plan | [`todo-manager`]({{ site.baseurl }}/reference/skill-instructions/todo-manager.html) · [`content-feedback`]({{ site.baseurl }}/reference/skills/content-feedback.html) |
| Authorise the release | Programme manager | [`content-publish`]({{ site.baseurl }}/reference/skills/content-publish.html) |
| Version, tag and publish | Publication manager | [`content-publish`]({{ site.baseurl }}/reference/skills/content-publish.html) · [`ig-publication`]({{ site.baseurl }}/reference/skills/ig-publication.html) |
| Close the release beans | Work plan | [`todo-manager`]({{ site.baseurl }}/reference/skill-instructions/todo-manager.html) |

This diagram implements the `req:content-lifecycle` phase gates —
`validate-before-review`, `review-before-test`, `test-before-publish`,
`publish-authorized` — see
[`skills/requirements/content-lifecycle.json`](https://github.com/litlfred/folio-assistant/blob/main/skills/requirements/content-lifecycle.json).

---
