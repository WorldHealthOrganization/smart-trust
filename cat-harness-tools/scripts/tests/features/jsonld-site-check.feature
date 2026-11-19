# verdictOf (scripts/jsonld-site-check.ts) folds the per-layer JSON-LD render results into the
# exit code of jsonld:site:check. Each Scenario names the test that executes it.
Feature: JSON-LD site check verdict

  @test:scripts/tests/jsonld-site-check.test.ts::jsonld:site:check_verdict_(owner,_2026-11-13:_merge_fails_if_the_JSON-LD_does_not_render)::every_layer_renders:_0
  Scenario: Every layer rendering gives exit 0
    Given two layer rows that both exited 0
    When the verdict is taken
    Then it is 0

  @test:scripts/tests/jsonld-site-check.test.ts::jsonld:site:check_verdict_(owner,_2026-11-13:_merge_fails_if_the_JSON-LD_does_not_render)::one_layer_fails:_1,_whatever_the_others
  Scenario: One failing layer gives exit 1 whatever the others
    Given layer rows that exited 0, 2 and 1
    When the verdict is taken
    Then it is 1

  @test:scripts/tests/jsonld-site-check.test.ts::jsonld:site:check_verdict_(owner,_2026-11-13:_merge_fails_if_the_JSON-LD_does_not_render)::could_not_determine_is_never_a_pass:_2
  Scenario: A layer that could not be determined is never a pass
    Given layer rows that exited 0 and 2
    When the verdict is taken
    Then it is 2

  @test:scripts/tests/jsonld-site-check.test.ts::jsonld:site:check_verdict_(owner,_2026-11-13:_merge_fails_if_the_JSON-LD_does_not_render)::no_layer:_not_applicable
  Scenario: No layers at all is not applicable
    Given no layer rows
    When the verdict is taken
    Then it is 78
