# A block's Lean reference is read from its lean object only, never from a
# simulator or computation ref. Each Scenario names the test that executes it.
Feature: The Lean ref is scoped to the lean object

  @test:scripts/tests/lean-ref-scoping.test.ts::parseLeanRef_is_scoped_to_the_lean_object::a_simulator_ref_is_not_a_lean_ref
  Scenario: A simulator ref is not a Lean ref
    Given a block manifest with a simulator ref and no lean object
    When its Lean ref is parsed
    Then there is none

  @test:scripts/tests/lean-ref-scoping.test.ts::parseLeanRef_is_scoped_to_the_lean_object::the_lean_ref_wins_even_when_another_ref:_comes_first
  Scenario: The Lean ref wins even when another ref comes first
    Given a simulator ref before the lean object's ref
    When the Lean ref is parsed
    Then it is the lean object's ref

  @test:scripts/tests/lean-ref-scoping.test.ts::parseLeanRef_is_scoped_to_the_lean_object::a_lean_ref_is_found_when_it_comes_first_too
  Scenario: A Lean ref that comes first is found
    Given a lean object's ref before a computation ref
    When the Lean ref is parsed
    Then it is the lean object's ref

  @test:scripts/tests/lean-ref-scoping.test.ts::parseLeanRef_is_scoped_to_the_lean_object::a_lean_block_with_no_ref_yields_undefined,_not_a_neighbour's
  Scenario: A lean object with no ref yields none, not a neighbour's
    Given a lean object without a ref followed by a simulator ref
    When the Lean ref is parsed
    Then there is none

  @test:scripts/tests/lean-ref-scoping.test.ts::parseLeanRef_is_scoped_to_the_lean_object::no_lean_block_at_all_yields_undefined
  Scenario: No lean object yields none
    Given only a computation ref
    When the Lean ref is parsed
    Then there is none

  @test:scripts/tests/lean-ref-scoping.test.ts::parseNestedStringField::a_nested_object_does_not_end_the_scan_early
  Scenario: A nested object does not end the scan early
    Given a lean object whose ref follows a nested object
    When lean.ref is read
    Then it is the ref after the nested object

  @test:scripts/tests/lean-ref-scoping.test.ts::parseNestedStringField::a_comment_before_the_outer_field_does_not_hide_it
  Scenario: A comment before the outer field does not hide it
    Given a line comment before the lean object
    When lean.ref is read
    Then it is the lean object's ref

  @test:scripts/tests/lean-ref-scoping.test.ts::parseNestedStringField::the_key_quoted_in_prose_does_not_win
  Scenario: The key quoted inside a string does not win
    Given a string field quoting a lean ref, before the real lean object
    When lean.ref is read
    Then it is the real lean object's ref

  @test:scripts/tests/lean-ref-scoping.test.ts::parseNestedStringField::an_outer_field_that_is_not_an_object_is_skipped,_not_mis-read
  Scenario: An outer field that is not an object is skipped
    Given a lean field bound to a variable, then a lean object
    When lean.ref is read
    Then it is the object's ref

  @test:scripts/tests/lean-ref-scoping.test.ts::parseNestedStringField::an_absent_outer_field_yields_undefined
  Scenario: An absent outer field yields none
    Given a bare ref with no lean object
    When lean.ref is read
    Then there is none
