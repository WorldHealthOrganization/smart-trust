# Specifies schemas/content/reader-filter.ts: a reader's filter (visibleOn,
# readerShows, readerFilterProblem, propertyValues), which narrows what a board
# shows with the board filter's own logic and commits nothing.
Feature: A reader's filter narrows their view of a board and commits nothing

  Background:
    Given the nodes, in document order:
      | page | node | kind | status | priority |
      | one  | a    | todo | open   | high     |
      | one  | b    | todo | done   | high     |
      | two  | c    | bean | open   | low      |
      | two  | d    | todo | open   | low      |
      | two  | e    |      |        |          |
    And a whole-folio board "all", and a board "one" filtered to page "one"

  @test:schemas/content/reader-filter.test.ts::an_absent_filter_filters_nothing::every_node_the_board_shows_stays_shown
  Scenario: No reader filter keeps every node a board shows, and is no problem
    When the nodes are filtered with no reader filter
    Then all five nodes are visible, in order
    And the absent filter has no problem
    When the content of the page-one board, and of the whole-folio board, is filtered with no reader filter
    Then for each board the visible nodes are exactly the nodes it shows, the same objects in the same order, and there is at least one

  @test:schemas/content/reader-filter.test.ts::OR_within_an_axis,_AND_across_—_the_declared_filter's_logic,_deliberately::two_kinds_is_a_union
  Scenario: Two kinds is a union
    When the nodes are filtered to the kinds "todo" and "bean"
    Then "a", "b", "c" and "d" are visible

  @test:schemas/content/reader-filter.test.ts::OR_within_an_axis,_AND_across_—_the_declared_filter's_logic,_deliberately::two_properties_is_an_intersection
  Scenario: Two properties is an intersection
    When the nodes are filtered to status "open" and priority "high"
    Then only "a" is visible

  @test:schemas/content/reader-filter.test.ts::OR_within_an_axis,_AND_across_—_the_declared_filter's_logic,_deliberately::values_within_one_property_are_a_union
  Scenario: Values within one property are a union
    When the nodes are filtered to priority "high" or "low"
    Then "a", "b", "c" and "d" are visible

  @test:schemas/content/reader-filter.test.ts::OR_within_an_axis,_AND_across_—_the_declared_filter's_logic,_deliberately::kind_and_properties_are_an_intersection_too
  Scenario: Kind and properties are an intersection
    When the nodes are filtered to the kind "todo" and status "open"
    Then "a" and "d" are visible

  @test:schemas/content/reader-filter.test.ts::a_node_that_cannot_answer_has_not_answered_YES::no_kind_is_excluded_by_a_kind_filter
  Scenario: A node with no kind fails a kind filter
    When a node with no kind is checked against the kind "todo"
    Then it is not shown

  @test:schemas/content/reader-filter.test.ts::a_node_that_cannot_answer_has_not_answered_YES::a_missing_property_is_excluded_by_a_filter_on_it
  Scenario: A node missing a property fails a filter on it
    When a "todo" node with no properties is checked against status "open"
    Then it is not shown

  @test:schemas/content/reader-filter.test.ts::a_node_that_cannot_answer_has_not_answered_YES::but_it_survives_a_filter_that_does_not_ask
  Scenario: A node with nothing passes no filter
    When a node with no kind and no properties is checked against no reader filter
    Then it is shown

  @test:schemas/content/reader-filter.test.ts::an_EMPTY_axis_is_refused_rather_than_read_as_`match_nothing`::a_kind_filter_with_nothing_selected_is_a_problem,_named
  Scenario: A kind filter with nothing selected is a problem
    When the filter with an empty kind list is checked
    Then its problem says "nothing selected"

  @test:schemas/content/reader-filter.test.ts::an_EMPTY_axis_is_refused_rather_than_read_as_`match_nothing`::so_is_a_property_filter_with_nothing_selected,_and_it_names_WHICH
  Scenario: A property filter with nothing selected is a problem naming the property
    When the filter with an empty "status" list is checked
    Then its problem names "status" and says "nothing selected"

  @test:schemas/content/reader-filter.test.ts::an_EMPTY_axis_is_refused_rather_than_read_as_`match_nothing`::a_populated_axis_is_not_a_problem
  Scenario: A populated filter is not a problem
    When the filter to the kind "todo" and status "open" is checked
    Then it has no problem

  @test:schemas/content/reader-filter.test.ts::the_reader's_filter_can_only_NARROW::its_result_is_always_a_subset_of_what_the_board_shows
  Scenario: The reader's result is within what the board shows
    Given the nodes board "one" shows
    When they are filtered with no filter, "todo", "bean", status "open", priority "low", and "todo" with status "done"
    Then every visible node is one the board shows, and there are no more of them, for each filter

  @test:schemas/content/reader-filter.test.ts::the_reader's_filter_can_only_NARROW::a_reader_cannot_see_past_the_board's_declared_scope
  Scenario: A reader cannot see past the board's scope
    When the nodes board "one" shows are filtered to the kind "bean"
    Then nothing is visible
    When the nodes the whole-folio board shows are filtered to the kind "bean"
    Then "c" is visible

  @test:schemas/content/reader-filter.test.ts::the_reader's_filter_can_only_NARROW::document_order_is_preserved,_because_the_linear_floor_renders_it
  Scenario: Document order is preserved
    When the nodes are filtered to status "open"
    Then "a", "c" and "d" are visible, in that order

  @test:schemas/content/reader-filter.test.ts::it_commits_NOTHING_—_the_separation,_asserted_rather_than_named::filtering_leaves_the_board's_own_declaration_byte-identical
  Scenario: Filtering leaves the board's declaration unchanged
    When the nodes board "one" shows are filtered to "todo" with status "done"
    Then board "one" serialises to the same JSON as before

  @test:schemas/content/reader-filter.test.ts::it_commits_NOTHING_—_the_separation,_asserted_rather_than_named::and_leaves_the_layout_document_byte-identical
  Scenario: Filtering leaves the layout document unchanged
    Given a board-positions document placing "a" at (1, 2) and "b" at (3, 4) on board "one"
    When the nodes are filtered to the kind "bean"
    Then only "c" is visible
    And the positions document renders the same as before
    And "a" and "b", both filtered out, keep their positions
    When the document is deeply frozen and its own position entries on board "one" are filtered with no filter, the kind "bean", and the status "open"
    Then no filter returns them all, and the other two return none
    And the positions document still renders the same as before

  @test:schemas/content/reader-filter.test.ts::it_commits_NOTHING_—_the_separation,_asserted_rather_than_named::the_module_holds_no_file_name_and_no_schema_tag,_which_is_the_design
  Scenario: The module's code holds no schema tag and no file name
    When the source of reader-filter.ts is read
    Then it does not contain "$schema:"
    And it does not contain a quoted name ending in ".json"
    When its comments are removed
    Then the code does not contain "$schema", "SCHEMA_TAG" or a "_FILE" name
    And no string literal in it names a .json, .jsonld, .yaml, .yml, .md, .ts or .js file, or is a versioned tag like "name/v1"
    And it has no import, require, readFileSync or writeFileSync

  @test:schemas/content/reader-filter.test.ts::propertyValues_populates_a_control_from_the_corpus::every_value_present,_sorted,_deduplicated
  Scenario: A property's values are every value present, sorted and deduplicated
    When the values of "status" and of "priority" are listed
    Then they are "done", "open" and "high", "low"

  @test:schemas/content/reader-filter.test.ts::propertyValues_populates_a_control_from_the_corpus::a_property_nothing_carries_gives_an_empty_list,_not_a_throw
  Scenario: A property nothing carries has no values
    When the values of "nonexistent" are listed
    Then the list is empty

  @test:schemas/content/reader-filter.test.ts::a_multi-valued_property_—_a_todo's_assignees_and_beans_(todos.jsonld)::a_node_matches_when_ANY_of_its_values_is_selected
  Scenario: A multi-valued node matches when any of its values is selected
    Given todo nodes whose "person" is ["github:a", "github:b"], ["github:c"] and []
    When each is checked against person "github:b"
    Then only the first is shown

  @test:schemas/content/reader-filter.test.ts::a_multi-valued_property_—_a_todo's_assignees_and_beans_(todos.jsonld)::an_empty_list_cannot_answer,_so_a_filter_on_it_excludes_the_node
  Scenario: An empty value list fails a filter on it
    Given a todo node whose "person" is []
    When it is checked against person "github:a", and against no reader filter
    Then it is not shown by the first
    And it is shown by the second

  @test:schemas/content/reader-filter.test.ts::a_multi-valued_property_—_a_todo's_assignees_and_beans_(todos.jsonld)::every_value_of_every_node_populates_the_control,_once
  Scenario: Every value of a multi-valued property is listed once
    Given todo nodes whose "person" is ["github:a", "github:b"], ["github:c"] and []
    When the values of "person" are listed
    Then they are "github:a", "github:b", "github:c"
