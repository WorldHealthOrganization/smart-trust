| Step | Checkout script | When it runs | What it does |
|---|---|---|---|
| DAK pre-processing | `smart-base:dak-pre-export` (`smart-base/scripts/dak-pre-export.sh`) | **before** the Publisher, as the `pre-export:` of `ig-ast-refresh.yml` | runs the WHO scripts in `input/scripts/` (`generate_dak_from_sushi.py`, `update_sushi_config.py`, and, for an IG that declares `contentTypes.dak`, `dmn_questionnaire_generator.py`, `transform_dmn.py` and `inject_translations.py`) in a Python venv |
| DAK API sidecars | `ig-site:sidecars` (`smart-base/scripts/ig-site-sidecars.ts`) | **after** the AST is restored, when smart-base is the IG's `site.landing` | writes the API sidecars from the AST, labelled "DAK API" when the IG declares `contentTypes.dak`; the FHIR IG layer binds them to the artefact pages |

The WHO template comes in the same way: the caller passes
`template-repos: who.template.root=WorldHealthOrganization/smart-ig-template`.
Nothing else differs from the FHIR IG layer's route.
