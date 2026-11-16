| Stage | Skill | What happens |
|-------|-------|--------------|
| plan | `content-plan` | Scope the work, identify artifacts and actors |
| author | `content-author` | Create structured artifacts from source material |
| validate | `content-validate` | Check against schema + constraints |
| review | `content-review` | Human / SME review against criteria |
| test | `content-test` | Automated QA, build green, proofs/validators pass |
| publish | `content-publish` | Render and deploy the published form |
| feedback | `content-feedback` | Capture and route reviewer feedback |
| retire | `content-retire` | Deprecate or archive an artifact |

The stages are the same for every content type; what differs is the
*authoring* skills and the *artifacts* each type produces. For the full list
of skills and the roles that drive them, see **[Skills & roles]({{ '/docs/cat-harness/concepts/skills.html' | relative_url }})**.

The strip hides two loops. `author` and `validate` are a loop, not consecutive
phases: every proposed change runs the HCI validation gate, and the editor sees
the findings before anything is committed. `review` happens twice, once per
change and once over the assembled draft. Both expand into their own diagrams
on the **[publication workflow](../process/publication-workflow.html)** page.

---
