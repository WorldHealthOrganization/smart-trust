# Phase 2 of validate.ts merges each vocabulary's constraint context into every
# block's (bean saqd). Skipped when no mathpaper vocabulary contributes one.
# Each Scenario names the test that executes it.
Feature: Validator composes vocabulary constraint context

  @test:scripts/tests/validate-vocabulary-context.test.ts::validate_composes_vocabulary_constraint_context::a_sibling_.lean_the_vocabulary_reads_reaches_its_rule
  Scenario: A sibling .lean reaches the kind-check rule
    Given a discovered mathpaper vocabulary with a constraint context
    And a chapter with proposition "prop:a"
    When the chapter is validated
    Then there is no "Kind mismatch: prop:a" issue
    When a sibling "prop-a.lean" stub is added and it is validated again
    Then there is one "Kind mismatch: prop:a" issue
