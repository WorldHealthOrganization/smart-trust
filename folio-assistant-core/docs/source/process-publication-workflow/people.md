| In the diagrams | Actor | Authority |
|-----------------|-------|-----------|
| **Editor / author** | `author` | Creates and modifies content. Decides accept / revise / discard at the HCI gate. Inherits `reviewer`. |
| **Reviewer** | `reviewer` | Views content and leaves review comments. **Cannot make direct changes.** |
| **Human / SME reviewer** (editing) | `clinical-sme` | Domain ground truth. Answers the judgement calls a review agent escalates. |
| **Review team** (draft) | `content-reviewer` | Formal approval and phase-gate sign-off — the approval authority on a draft. |
| | `qc-reviewer` | Publication-readiness QA across layers; runs the QA reports. |
| | `technical-officer` | Programme-area coordination and first-pass review. |
| **Publication manager** | `publication-manager` | Builds, versions, tags, deploys. Does not authorise the release. |
| **Programme manager** | `programme-manager` | Scope, team, timeline, governance — and **release authorisation**. |
| **Admin** | `admin` | Full administrative access: roles, settings, all content. |

Domain-authoring roles that appear inside `content-author` rather than as their
own lane: `business-analyst` (L2 DAK), `fhir-modeller` (L3 FHIR),
`terminologist` (code systems and value sets), `translator` (localisation).
