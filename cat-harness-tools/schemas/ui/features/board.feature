# Specifies schemas/ui/board.ts: the folio-board/v1 document, a board whose
# absent filter shows the whole folio (the owner's CRDM Q3 ruling) and whose
# filter is OR within an axis and AND across axes.
Feature: A board shows the whole folio unless its filter says otherwise

  Background:
    Given the nodes index/intro (prose), index/detail (table), guide/setup (prose) and guide/unkinded (no kind)

  @test:schemas/ui/board.test.ts::absent_filter_means_the_WHOLE_folio_—_the_default_that_cannot_go_stale::every_node_passes
  Scenario: A board with no filter shows every node
    Given a whole-folio board
    When its content is computed over the nodes
    Then it is all four nodes

  @test:schemas/ui/board.test.ts::absent_filter_means_the_WHOLE_folio_—_the_default_that_cannot_go_stale::a_node_with_no_kind_passes_too
  Scenario: A whole-folio board shows a node with no kind
    Given a whole-folio board
    When it is asked whether it shows guide/unkinded
    Then it does

  @test:schemas/ui/board.test.ts::absent_filter_means_the_WHOLE_folio_—_the_default_that_cannot_go_stale::content_added_later_needs_no_edit_to_the_board
  Scenario: Content added later is shown without editing the board
    Given a whole-folio board
    When its content is computed over the nodes plus a new node "arrived"
    Then "arrived" is among the nodes shown

  @test:schemas/ui/board.test.ts::a_filter_is_OR_within_an_axis,_AND_across_axes::pages_alone
  Scenario: A pages filter shows the nodes on those pages
    Given a board filtered to page "guide"
    When its content is computed
    Then it is "setup", "unkinded"

  @test:schemas/ui/board.test.ts::a_filter_is_OR_within_an_axis,_AND_across_axes::kinds_alone
  Scenario: A kinds filter shows the nodes of those kinds
    Given a board filtered to kind "prose"
    When its content is computed
    Then it is "intro", "setup"

  @test:schemas/ui/board.test.ts::a_filter_is_OR_within_an_axis,_AND_across_axes::both_axes_intersect_rather_than_union
  Scenario: Two axes intersect
    Given a board filtered to page "guide" and kind "prose"
    When its content is computed
    Then it is "setup" alone

  @test:schemas/ui/board.test.ts::a_filter_is_OR_within_an_axis,_AND_across_axes::two_values_on_one_axis_union
  Scenario: Two values on one axis union
    Given a board filtered to pages "index" and "guide"
    When its content is computed
    Then it is all four nodes

  @test:schemas/ui/board.test.ts::a_filter_is_OR_within_an_axis,_AND_across_axes::a_kinds_filter_EXCLUDES_a_node_with_no_kind_rather_than_passing_it
  Scenario: A kinds filter excludes a node with no kind
    Given a board filtered to kind "prose"
    When it is asked whether it shows guide/unkinded
    Then it does not

  @test:schemas/ui/board.test.ts::a_filter_is_OR_within_an_axis,_AND_across_axes::a_filter_matching_nothing_returns_EMPTY,_which_is_a_real_answer
  Scenario: A filter matching nothing gives an empty list
    Given a board filtered to page "absent"
    When its content is computed
    Then it is empty

  @test:schemas/ui/board.test.ts::document_order_is_preserved_—_the_collapsed_view_is_the_same_order::filtering_never_reorders
  Scenario: The board keeps the order it is given
    Given a whole-folio board and the nodes setup, intro, detail in that order
    When its content is computed
    Then it is setup, intro, detail in that order

  @test:schemas/ui/board.test.ts::the_document_declares_what_it_is,_and_refuses_the_ambiguous_states::a_board_without_the_tag_does_not_validate
  Scenario: A board without the schema tag does not validate
    Given a board with an id and title but no $schema tag
    When it is parsed with the board schema
    Then it is refused
    And a whole-folio board, which carries the tag, parses

  @test:schemas/ui/board.test.ts::the_document_declares_what_it_is,_and_refuses_the_ambiguous_states::an_EMPTY_axis_is_refused_—_it_reads_one_way_to_a_human_and_another_to_a_matcher
  Scenario: An empty filter axis is refused
    Given a board whose filter has pages set to an empty list
    When it is parsed
    Then it is refused

  @test:schemas/ui/board.test.ts::the_document_declares_what_it_is,_and_refuses_the_ambiguous_states::a_filter_with_no_axis_is_refused_—_omit_`filter`_instead
  Scenario: A filter with no axis is refused
    Given a board whose filter is an empty object
    When it is parsed
    Then it is refused

  @test:schemas/ui/board.test.ts::the_document_declares_what_it_is,_and_refuses_the_ambiguous_states::an_unknown_field_is_refused_rather_than_carried
  Scenario: An unknown field is refused
    Given a whole-folio board with an extra field notes
    When it is parsed
    Then it is refused

  @test:schemas/ui/board.test.ts::the_document_declares_what_it_is,_and_refuses_the_ambiguous_states::the_tag_names_this_version
  Scenario: The schema tag names this version
    When the board schema tag is read
    Then it is "folio-board/v1"

  @test:schemas/ui/board.test.ts::the_arrows_run_one_way_—_a_board_reaches_no_lower_than_content_ids::this_module_imports_no_note,_position_or_content_module
  Scenario: The board module imports only zod
    Given the source of schemas/ui/board.ts
    When its single-line import statements are read
    Then the only module imported is "zod"

  @test:schemas/ui/board.test.ts::the_arrows_run_one_way_—_a_board_reaches_no_lower_than_content_ids::a_board_carries_no_note_ids
  Scenario: The board source declares no note or position field
    Given the source of schemas/ui/board.ts
    When the four-space-indented field names are read
    Then none of them is "notes", "note", "positions", "x" or "y"
