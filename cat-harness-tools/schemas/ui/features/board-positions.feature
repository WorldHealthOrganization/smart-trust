# Specifies schemas/ui/board-positions.ts: the board-positions layer (bean
# 6lb8), a map of board to note id to coordinates that sits on top of notes,
# whose order is a function of its contents and whose shape holds at most one
# position per note per board.
Feature: Board positions are a deterministic layer over notes, one position per note per board

  @test:schemas/ui/board-positions.test.ts::the_order_is_a_function_of_the_contents,_not_of_the_writer::boards_and_notes_both_sort_ascending
  Scenario: Boards and notes both sort ascending
    Given a positions document with boards "zulu" and "alpha", and notes "c" and "a" on "alpha"
    When it is sorted
    Then the boards come out as "alpha", "zulu"
    And the notes on "alpha" come out as "a", "c"

  @test:schemas/ui/board-positions.test.ts::the_order_is_a_function_of_the_contents,_not_of_the_writer::sorting_is_IDEMPOTENT_—_a_save_of_unchanged_state_is_a_no-op_diff
  Scenario: Rendering a sorted document gives the same text as rendering it unsorted
    Given the sample document with notes "zebra" and "apple" on board "landing"
    When it is rendered directly, and rendered after sorting
    Then the two texts are identical

  @test:schemas/ui/board-positions.test.ts::the_order_is_a_function_of_the_contents,_not_of_the_writer::insertion_order_does_not_reach_the_output
  Scenario: Insertion order does not reach the rendered output
    Given two documents holding the same boards and notes, built in opposite insertion order
    When each is rendered
    Then the two texts are identical

  @test:schemas/ui/board-positions.test.ts::the_order_is_a_function_of_the_contents,_not_of_the_writer::note_keys_are_rebuilt_in_order,_not_merely_iterated_in_order
  Scenario: Sorting rebuilds the note keys in order
    Given a board with notes "zed" and "abe" inserted in that order
    When the document is sorted
    Then the board serialises with JSON.stringify as "abe" before "zed"

  @test:schemas/ui/board-positions.test.ts::the_order_is_a_function_of_the_contents,_not_of_the_writer::the_sort_is_not_locale-dependent
  Scenario: The sort is by code point, not by locale
    Given a board with notes "a-b" and "ab", a pair a locale collation reorders
    When the document is sorted
    Then the notes come out as "a-b", "ab"

  @test:schemas/ui/board-positions.test.ts::one_position_per_note_per_board_—_in_the_TYPE,_not_in_one_function::the_shape_cannot_express_a_note_twice_on_one_board
  Scenario: The schema refuses a board written as a list with one note twice
    Given a document whose board "landing" is an array with two entries for note "n"
    When it is parsed with the board-positions schema
    Then it is refused

  @test:schemas/ui/board-positions.test.ts::one_position_per_note_per_board_—_in_the_TYPE,_not_in_one_function::placing_twice_replaces_rather_than_appends
  Scenario: Placing a note twice replaces its position
    Given note "n" placed on "landing" at (1, 1)
    When it is placed again on "landing" at (9, 9)
    Then "landing" holds only "n" at (9, 9)

  @test:schemas/ui/board-positions.test.ts::one_position_per_note_per_board_—_in_the_TYPE,_not_in_one_function::a_note_may_sit_on_SEVERAL_boards_at_different_places
  Scenario: A note may sit on several boards at different places
    Given note "n" placed on "landing" at (1, 1) and on "review" at (5, 5)
    When its position is asked on each board
    Then it is (1, 1) on "landing" and (5, 5) on "review"

  @test:schemas/ui/board-positions.test.ts::one_position_per_note_per_board_—_in_the_TYPE,_not_in_one_function::unplacing_returns_the_note_to_having_no_position,_which_is_a_real_state
  Scenario: Unplacing a note leaves it with no position
    Given note "n" placed on "landing"
    When it is unplaced from "landing"
    Then "landing" is an empty map
    And the position of "n" on "landing" is undefined

  @test:schemas/ui/board-positions.test.ts::one_position_per_note_per_board_—_in_the_TYPE,_not_in_one_function::unplacing_from_a_board_that_does_not_exist_is_a_no-op,_not_a_throw
  Scenario: Unplacing from an unknown board changes nothing
    Given an empty positions document
    When note "n" is unplaced from board "nope"
    Then the result equals an empty positions document

  @test:schemas/ui/board-positions.test.ts::one_position_per_note_per_board_—_in_the_TYPE,_not_in_one_function::unplacing_a_note_that_was_never_placed_leaves_the_document_alone
  Scenario: Unplacing a note that was never placed returns the same document
    Given a document with only note "other" placed on "landing"
    When note "n" is unplaced from "landing"
    Then the very same document object is returned

  @test:schemas/ui/board-positions.test.ts::one_position_per_note_per_board_—_in_the_TYPE,_not_in_one_function::a_position_carries_no_note_of_its_own
  Scenario: A position may not carry a note field
    Given a position keyed by "n" that also has a field note "n"
    When the document is parsed
    Then it is refused

  @test:schemas/ui/board-positions.test.ts::a_map_is_the_right_storage;_a_list_is_the_right_thing_to_render::positionsOn_returns_each_note_with_the_id_it_is_keyed_by,_in_order
  Scenario: Listing a board gives each note with its id, in order
    Given the sample document with "zebra" at (3, 4) and "apple" at (1, 2) on "landing"
    When the positions on "landing" are listed
    Then the list is "apple" at (1, 2) then "zebra" at (3, 4), each carrying its note id

  @test:schemas/ui/board-positions.test.ts::a_map_is_the_right_storage;_a_list_is_the_right_thing_to_render::an_unknown_board_is_EMPTY,_not_an_exception
  Scenario: Listing an unknown board gives an empty list
    Given an empty positions document
    When the positions on "landing" are listed
    Then the list is empty

  @test:schemas/ui/board-positions.test.ts::a_map_is_the_right_storage;_a_list_is_the_right_thing_to_render::positionsOn_does_not_mutate,_and_its_result_is_not_aliased_into_the_document
  Scenario: Editing a listed position does not reach the document
    Given the sample document and its rendered text
    When the positions on "landing" are listed and the first entry's x is set to 999
    Then the document still renders to the same text

  @test:schemas/ui/board-positions.test.ts::orphans_are_reported,_never_removed::a_position_whose_note_is_gone_is_listed
  Scenario: A position whose note is gone is reported
    Given the sample document and a set of known notes holding only "apple"
    When orphans are asked for
    Then the one orphan is note "zebra" on board "landing"

  @test:schemas/ui/board-positions.test.ts::orphans_are_reported,_never_removed::and_nothing_is_reported_when_every_note_resolves
  Scenario: No orphan is reported when every note resolves
    Given the sample document and known notes "apple" and "zebra"
    When orphans are asked for
    Then none is reported

  @test:schemas/ui/board-positions.test.ts::orphans_are_reported,_never_removed::the_document_is_not_mutated_by_asking
  Scenario: Asking for orphans leaves the document asked about unchanged
    Given the sample document and its rendered text
    When orphans are asked for on that document with no known notes
    Then both of its positions are reported as orphans
    And the same document still renders to the same text

  @test:schemas/ui/board-positions.test.ts::the_arrow_runs_ONE_way_—_a_note_knows_nothing_about_a_board::no_note_schema_carries_a_position_or_a_board
  Scenario: No note schema declares a position or a board field
    Given the sources of sdlc/todo.ts, kg/carried-note.ts, content/landing-sticky.ts and ui/note-anchor.ts
    When the two-space-indented field names are read from each
    Then none of them is "x", "y", "board" or "position"

  @test:schemas/ui/board-positions.test.ts::the_arrow_runs_ONE_way_—_a_note_knows_nothing_about_a_board::this_module_imports_no_note_module
  Scenario: The board-positions module imports only zod
    Given the source of schemas/ui/board-positions.ts
    When its single-line import statements are read
    Then the only module imported is "zod"

  @test:schemas/ui/board-positions.test.ts::the_document_declares_what_it_is::a_file_without_the_tag_does_not_validate
  Scenario: A document without the schema tag does not validate
    Given a document with boards but no $schema tag
    When it is parsed
    Then it is refused
    And an empty positions document, which carries the tag, parses

  @test:schemas/ui/board-positions.test.ts::the_document_declares_what_it_is::an_empty_document_is_VALID_—_a_folio_with_no_board_yet
  Scenario: The empty positions document has no boards and is valid
    Given an empty positions document
    When its boards are listed
    Then there are none
    And the document validates against the board-positions schema

  @test:schemas/ui/board-positions.test.ts::the_document_declares_what_it_is::a_non-finite_coordinate_is_refused
  Scenario: A non-finite coordinate is refused
    Given a position with x NaN
    When the document is parsed
    Then it is refused

  @test:schemas/ui/board-positions.test.ts::the_document_declares_what_it_is::an_empty_note_id_is_refused_—_a_key_that_names_nothing
  Scenario: An empty note id is refused
    Given a position keyed by the empty string
    When the document is parsed
    Then it is refused

  @test:schemas/ui/board-positions.test.ts::the_document_declares_what_it_is::it_renders_indented,_one_position_per_line-block
  Scenario: The rendered document is indented with one block per position
    Given the sample document with two notes on one board
    When it is rendered
    Then exactly two lines open a note block at six spaces of indent
    And the text ends with a newline

  @test:schemas/ui/board-positions.test.ts::moveBy_—_a_move_edits_the_LAYER_and_reaches_no_note::a_delta_is_applied_to_the_note's_current_position
  Scenario: A move adds the delta to the current position
    Given note "n1" at (10, 20) and "n2" at (0, 0) on board "b"
    When "n1" is moved by (5, -3)
    Then "n1" is at (15, 17)

  @test:schemas/ui/board-positions.test.ts::moveBy_—_a_move_edits_the_LAYER_and_reaches_no_note::a_note_that_is_NOT_placed_is_not_moved,_and_does_not_appear
  Scenario: Moving a note that is not placed gives no document
    Given notes "n1" and "n2" placed on board "b"
    When "never-placed" is moved on "b", and "n1" is moved on "no-such-board"
    Then each move returns undefined

  @test:schemas/ui/board-positions.test.ts::moveBy_—_a_move_edits_the_LAYER_and_reaches_no_note::it_returns_a_NEW_document_and_leaves_the_old_one_alone
  Scenario: A move returns a new document and leaves the original unchanged
    Given the placed document and its rendered text
    When "n1" is moved by (100, 100)
    Then the result is a different object from the original, as are its boards and board "b"
    And in the result "n1" is at (110, 120)
    And the original document still renders to the same text

  @test:schemas/ui/board-positions.test.ts::moveBy_—_a_move_edits_the_LAYER_and_reaches_no_note::moving_one_note_leaves_every_other_position_untouched
  Scenario: Moving one note leaves the others where they were
    Given note "n1" at (10, 20) and "n2" at (0, 0) on board "b"
    When "n1" is moved by (7, 7)
    Then "n2" is still at (0, 0)

  @test:schemas/ui/board-positions.test.ts::moveBy_—_a_move_edits_the_LAYER_and_reaches_no_note::a_note_still_appears_at_most_ONCE_on_a_board_after_a_move
  Scenario: Two moves keep one entry for the note
    Given note "n1" at (10, 20) on board "b"
    When it is moved by (1, 1) twice
    Then board "b" has one key "n1"
    And "n1" is at (12, 22)

  @test:schemas/ui/board-positions.test.ts::moveBy_—_a_move_edits_the_LAYER_and_reaches_no_note::a_zero_delta_is_a_no-op_in_value,_not_a_refusal
  Scenario: A zero move returns a document with the position unchanged
    Given note "n1" at (10, 20) on board "b"
    When it is moved by (0, 0)
    Then a document is returned with "n1" still at (10, 20)
