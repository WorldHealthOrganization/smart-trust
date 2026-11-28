# Stale paths: an open work item routing through finished work, and the
# false-positive classes that were measured and closed. Each Scenario names
# the test that executes it.
Feature: Stale paths through finished work

  @test:scripts/tests/stale-paths.test.ts::a_path_through_finished_work_is_a_finding::an_arrow_chain_routing_through_a_completed_bean
  Scenario: An arrow chain through a completed item is a finding
    Given an open item whose body chains b5f0 → 2krx → supn, with 2krx completed
    Then there is one "chain" finding through 2krx

  @test:scripts/tests/stale-paths.test.ts::a_path_through_finished_work_is_a_finding::the_ASCII_arrow_is_the_same_rule_—_the_corpus_uses_both
  Scenario: The ASCII arrow is the same rule
    Given the same chain written with "->"
    Then there is one finding

  @test:scripts/tests/stale-paths.test.ts::a_path_through_finished_work_is_a_finding::a_numbered_step_under_a_path_heading
  Scenario: A numbered step under a path heading is a finding
    Given a "Shortest path" heading with a step closing 2krx
    Then there is one "numbered-step" finding

  @test:scripts/tests/stale-paths.test.ts::a_path_through_finished_work_is_a_finding::a_scrapped_bean_counts_as_finished_too
  Scenario: A scrapped item counts as finished
    Given a chain through an item whose status is scrapped
    Then there is one finding

  @test:scripts/tests/stale-paths.test.ts::a_path_through_finished_work_is_a_finding::a_path_through_OPEN_work_is_not_a_finding
  Scenario: A path through open work is not a finding
    Given a chain through an item whose status is todo
    Then there is no finding

  @test:scripts/tests/stale-paths.test.ts::a_path_through_finished_work_is_a_finding::a_CLOSED_bean's_own_stale_path_is_not_reported_—_it_is_finished
  Scenario: A completed item's own stale path is not reported
    Given a completed item chaining through another completed item
    Then there is no finding

  @test:scripts/tests/stale-paths.test.ts::GUARD:_an_arrow_is_not_always_a_dependency::a_line-count_range_is_not_a_route,_even_with_a_closed_id_in_the_same_paragraph
  Scenario: A line-count range is not a route
    Given "README is 97 → 66 lines" in a line that also names the completed 2krx
    Then there is no finding

  @test:scripts/tests/stale-paths.test.ts::GUARD:_an_arrow_is_not_always_a_dependency::an_id_must_be_an_OPERAND_of_the_arrow,_not_merely_nearby
  Scenario: Only ids that are operands of an arrow are chain refs
    Then "`a1b2` → `c3d4`" yields a1b2 and c3d4
    And prose naming an id with no arrow yields nothing

  @test:scripts/tests/stale-paths.test.ts::GUARD:_a_bean_describing_ANOTHER_bean's_stale_path_is_not_stale::a_table_row_is_attributed_by_its_first_cell
  Scenario: A table row is attributed to its first cell
    Then a row whose first cell names p5wm and which quotes a chain through 2krx is attributed to p5wm

  @test:scripts/tests/stale-paths.test.ts::GUARD:_a_bean_describing_ANOTHER_bean's_stale_path_is_not_stale::a_quoted_chain_in_a_table_row_produces_no_finding
  Scenario: A quoted chain in another item's table row is not a finding
    Given an open item whose table row, attributed to p5wm, quotes a chain through completed 2krx
    Then there is no finding

  @test:scripts/tests/stale-paths.test.ts::GUARD:_a_bean_describing_ANOTHER_bean's_stale_path_is_not_stale::a_bean_stating_its_OWN_path_is_still_reported_—_the_guard_must_not_swallow_it
  Scenario: An item's own path is still reported
    Given an open item stating its own chain through completed 2krx
    Then there is one finding

  @test:scripts/tests/stale-paths.test.ts::a_numbered_step_is_only_a_path_when_its_heading_says_so::a_heading_naming_a_path_qualifies
  Scenario: A heading naming a path qualifies
    Then a step under "## Shortest path" is under a path heading

  @test:scripts/tests/stale-paths.test.ts::a_numbered_step_is_only_a_path_when_its_heading_says_so::an_ordinary_numbered_list_under_an_unrelated_heading_does_not
  Scenario: An unrelated heading does not qualify
    Then a step under "## Measured" is not under a path heading

  @test:scripts/tests/stale-paths.test.ts::a_numbered_step_is_only_a_path_when_its_heading_says_so::a_numbered_list_under_no_heading_at_all_does_not
  Scenario: No heading does not qualify
    Then a step with no heading above it is not under a path heading

  @test:scripts/tests/stale-paths.test.ts::an_unchecked_Done-when_clause_that_waits_on_finished_work::a_precondition_on_a_completed_bean_is_a_finding
  Scenario: An unchecked clause waiting on a completed item is a finding
    Given an unchecked Done-when box "migrated once `bbbb` is answered", with bbbb completed
    Then there is one "done-when" finding through bbbb, completed

  @test:scripts/tests/stale-paths.test.ts::an_unchecked_Done-when_clause_that_waits_on_finished_work::the_mirror_form_—_the_reference_first,_its_completion_after
  Scenario: The mirror form is a finding
    Given an unchecked box "`bbbb` fixed — before anything else"
    Then there is one "done-when" finding

  @test:scripts/tests/stale-paths.test.ts::an_unchecked_Done-when_clause_that_waits_on_finished_work::a_CHECKED_box_is_not_a_claim_about_what_remains
  Scenario: A checked box is not a finding
    Given a checked box waiting on bbbb
    Then there is no finding

  @test:scripts/tests/stale-paths.test.ts::an_unchecked_Done-when_clause_that_waits_on_finished_work::a_clause_that_ACTS_ON_a_finished_bean_is_correct_prose,_not_a_stale_path
  Scenario: A clause acting on a finished item is not a finding
    Given an unchecked box "`bbbb` and the others are re-read under that distinction"
    Then there is no finding

  @test:scripts/tests/stale-paths.test.ts::an_unchecked_Done-when_clause_that_waits_on_finished_work::an_OPEN_bean_named_as_a_precondition_is_not_a_finding
  Scenario: An open item as a precondition is not a finding
    Given an unchecked box waiting on cccc, which is todo
    Then there is no finding

  @test:scripts/tests/stale-paths.test.ts::an_unchecked_Done-when_clause_that_waits_on_finished_work::GUARD:_the_literal_words_"Done-when"_supply_neither_"when"_nor_"done"
  Scenario: The words "Done-when" are neither a precondition nor a completion
    Given an unchecked box naming bbbb's Done-when
    Then there is no finding
    And "`bbbb`'s Done-when is cited" does not assert bbbb is pending

  @test:scripts/tests/stale-paths.test.ts::an_unchecked_Done-when_clause_that_waits_on_finished_work::GUARD:_a_clause_does_not_borrow_the_NEXT_box's_precondition
  Scenario: A clause does not borrow the next box's precondition
    Given two unchecked boxes naming bbbb, only the second waiting on it
    Then there is one finding, on the second box's line

  @test:scripts/tests/stale-paths.test.ts::an_unchecked_Done-when_clause_that_waits_on_finished_work::a_clause_ends_at_a_dedent,_a_blank_line,_a_heading_or_the_next_box
  Scenario: A clause takes in its wrapped continuation and stops at the next box
    # Gap: only an indented continuation and the next box are exercised; a dedent, a blank line and a heading as clause ends are not.
    Given a box, an indented continuation line, and a second box
    Then the first clause is the box joined with its continuation
    And the continuation line starts no clause

  @test:scripts/tests/stale-paths.test.ts::an_unchecked_Done-when_clause_that_waits_on_finished_work::REACHABILITY:_the_rule_runs_on_an_ordinary_line,_not_only_under_a_path_heading
  Scenario: The Done-when rule runs outside a path heading
    Given an unchecked box waiting on bbbb between ordinary prose paragraphs
    Then there is one finding
