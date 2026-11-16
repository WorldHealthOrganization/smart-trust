# The published todo index, asserted over the emitted file. Every test but one
# is skipped when the site is not built (docs:pages writes the file at publish).
# Each Scenario names the test that executes it.
Feature: Published todo index

  Background:
    Given the harness's published todo index "assets/todos/index.json" has been built

  @test:scripts/tests/todo-index.test.ts::the_artefact_answers_`what_am_I?`_from_itself::the_published_file_parses_against_the_schema_that_names_it
  Scenario: The published file parses against its schema
    Then the file exists and the todo-index schema reports no issues

  @test:scripts/tests/todo-index.test.ts::the_artefact_answers_`what_am_I?`_from_itself::the_tag_in_the_file_is_the_tag_the_module_declares
  Scenario: The file's $schema is the declared tag
    Then the file's $schema is the todo-index schema tag

  @test:scripts/tests/todo-index.test.ts::the_artefact_answers_`what_am_I?`_from_itself::an_UNDECLARED_field_fails_—_this_is_what_was_missing_while_three_landed_unnoticed
  Scenario: An undeclared field fails the schema
    When a field "surprise" is added to the first item
    Then the schema refuses it

  @test:scripts/tests/todo-index.test.ts::`target`_removes_a_burden_rather_than_adding_a_field::every_item_with_a_resolvable_label_carries_page_and_node
  Scenario: Every labelled item carries a target
    # Gap: the title says items with a RESOLVABLE label carry a target; the body requires a target of every item with any label.
    Then at least one item has a target label
    And every item with a target label has a target

  @test:scripts/tests/todo-index.test.ts::`target`_removes_a_burden_rather_than_adding_a_field::`targetLabel`_is_KEPT,_so_every_existing_matcher_still_works
  Scenario: The target label is kept
    Then every item with a target has a target label equal to the target's label

  @test:scripts/tests/todo-index.test.ts::`target`_removes_a_burden_rather_than_adding_a_field::the_pair_could_NOT_have_been_recovered_by_splitting_the_string
  Scenario: Splitting the label would not recover the page
    Then some item's target page contains "-"
    And splitting its label on "-" does not give the page

  @test:scripts/tests/todo-index.test.ts::`target`_removes_a_burden_rather_than_adding_a_field::a_label_naming_no_block_emits_NO_target_—_absent_is_the_third_state
  Scenario: A label naming no block resolves to no target
    Given a label map with "sec:page-node"
    Then "sec:nothing-here" and no label resolve to nothing
    And "sec:page-node" resolves to page "page", node "node" and its label

  @test:scripts/tests/todo-index.test.ts::`target`_removes_a_burden_rather_than_adding_a_field::an_absent_target_is_an_ABSENT_KEY,_never_null
  Scenario: An absent target is never null
    Then the file does not contain '"target": null'

  @test:scripts/tests/todo-index.test.ts::the_emitted_order_stays_a_function_of_the_contents::each_item's_keys_are_emitted_in_the_schema's_order,_`target`_beside_`targetLabel`
  Scenario: target follows targetLabel
    # Gap: the title says each item's keys follow the schema's order; only target's position after targetLabel in the first item with a target is checked.
    Then in the first item with a target, "target" is the key right after "targetLabel"

  @test:scripts/tests/todo-index.test.ts::the_emitted_order_stays_a_function_of_the_contents::the_nested_target's_own_keys_are_fixed
  Scenario: The target's keys are in a fixed order
    Then the first target object in the file has keys "page", "node", "label" in that order

  @test:scripts/tests/todo-index.test.ts::the_emitted_order_stays_a_function_of_the_contents::the_document_is_INDENTED_—_the_mergeability_property,_asserted
  Scenario: The document is indented
    Then the file has more than 10 lines and ends with a newline
