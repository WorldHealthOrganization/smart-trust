# Specifies schemas/ui/window-stack.ts: the stack of open card windows on a
# board — open, close, raise, the topmost card and the z-index derived from
# the order — and, from kg/semantic-zoom.ts, the zoom-to-avatar answer the
# stack must stay separate from.
Feature: Card windows stack by order of opening and raising, separately from semantic zoom

  @test:schemas/ui/window-stack.test.ts::a_board_starts_with_nothing_open::`start_everyrting_in_avatar`_is_the_initial_state,_not_a_first_render
  Scenario: The empty stack has nothing open
    Given the empty window stack
    Then its open list is empty
    And it has no topmost card
    And it reports "anything" as not open

  @test:schemas/ui/window-stack.test.ts::open,_close,_raise::opening_puts_a_card_on_top
  Scenario: Opening puts a card on top
    When "a" and then "b" are opened
    Then the open list is "a", "b"
    And "b" is topmost

  @test:schemas/ui/window-stack.test.ts::open,_close,_raise::selecting_any_part_raises_it_—_the_owner's_words
  Scenario: Raising a lower card puts it on top
    Given "a" and then "b" opened
    When "a" is raised
    Then the open list is "b", "a"
    And "a" is topmost

  @test:schemas/ui/window-stack.test.ts::open,_close,_raise::opening_an_already-open_card_RAISES_it_rather_than_adding_a_second_entry
  Scenario: Opening an open card raises it
    Given "a" and then "b" opened
    When "a" is opened again
    Then the open list is "b", "a"
    And "a" appears once

  @test:schemas/ui/window-stack.test.ts::open,_close,_raise::raising_a_card_that_is_not_open_does_NOT_open_it
  Scenario: Raising a card that is not open does not open it
    Given the empty window stack
    When "a" is raised
    Then the open list is empty
    And "a" is not open

  @test:schemas/ui/window-stack.test.ts::open,_close,_raise::`[x]`_closes_back_to_the_avatar_and_leaves_the_rest_of_the_stack_in_order
  Scenario: Closing a card keeps the rest in order
    Given "a", "b" and "c" opened in that order
    When "b" is closed
    Then the open list is "a", "c"
    And "b" is not open

  @test:schemas/ui/window-stack.test.ts::open,_close,_raise::closing_something_that_is_not_open_is_a_no-op,_not_an_error
  Scenario: Closing a card that is not open changes nothing
    Given the empty window stack
    When "gone" is closed
    Then the open list is still empty

  @test:schemas/ui/window-stack.test.ts::open,_close,_raise::every_operation_returns_a_NEW_stack_—_the_input_is_never_mutated
  Scenario: Open, close and raise return new stacks and leave their input unchanged
    Given a stack with "a" open
    When "b" is opened on it, "a" is closed on it, and "a" is raised on it
    Then each result is a different object from the input, with a different open list
    And the opened stack is "a", "b"; the closed stack is empty; the raised stack is "a"
    And the input's open list is still "a"

  @test:schemas/ui/window-stack.test.ts::zIndexOf_derives_the_number_and_never_stores_it::bottom_to_top,_one-based
  Scenario: The z-index counts from one at the bottom
    Given "a" and then "b" opened
    Then the z-index of "a" is 1 and of "b" is 2

  @test:schemas/ui/window-stack.test.ts::zIndexOf_derives_the_number_and_never_stores_it::a_closed_card_gets_`undefined`,_not_0
  Scenario: A card that is not open has no z-index
    When the z-index of "a" is asked of the empty stack
    Then it is undefined
    And the z-index of "b" on a stack with only "a" open is undefined

  @test:schemas/ui/window-stack.test.ts::zIndexOf_derives_the_number_and_never_stores_it::no_two_open_cards_share_an_index
  Scenario: No two open cards share a z-index
    Given "a", "b", "c" and "d" opened
    When the z-index of each is taken
    Then all four are distinct

  @test:schemas/ui/window-stack.test.ts::the_two_mechanisms_stay_separate,_and_that_is_checked_rather_than_intended::zoom_is_falsified_in_BOTH_directions
  Scenario: Each zoom threshold is checked on both sides
    Given a semantic zoom with a folio threshold of 200px and a note threshold of 320px
    Then a chip renders as an avatar at 199px and not at 201px
    And a note renders as an avatar at 319px and not at 321px

  @test:schemas/ui/window-stack.test.ts::the_two_mechanisms_stay_separate,_and_that_is_checked_rather_than_intended::the_threshold_is_exclusive_at_the_boundary,_and_the_boundary_is_stated
  Scenario: The threshold is exclusive at the boundary
    Given the semantic zoom with a folio threshold of 200px
    Then a chip does not render as an avatar at exactly 200px

  @test:schemas/ui/window-stack.test.ts::the_two_mechanisms_stay_separate,_and_that_is_checked_rather_than_intended::an_override_is_TRACEABLE_—_the_resolver_says_where_the_number_came_from
  Scenario: The zoom threshold says where it came from
    Given the semantic zoom with a note override
    Then the threshold for "note" has source "kind"
    And the threshold for "chip" has source "folio"

  @test:schemas/ui/window-stack.test.ts::the_two_mechanisms_stay_separate,_and_that_is_checked_rather_than_intended::the_zoom_path_takes_no_window_state_at_all
  Scenario: The avatar answer takes three arguments
    When the declared arity of rendersAvatar is read
    Then it is 3

  @test:schemas/ui/window-stack.test.ts::the_two_mechanisms_stay_separate,_and_that_is_checked_rather_than_intended::an_open_window_is_unaffected_by_the_card's_zoom_answer
  Scenario: The stack reads the same whichever way the card's zoom answers
    Given a stack with "note-0" and then "note-1" open
    Then a note renders as an avatar at 100px and not at 400px
    And at each of those widths the stack's open list is unchanged, "note-1" is open and topmost, and its z-index is 2
    And the window-stack module imports nothing, so no zoom state can reach it
