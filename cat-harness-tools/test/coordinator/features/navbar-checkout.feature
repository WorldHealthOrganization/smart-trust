# Specifies declaredGraphs (scripts/mount-instance-docs.ts) for who-iris, and
# the navbar it renders through railModel and navbarRegionsHtml.
Feature: Every graph who-iris declares reaches the navbar, linked or not, and rows cannot be confused

  @test:test/coordinator/navbar-checkout.test.ts::every_declared_graph_reaches_the_navbar,_linked_or_not::lists_every_kind_the_instance_declares,_not_only_the_published_ones
  Scenario: Every kind who-iris declares is listed
    Given who-iris's declared graphs with no published pages
    When their row labels are read
    Then they are the display names of the seventeen pinned kinds, plus attestations and uploads where who-iris currently declares them, sorted

  @test:test/coordinator/navbar-checkout.test.ts::every_declared_graph_reaches_the_navbar,_linked_or_not::links_exactly_the_kinds_it_was_told_are_published
  Scenario: Only the kinds said to be published are linked
    Given who-iris's declared graphs with "docs" published at "../docs/who-iris/"
    When the rows are read
    Then the Docs row links to "../docs/who-iris/"
    And every other kind's row carries no link

  @test:test/coordinator/navbar-checkout.test.ts::every_declared_graph_reaches_the_navbar,_linked_or_not::carries_the_generator's_REASON_onto_the_rows_that_have_no_href
  Scenario: The generator's reason is carried onto unlinked rows
    Given who-iris's declared graphs with notes "no viewer yet" for catalogue and "staging only" for themes
    When the rows are read
    Then the catalogue row's note is "no viewer yet"
    And the themes row's note is "staging only"
    And the skills row has no note

  @test:test/coordinator/navbar-checkout.test.ts::every_declared_graph_reaches_the_navbar,_linked_or_not::links_a_kind_whose_viewer_the_HANDLER_published_—_`pk2s`
  Scenario: A kind whose viewer the handler published is linked
    Given who-iris's declared graphs with a handler page "../cat-harness/catalogue/who-iris/" for catalogue
    When the catalogue row is read
    Then it links to that page
    And it has no note

  @test:test/coordinator/navbar-checkout.test.ts::every_declared_graph_reaches_the_navbar,_linked_or_not::the_MOUNT_TABLE_wins_where_it_has_an_answer_—_the_owner's_order,_not_a_tie-break
  Scenario: The mount table's link wins over the handler's
    Given who-iris's declared graphs with library mounted at "../who-iris/" and a handler page for library
    When the library row is read
    Then it links to "../who-iris/"

  @test:test/coordinator/navbar-checkout.test.ts::adjacent_graph_rows_cannot_be_confused_(bean_yag0)::docs_and_library_carry_a_drawn_glyph_and_distinct_hues,_not_initials
  Scenario: Docs and Library carry glyphs and distinct hues
    Given who-iris's declared graphs with Docs and Library published
    When the Docs and Library rows are read
    Then both carry a glyph path
    And Docs carries no initial icon
    And their tones differ

  @test:test/coordinator/navbar-checkout.test.ts::adjacent_graph_rows_cannot_be_confused_(bean_yag0)::every_row's_accessible_name_is_full_and_distinct,_and_begins_with_its_visible_label
  Scenario: Every row's accessible name is full, distinct and starts with its label
    Given the navbar rendered from those rows
    When each row's label and description are read
    Then the names "<label> — <description>" are all distinct
    And every description mentions who-iris
    And the HTML puts each label before a screen-reader span with the rest of its name
    And the Library row's description is "L1 source content, who-iris" and its title is "Library — L1 source content, who-iris"

  @test:test/coordinator/navbar-checkout.test.ts::adjacent_graph_rows_cannot_be_confused_(bean_yag0)::the_glyph_is_an_SVG_hidden_from_assistive_technology_—_the_words_are_the_name
  Scenario: The glyph is an SVG hidden from assistive technology
    Given the navbar rendered from those rows
    When its HTML is read
    Then a glyph span marked aria-hidden="true" wraps an SVG with viewBox "0 0 24 24"
