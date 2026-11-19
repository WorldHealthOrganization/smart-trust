# schemas/ui/note-anchor.js anchors a sticky note to a block, to a page (page-global), or to nothing,
# and moves or explicitly duplicates notes while keeping identity; beans carry no anchor.
# Each Scenario names the test that executes it.
Feature: Note anchors, moves and duplicates

  @test:schemas/note-anchor.test.ts::the_three_states_are_actually_three::page-global_and_unattached_are_NOT_the_same_value
  Scenario: A page-global anchor is distinguishable from no anchor
    Given a note anchored to the page "index"
    When its anchor is read
    Then the anchor is not the no-anchor value and its kind is "page"
    And a note with no anchor fields reads with kind "none"

  @test:schemas/note-anchor.test.ts::the_three_states_are_actually_three::page-global_carries_its_page_—_global_is_global_TO_A_PAGE
  Scenario: A page anchor must name its page
    When an anchor of kind "page" with no page is parsed
    Then parsing fails
    And an anchor of kind "page" with page "index" parses

  @test:schemas/note-anchor.test.ts::the_three_states_are_actually_three::an_unknown_kind_is_refused_rather_than_silently_ignored
  Scenario: An anchor of an unknown kind is refused
    When an anchor of kind "chapter" is parsed
    Then parsing fails

  @test:schemas/note-anchor.test.ts::the_three_states_are_actually_three::a_block_anchor_needs_a_label
  Scenario: A block anchor needs a non-empty label
    When an anchor of kind "block" with no label is parsed
    Then parsing fails
    And an anchor of kind "block" with an empty label fails to parse

  @test:schemas/note-anchor.test.ts::existing_notes_keep_working_—_the_old_field_is_read,_not_replaced::a_note_with_only_targetLabel_reads_as_block-attached
  Scenario: A note with only a target label reads as block-attached
    Given a note with targetLabel "sec:page-one" and no anchor
    When its anchor is read
    Then it is a block anchor with label "sec:page-one"

  @test:schemas/note-anchor.test.ts::existing_notes_keep_working_—_the_old_field_is_read,_not_replaced::an_explicit_anchor_wins_over_the_derived_one
  Scenario: An explicit anchor wins over the one derived from the target label
    Given a note with targetLabel "sec:old" and an anchor on page "index"
    When its anchor is read
    Then it is the page anchor on "index"

  @test:schemas/note-anchor.test.ts::existing_notes_keep_working_—_the_old_field_is_read,_not_replaced::isOnBlock_answers_from_either_field
  Scenario: A note is on a block whether it names it by target label or by block anchor
    Then a note with targetLabel "sec:a" is on block "sec:a"
    And a note with a block anchor labelled "sec:a" is on block "sec:a"
    And a note with a page anchor on "sec:a" is not on block "sec:a"

  @test:schemas/note-anchor.test.ts::existing_notes_keep_working_—_the_old_field_is_read,_not_replaced::an_unattached_note_is_never_page-global_for_any_page
  Scenario: An unattached note is not page-global
    Given a note with no anchor fields
    Then it is not page-global for page "index"

  @test:schemas/note-anchor.test.ts::a_move_re-anchors_—_it_does_not_re-create::the_id_survives
  Scenario: Moving a note keeps its id
    Given a note with id "t1"
    When it is moved to the block "sec:b"
    Then the moved note's id is "t1"

  @test:schemas/note-anchor.test.ts::a_move_re-anchors_—_it_does_not_re-create::targetLabel_is_kept_in_step,_so_an_older_reader_still_sees_the_truth
  Scenario: Moving a note to a block sets its target label to match
    Given a note with id "t1"
    When it is moved to the block "sec:b"
    Then its targetLabel is "sec:b"

  @test:schemas/note-anchor.test.ts::a_move_re-anchors_—_it_does_not_re-create::moving_to_a_page_or_to_nothing_CLEARS_the_stale_label
  Scenario: Moving to a page or to no anchor clears the target label
    Given a note moved onto the block "sec:a"
    When it is moved to the page "index"
    Then its targetLabel is undefined
    And when it is moved to no anchor its targetLabel is undefined

  @test:schemas/note-anchor.test.ts::a_move_re-anchors_—_it_does_not_re-create::a_move_between_pages_leaves_one_owner,_not_two
  Scenario: A move between pages leaves the note global only on the new page
    Given a note moved to the page "one" and then to the page "two"
    Then it is not page-global for "one"
    And it is page-global for "two"

  @test:schemas/note-anchor.test.ts::a_drop_never_implicitly_duplicates::duplicating_REQUIRES_a_new_id,_so_it_cannot_happen_by_accident
  Scenario: Duplicating a note takes the new id the caller gives
    # Gap: that duplicating cannot happen without a new id is a matter of the function's signature; the test does not exercise any path that omits one.
    Given a note with id "t1"
    When it is duplicated with id "t2" onto the block "sec:b"
    Then the copy's id is "t2"
    And the original's id is still "t1"

  @test:schemas/note-anchor.test.ts::a_drop_never_implicitly_duplicates::the_original_is_untouched_by_either_operation
  Scenario: Moving or duplicating leaves the original note unchanged
    Given a note "t1" with targetLabel "sec:a"
    When it is moved to the page "index" and duplicated as "t2" with no anchor
    Then the original still equals id "t1", summary "s", targetLabel "sec:a"

  @test:schemas/note-anchor.test.ts::a_drop_never_implicitly_duplicates::a_duplicate_is_a_separate_note_at_a_separate_anchor
  Scenario: A duplicate sits at its own anchor apart from the original
    Given a note moved to block "sec:a" and a duplicate "t2" at block "sec:b"
    Then the original is on "sec:a"
    And the duplicate is on "sec:b" and not on "sec:a"

  @test:schemas/note-anchor.test.ts::beans_carry_no_anchor_—_the_owner's_rule,_guarded::%s_does_not_reach_for_an_anchor
  Scenario: A bean module's source never refers to an anchor
    # Gap: a source-text check, not a runtime check of bean behaviour
    Given a bean module, for each of "schemas/sdlc/bean-graph.ts" and "src/workflow/bean-link.ts"
    When the file is read from the tools root
    Then the file exists
    And its text matches neither "NoteAnchor" nor the word "anchor", ignoring case

  @test:schemas/note-anchor.test.ts::one_primary,_declared_secondaries_—_the_owner's_CRDM_Q1_ruling::a_secondary_reference_does_not_change_where_the_note_is_attached
  Scenario: A secondary reference does not change the note's primary anchor
    Given a note with targetLabel "sec:page-one" that is also about "sec:page-two"
    When its anchor is read
    Then it is the block anchor on "sec:page-one"

  @test:schemas/note-anchor.test.ts::one_primary,_declared_secondaries_—_the_owner's_CRDM_Q1_ruling::a_note_with_no_list_reads_as_[]_rather_than_undefined
  Scenario: A note with no also-about list reads as an empty list
    Then a note without an also-about list gives an empty list of also-about labels
    And a note also about "sec:y" gives the labels "sec:y"

  @test:schemas/note-anchor.test.ts::one_primary,_declared_secondaries_—_the_owner's_CRDM_Q1_ruling::the_two_relations_come_back_split,_from_one_pass
  Scenario: Notes at a block come back split into attached and also-about
    Given note "a" on "sec:here", note "b" on "sec:elsewhere" also about "sec:here", and note "c" on "sec:elsewhere"
    When the notes at "sec:here" are read
    Then the attached notes are "a"
    And the also-about notes are "b"

  @test:schemas/note-anchor.test.ts::one_primary,_declared_secondaries_—_the_owner's_CRDM_Q1_ruling::a_note_attached_AND_also-about_the_same_node_counts_once,_as_attached
  Scenario: A note attached to and also about the same block counts once, as attached
    Given note "a" on "sec:here" that is also about "sec:here"
    When the notes at "sec:here" are read
    Then the attached notes are "a"
    And there are no also-about notes

  @test:schemas/note-anchor.test.ts::one_primary,_declared_secondaries_—_the_owner's_CRDM_Q1_ruling::the_badge_counts_PRIMARIES_—_R6_stays_true_with_secondaries_in_play
  Scenario: The badge counts only notes attached to the block
    Given note "a" on "sec:here" and note "b" on "sec:elsewhere" also about "sec:here"
    When the badge at "sec:here" is computed
    Then its count is 1 and it does not show the count

  @test:schemas/note-anchor.test.ts::one_primary,_declared_secondaries_—_the_owner's_CRDM_Q1_ruling::the_badge_shows_a_count_only_above_one,_and_keeps_the_exact_number
  Scenario: The badge shows its count only when more than one note is attached
    Given two notes with targetLabel "sec:here"
    When the badge at "sec:here" is computed
    Then its count is 2 and it shows the count
    And with no notes the count is 0 and it does not show the count

  @test:schemas/note-anchor.test.ts::one_primary,_declared_secondaries_—_the_owner's_CRDM_Q1_ruling::a_page-global_or_unattached_note_is_at_no_block
  Scenario: Page-global and unattached notes are at no block
    Given a note anchored to the page "index"
    Then no note is attached at "sec:here"
    And an unattached note gives no attached and no also-about notes at "sec:here"
