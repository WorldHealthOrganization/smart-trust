# scripts/bean-dedupe.ts plans the merge of copies of one bean held in several stores,
# choosing its home and merging text without loss, and says when it cannot.
# Each Scenario names the test that executes it.
Feature: Bean dedupe merging

  @test:test/bean-dedupe.test.ts::homeOf::a_prefix_names_its_home
  Scenario: A bean's id prefix names its home store
    Given bean "cat-tools-0nxe" taken by cat-harness-tools, and "folio-core-1abc" taken by folio-assistant-core
    When the home of each is computed
    Then their homes are "cat-harness-tools" and "folio-assistant-core"

  @test:test/bean-dedupe.test.ts::homeOf::a_bean_one_layer_took_belongs_to_that_layer
  Scenario: A bean taken by one layer belongs to that layer
    Given "folio-assistant-abcd" held by folio-assistant, cat-harness and cat-harness-tools
    When its home is computed
    Then its home is "cat-harness-tools"

  @test:test/bean-dedupe.test.ts::homeOf::taken_by_both_layers:_the_main_store_(owner,_2026-10-30)
  Scenario: A bean taken by both layers goes to the main store
    Given "folio-assistant-abcd" held by cat-harness-tools and folio-assistant-core
    When its home is computed
    Then its home is "folio-assistant"

  @test:test/bean-dedupe.test.ts::homeOf::everything_else_goes_to_the_main_store
  Scenario: Any other bean goes to the main store
    Given "folio-assistant-abcd" held by folio-assistant and cat-harness
    When its home is computed
    Then its home is "folio-assistant"

  @test:test/bean-dedupe.test.ts::merge3::two_dated_notes_appended_at_the_same_place:_both_kept
  Scenario: Two notes appended at the same place are both kept
    Given a base bean and two copies each appending a different note, updated on 2026-10-09 and 2026-10-10
    When the copies are merged three ways
    Then there are no conflicts
    And the text holds "Note from A." and "Note from B."
    And updated_at is the later 2026-10-10 value only
    And the merged header is valid

  @test:test/bean-dedupe.test.ts::merge3::one_side_closes_the_bean,_the_other_only_touches_the_body:_both_changes_land
  Scenario: A status change on one side and a body edit on the other both land
    Given one copy sets status completed and the other rewords the body to add "carefully"
    When the copies are merged three ways
    Then there are no conflicts
    And the text holds "status: completed" and "carefully"

  @test:test/bean-dedupe.test.ts::merge3::the_same_sentence_reworded_two_ways:_a_conflict,_ours_kept,_theirs_reported
  Scenario: The same sentence reworded two ways is one conflict, ours kept and theirs reported
    Given two copies rewording the same sentence "by the owner" and "by a person"
    When the copies are merged three ways
    Then there is exactly one conflict
    And it keeps "by the owner" and reports "by a person" as the other
    And the text carries no conflict markers

  @test:test/bean-dedupe.test.ts::resolveDiff3::text_without_conflict_markers_passes_through
  Scenario: Text without conflict markers passes through diff3 resolution
    Given the text "a\nb" with no conflict markers
    When it is resolved
    Then the result text is unchanged

  @test:test/bean-dedupe.test.ts::headerOk::a_duplicated_key_is_invalid
  Scenario: A header that repeats a key is invalid
    Given a front-matter header with "status" twice
    When the header is checked
    Then it is not ok

  @test:test/bean-dedupe.test.ts::settleStatus::a_stale_layer_copy_never_reopens_a_bean_the_branch_stores_closed_(9rq1)
  Scenario: A stale layer copy never reopens a bean the branch stores closed
    Given a newer in-progress copy in cat-harness-tools
    And older completed copies in folio-assistant and cat-harness
    When the status is settled on the cat-harness-tools text
    Then the status is "completed"

  @test:test/bean-dedupe.test.ts::settleStatus::completed_against_scrapped:_the_copy_updated_last_wins
  Scenario: Between completed and scrapped the copy updated last wins
    Given a completed copy updated 2026-10-20 and a scrapped copy updated 2026-10-25
    When the status is settled
    Then the status is "scrapped"

  @test:test/bean-dedupe.test.ts::settleStatus::copies_that_agree,_or_an_unknown_status,_leave_the_text_alone
  Scenario: Agreeing copies or an unknown status leave the text unchanged
    Given two copies both "todo", and two copies "todo" and "parked"
    When the status is settled for each pair
    Then the text is returned unchanged both times

  @test:test/bean-dedupe.test.ts::withConflictNotes::every_other_copy's_hunk_is_kept,_under_a_dated_section_per_store
  Scenario: Every other copy's conflicting hunk is kept under a dated section per store
    Given a bean text and a conflict whose other hunk from cat-harness contains a triple backtick
    And a header conflict with no text and store "-"
    When conflict notes are added dated 2026-10-30
    Then the output starts with the original text
    And it has the section "Merged from the cat-harness copy (bean dedupe, 2026-10-30)"
    And the other hunk is fenced with four backticks as text
    And the header is still valid

  @test:test/bean-dedupe.test.ts::withConflictNotes::no_conflicts:_the_text_is_unchanged
  Scenario: With no conflicts the text is unchanged
    Given a bean text
    When conflict notes are added for an empty conflict list
    Then the text is returned unchanged
