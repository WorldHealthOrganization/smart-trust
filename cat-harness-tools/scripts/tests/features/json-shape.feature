# missingTopLevelKeys (scripts/lib/json-shape.ts) gates the shape of a committed verdict
# projection, not its contents. Each Scenario names the test that executes it.
Feature: Top-level shape of a committed JSON projection

  @test:scripts/tests/json-shape.test.ts::missingTopLevelKeys_—_a_verdict_projection's_SHAPE_is_gated,_its_contents_are_not_(bean_324x)::a_field_the_generator_now_writes_and_the_committed_copy_lacks_is_reported
  Scenario: A top-level field the generator now writes and the committed copy lacks is reported
    Given a committed copy with keys "items" and "plan"
    And a generated copy with keys "items", "edges" and "plan"
    When the missing top-level keys are computed
    Then the result is "edges"

  @test:scripts/tests/json-shape.test.ts::missingTopLevelKeys_—_a_verdict_projection's_SHAPE_is_gated,_its_contents_are_not_(bean_324x)::contents_that_moved_are_NOT_a_finding
  Scenario: Contents that moved are not a finding
    Given a committed and a generated copy with the same keys but different values
    When the missing top-level keys are computed
    Then the result is empty

  @test:scripts/tests/json-shape.test.ts::missingTopLevelKeys_—_a_verdict_projection's_SHAPE_is_gated,_its_contents_are_not_(bean_324x)::a_field_the_committed_copy_has_and_the_generator_dropped_is_not_this_check's_question
  Scenario: A field the generator dropped is not reported
    Given a committed copy with keys "items" and "old" and a generated copy with only "items"
    When the missing top-level keys are computed
    Then the result is empty

  @test:scripts/tests/json-shape.test.ts::missingTopLevelKeys_—_a_verdict_projection's_SHAPE_is_gated,_its_contents_are_not_(bean_324x)::anything_that_is_not_a_JSON_object_on_both_sides_yields_nothing
  Scenario: Input that is not a JSON object on both sides yields nothing
    Given a committed copy that is not JSON, and separately one that is a JSON array
    When each is compared with a generated JSON object
    Then both results are empty
