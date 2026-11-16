# scripts/check-bean-bodies.ts reads bean bodies and reports a shadow checklist: a later ticked item restating a canonical "## Done when" item that is still open.
# It also decides what reads as a quotation of a blocker, and counts closed beans with the shape without failing them. Each Scenario names the test that executes it.
Feature: Bean body checks

  @test:scripts/tests/check-bean-bodies.test.ts::checklistItems::an_indented_continuation_belongs_to_its_item
  Scenario: An indented continuation line belongs to its checklist item
    Given an open checklist item "the first half" followed by an indented "and the second half"
    When checklistItems reads it
    Then the item text is "the first half and the second half"
    And the item is open

  @test:scripts/tests/check-bean-bodies.test.ts::checklistItems::reads_both_tick_spellings_and_stops_at_a_non-continuation_line
  Scenario: Both tick spellings are read and a blank-and-prose line does not swallow later items
    Given items ticked "[x]" and "[X]", then prose, then an open item
    When checklistItems reads them
    Then their done flags are true, true and false

  @test:scripts/tests/check-bean-bodies.test.ts::splitChecklist::a_bean_with_no_`##_Done_when`_has_no_checklist_to_compare
  Scenario: A bean with no Done when section has no checklist to compare
    Given prose and a stray checkbox but no "## Done when" heading
    When splitChecklist reads it
    Then both the canonical and the later lists are empty

  @test:scripts/tests/check-bean-bodies.test.ts::splitChecklist::the_canonical_section_ends_at_the_next_heading
  Scenario: The canonical section ends at the next heading
    Given a "## Done when" item followed by a "## Later" heading with a ticked item
    When splitChecklist reads it
    Then there is 1 canonical item and 1 later item

  @test:scripts/tests/check-bean-bodies.test.ts::splitChecklist_—_the_separator_that_was_missing::a_`---`_rule_ends_the_canonical_section
  Scenario: A horizontal rule ends the canonical section
    Given an open "## Done when" item, a "---" rule, and a ticked copy of the item after it
    When splitChecklist reads it
    Then there is 1 canonical item and 1 later item
    And shadowedItems reports 1 shadowed item

  @test:scripts/tests/check-bean-bodies.test.ts::splitChecklist_—_the_separator_that_was_missing::whichever_comes_FIRST_ends_it_—_a_rule_before_a_heading
  Scenario: A rule before a heading ends the canonical section at the rule
    Given a "## Done when" item, then a "---" rule, an item, a "## Later" heading and another item
    When splitChecklist reads it
    Then there is 1 canonical item

  @test:scripts/tests/check-bean-bodies.test.ts::splitChecklist_—_the_separator_that_was_missing::...and_a_heading_before_a_rule
  Scenario: A heading before a rule ends the canonical section at the heading
    Given a "## Done when" item, then a "## Later" heading, an item and a "---" rule
    When splitChecklist reads it
    Then there is 1 canonical item

  @test:scripts/tests/check-bean-bodies.test.ts::splitChecklist_—_the_separator_that_was_missing::a_table's_`|---|`_is_not_a_rule
  Scenario: A table's separator row is not a rule
    Given a "## Done when" item followed by a markdown table with a "|---|---|" row
    When splitChecklist reads it
    Then the later list is empty

  @test:scripts/tests/check-bean-bodies.test.ts::overlap::containment,_not_equality_—_the_real_copies_were_not_verbatim
  Scenario: Overlap measures containment, so a copy with an inserted parenthetical still overlaps fully
    Given an item and a copy of it with "(or the goal-review sweep)" inserted
    When their word overlap is computed
    Then it is 1

  @test:scripts/tests/check-bean-bodies.test.ts::overlap::unrelated_items_do_not_overlap
  Scenario: Unrelated items barely overlap
    Given "render the navbar tile" and "resolve a workflow path"
    When their word overlap is computed
    Then it is below 0.3

  @test:scripts/tests/check-bean-bodies.test.ts::shadowedItems_—_the_defect::a_later_TICKED_item_restating_an_OPEN_canonical_one_is_the_defect
  Scenario: A later ticked item restating an open canonical one is reported
    Given a bean whose open Done when item is repeated verbatim and ticked under a later heading
    When shadowedItems reads it
    Then 1 shadowed item is reported

  @test:scripts/tests/check-bean-bodies.test.ts::shadowedItems_—_the_defect::...and_it_still_fires_when_the_copy_paraphrases
  Scenario: A ticked paraphrase of an open canonical item is still reported
    Given an open item about schema validation and profile check as distinct operations
    And a later ticked item about schema validation as its operation
    When shadowedItems reads it
    Then 1 shadowed item is reported

  @test:scripts/tests/check-bean-bodies.test.ts::shadowedItems_—_what_it_must_NOT_report::a_NEW_open_item_below_the_section_is_the_store's_ordinary_idiom
  Scenario: A new open item below the canonical section is not reported
    Given an open canonical item and a different open item under a later heading
    When shadowedItems reads it
    Then nothing is reported

  @test:scripts/tests/check-bean-bodies.test.ts::shadowedItems_—_what_it_must_NOT_report::a_progress_note_restating_an_item_the_canonical_section_ALREADY_ticks
  Scenario: A ticked progress note restating an already ticked canonical item is not reported
    Given a ticked canonical item and a later ticked copy ending "— shipped"
    When shadowedItems reads it
    Then nothing is reported

  @test:scripts/tests/check-bean-bodies.test.ts::shadowedItems_—_what_it_must_NOT_report::an_UNTICKED_later_copy_of_an_open_canonical_item
  Scenario: An unticked later copy of an open canonical item is not reported
    Given an open canonical item and an identical open item under a later heading
    When shadowedItems reads it
    Then nothing is reported

  @test:scripts/tests/check-bean-bodies.test.ts::shadowedItems_—_what_it_must_NOT_report::a_short_item_is_too_generic_for_overlap_to_mean_anything
  Scenario: A short item is too generic for overlap to count
    Given an open canonical item "ship it" and a later ticked "ship it"
    Then "ship it" has fewer words than SHADOW_MIN_WORDS
    And shadowedItems reports nothing

  @test:scripts/tests/check-bean-bodies.test.ts::shadowedItems_—_what_it_must_NOT_report::a_bean_with_no_canonical_section_reports_nothing
  Scenario: A bean with no canonical section reports no shadowed item
    Given prose and a ticked item with no "## Done when" heading
    When shadowedItems reads it
    Then nothing is reported

  @test:scripts/tests/check-bean-bodies.test.ts::insideQuotation_—_what_marks_a_quotation,_and_what_does_not::a_plain_assertion_is_not_a_quotation
  Scenario: A plain blocker assertion is not a quotation
    Given the line "Blocked on `hqku` until that lands."
    When insideQuotation is asked about the blocker match
    Then it answers false

  @test:scripts/tests/check-bean-bodies.test.ts::insideQuotation_—_what_marks_a_quotation,_and_what_does_not::double_quotes_on_the_line_mark_one_—_this_is_the_whole_signal
  Scenario: Double quotes around the blocker mark it as a quotation
    Given a line quoting "blocked on `hqku`" in double quotes
    When insideQuotation is asked about the blocker match
    Then it answers true

  @test:scripts/tests/check-bean-bodies.test.ts::insideQuotation_—_what_marks_a_quotation,_and_what_does_not::an_UNQUOTED_table_cell_is_an_assertion,_and_must_stay_one
  Scenario: An unquoted table cell stating a blocker is an assertion
    Given a table row whose cell says "blocked on `slw1`, see above" without quotes
    When insideQuotation is asked about the blocker match
    Then it answers false

  @test:scripts/tests/check-bean-bodies.test.ts::insideQuotation_—_what_marks_a_quotation,_and_what_does_not::a_QUOTED_table_cell_is_read_as_a_quotation,_so_the_marking_works
  Scenario: A quoted table cell stating a blocker is a quotation
    Given a table row whose cell holds "blocked on `hqku`, and on the disposition" in double quotes
    When insideQuotation is asked about the blocker match
    Then it answers true

  @test:scripts/tests/check-bean-bodies.test.ts::insideQuotation_—_what_marks_a_quotation,_and_what_does_not::a_blockquote_is_NOT_read_—_priced,_not_missed
  Scenario: A blockquote is not read as a quotation
    Given the line "> blocked on `hqku`"
    When insideQuotation is asked about the blocker match
    Then it answers false

  @test:scripts/tests/check-bean-bodies.test.ts::insideQuotation_—_what_marks_a_quotation,_and_what_does_not::emphasis_is_not_attribution
  Scenario: Emphasis is not attribution
    Given a line with the blocker in asterisk emphasis
    When insideQuotation is asked about the blocker match
    Then it answers false

  @test:scripts/tests/check-bean-bodies.test.ts::closed_beans_are_COUNTED,_never_failed::a_completed_bean_with_the_shape_is_counted,_and_does_not_fail
  Scenario: A completed bean with the shadow shape is counted and does not fail
    Given a bean store with one completed bean whose open Done when item is ticked under "## Progress"
    When checkBeanBodies runs
    Then closedWithShadow is 1
    And there are no problems
    And no bean is examined

  @test:scripts/tests/check-bean-bodies.test.ts::closed_beans_are_COUNTED,_never_failed::an_OPEN_bean_with_the_same_body_still_fails_—_the_rule_is_unchanged
  Scenario: An open bean with the shadow shape still fails
    Given a bean store with one in-progress bean with the shadow shape
    When checkBeanBodies runs
    Then the problems include a "shadow-checklist"
    And closedWithShadow is 0

  @test:scripts/tests/check-bean-bodies.test.ts::closed_beans_are_COUNTED,_never_failed::an_archived_bean_counts_too_—_archived_is_closed,_not_invisible
  Scenario: An archived closed bean with the shadow shape is counted too
    Given a bean store with one completed archived bean with the shadow shape
    When checkBeanBodies runs
    Then closedWithShadow is 1

  @test:scripts/tests/check-bean-bodies.test.ts::closed_beans_are_COUNTED,_never_failed::a_closed_bean_WITHOUT_the_shape_is_not_counted
  Scenario: A closed bean without the shadow shape is not counted
    Given a bean store with one completed bean whose only Done when item is ticked
    When checkBeanBodies runs
    Then closedWithShadow is 0

  @test:scripts/tests/check-bean-bodies.test.ts::closed_beans_are_COUNTED,_never_failed::an_unreadable_store_reports_0_but_also_`store:_false`_—_not_a_clean_count
  Scenario: An unreadable bean store reports store false alongside the zero count
    Given an empty directory with no bean store
    When checkBeanBodies runs
    Then store is false
    And closedWithShadow is 0
