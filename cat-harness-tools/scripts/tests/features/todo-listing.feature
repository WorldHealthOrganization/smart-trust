# The linear floor renders every note, in document order, with no JavaScript.
# Each Scenario names the test that executes it.
Feature: Todo listing (the linear floor)

  @test:scripts/tests/todo-listing.test.ts::escapeHtml::closes_every_hole_a_note's_prose_could_open
  Scenario: escapeHtml escapes every special character
    Then '<script>alert("x")</script>' escapes its angle brackets and double quotes
    And "&lt;" escapes to "&amp;lt;", so "&" is escaped first
    And "it's" escapes to "it&#39;s"

  @test:scripts/tests/todo-listing.test.ts::the_listing::renders_every_note
  Scenario: Every note is rendered
    When notes "a", "b" and "c" are listed
    Then each has its data-fa-todo attribute in the HTML

  @test:scripts/tests/todo-listing.test.ts::the_listing::in_DOCUMENT_ORDER_—_the_input's_order,_never_sorted
  Scenario: Notes are listed in input order
    When notes "Zeta", "Alpha" and "Mid" are listed in that order
    Then they appear in that order

  @test:scripts/tests/todo-listing.test.ts::the_listing::the_count_on_the_section_matches_the_number_of_items_rendered
  Scenario: The section's count matches the items
    When two notes are listed
    Then the count attribute is 2, the heading says "Open notes (2)", and two items are rendered

  @test:scripts/tests/todo-listing.test.ts::the_listing::zero_notes_is_a_DETERMINED_empty_and_says_so
  Scenario: Zero notes says so
    When no notes are listed
    Then it says "No notes are open in this folio.", the count is 0, and there is no list

  @test:scripts/tests/todo-listing.test.ts::the_listing::a_note's_prose_cannot_close_a_tag
  Scenario: A note's prose cannot inject markup
    When a note's summary holds an img tag and its comment a script tag
    Then the HTML contains no "<img" and no "<script", but contains "&lt;img"

  @test:scripts/tests/todo-listing.test.ts::the_listing::the_attachment_is_rendered_from_`target`'s_PARTS,_never_from_the_label
  Scenario: The attachment is rendered from the target's parts
    When a note's target is page "beans-and-todos" node "human-todos"
    Then it renders "beans-and-todos › human-todos"

  @test:scripts/tests/todo-listing.test.ts::the_listing::a_label_that_resolves_to_no_block_is_REPORTED,_not_dropped_and_not_guessed
  Scenario: An unresolved label is reported
    When a note has target label "sec:gone-away" and no target
    Then it shows the label and "no block in this build carries this label"

  @test:scripts/tests/todo-listing.test.ts::the_listing::no_href_is_produced_when_the_caller_cannot_resolve_one_—_`pb04`
  Scenario: No page link without a resolver
    When a note with a target is listed with no page href function
    Then it names "p › n" and contains no link

  @test:scripts/tests/todo-listing.test.ts::the_listing::an_unresolved_relation_is_text,_a_resolved_one_is_a_link
  Scenario: Relations are links only when resolved
    When a note has a bean relation with an href and one without
    Then the first is a link "bean: folio-assistant-29ij" and the second a plain list item

  @test:scripts/tests/todo-listing.test.ts::the_listing::the_caller's_`pageHref`_is_interpolated_verbatim,_which_is_how_Liquid_survives
  Scenario: The caller's page href is interpolated verbatim
    When the page href function returns a Liquid relative_url expression
    Then the href holds it unescaped with single quotes inside, never 'href="{{ "'

  @test:scripts/tests/todo-listing.test.ts::linear_floor_on_todos/index.html_(folio-assistant-dm4j)::todos/index.html_serves_the_linear_floor_in_its_own_bytes_via_layout_and_footer_include
  Scenario: The todos page gets the floor through its layout's footer
    Then the harness's custom footer includes "generated/todo-listing.html"
    And the generated todo board page uses "layout: default" and has the "Todos" heading

  @test:scripts/tests/todo-listing.test.ts::each_page_lists_only_its_own_notes_(bean_lwjc)::groups_by_the_page_each_note_is_attached_to,_keeping_input_order
  Scenario: Notes are grouped by page in input order
    Given notes p1 and p2 on one page, q1 on another, and u1 with an unresolved label
    When they are grouped by page
    Then the pages are the first then the second, holding p1, p2 and q1
    And u1 is unplaced

  @test:scripts/tests/todo-listing.test.ts::each_page_lists_only_its_own_notes_(bean_lwjc)::a_page_with_no_note_gets_no_entry_--_an_absence,_not_an_empty_list
  Scenario: A page with no note has no entry
    Then a page no note is on has no entry
    And grouping no notes gives no pages

  @test:scripts/tests/todo-listing.test.ts::each_page_lists_only_its_own_notes_(bean_lwjc)::a_page's_count_is_its_own_cardinality,_never_the_folio's
  Scenario: A page listing counts its own notes
    When one page's two notes are listed with scope "page"
    Then the count is 2, the scope is "page", the heading says "Notes on this page (2)"
    And it does not say "Every note in this folio, in document order"

  @test:scripts/tests/todo-listing.test.ts::each_page_lists_only_its_own_notes_(bean_lwjc)::the_folio_listing_is_unchanged_by_default
  Scenario: The default listing is the folio's
    When all four notes are listed with no scope
    Then the scope is "folio" and the heading says "Open notes (4)"

  @test:scripts/tests/todo-listing.test.ts::each_page_lists_only_its_own_notes_(bean_lwjc)::one_fragment_file_per_page,_flat
  Scenario: One flat fragment file per page
    Then page "guides/beans-and-todos" has fragment "guides__beans-and-todos.html"
    And page "index" has "index.html"

  @test:scripts/tests/todo-listing.test.ts::each_page_lists_only_its_own_notes_(bean_lwjc)::the_todos_board_keeps_the_whole_listing:_its_page_says_so_in_front_matter
  Scenario: The board page asks for the whole listing
    Then the todo board page's front matter has "fa_todo_listing: all"
