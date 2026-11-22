# scripts/gen-node-kind-pages.ts writes generic pages for each node kind from its schema: a kind dashboard, a page per harness and a page per node, each with its rail section.
# Each Scenario names the test that executes it.
Feature: Generic node kind pages

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::fieldsOf::unwraps_optional_and_default,_and_keeps_an_enum's_values_in_order
  Scenario: A schema's fields unwrap optional and default, and an enum keeps its values in order
    Given an object schema with a defaulted enum "status" of "open" and "done", an optional string "note" and a number "n"
    When its fields are read
    Then they are status as an enum with options "open" and "done", note as a string and n as a number

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::fieldsOf::a_value_that_is_not_an_object_schema_has_no_fields,_rather_than_throwing
  Scenario: A value that is not an object schema has no fields
    When the fields of undefined are read
    Then there are none, and nothing is thrown

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::columnsFor::scalars_only,_preferred_names_first,_never_`$schema`
  Scenario: Columns are scalars only, preferred names first, never $schema
    Given fields "$schema", "zeta", "status", "id", the array "history" and "title"
    When the columns are chosen
    Then they are "id", "title", "status" and "zeta"

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::columnsFor::at_most_n
  Scenario: Columns are capped at the number asked for
    Given the same six fields
    When two columns are chosen
    Then they are "id" and "title"

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::cell::summarises_structure_and_truncates_long_text
  Scenario: A cell summarises structure and truncates long text
    Then an array of two is shown as "2 item(s)"
    And an object is shown as "{…}"
    And undefined is shown as empty
    And a 200-character string is cut to 140 characters

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::the_dashboard::lists_the_subclass's_nodes,_and_filters_by_kind_and_by_harness
  Scenario: The kind dashboard lists its subclass's nodes and filters by kind and by harness
    Given a comment kind with the subclass public-comment and nodes of both in harnesses alpha and beta
    When the dashboard for comment is rendered
    Then it shows the subclass node "P-2"
    And it has a kind filter and a harness filter

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::the_dashboard::tiles_count_only_values_that_occur
  Scenario: Dashboard tiles count only the values that occur
    Given the same dashboard, with two open nodes, one closed and none merged
    Then it has a tile of 2 for "open" and 1 for "closed"
    And no tile for "merged"

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::the_dashboard::counts_per_harness,_each_linking_to_that_harness's_page
  Scenario: The dashboard counts nodes per harness, each linking to that harness's page
    Given the same dashboard
    Then it has a tile of 2 linking "beta/"

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::the_dashboard::links_each_node_to_its_page_under_the_kind_it_IS_—_one_address_per_node
  Scenario: The dashboard links each node to its page under the kind it is
    Given the same dashboard
    Then the comment node links "alpha/c/one/"
    And the public-comment node links "../public-comment/beta/p/two/"

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::the_dashboard::a_renderer's_sections_sit_between_the_tiles_and_the_table
  Scenario: A renderer's sections sit between the tiles and the table
    Given the dashboard rendered with an extra "Coverage" section holding "<p>X</p>"
    Then the Coverage heading and its body come after the status tiles and before the nodes heading

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::the_dashboard::a_harness_page_has_no_harness_filter_or_column,_and_links_back_to_every_harness
  Scenario: A harness page has no harness filter and links back to every harness
    # Gap: the absence of a harness column is not checked
    Given the dashboard rendered for the harness beta only
    Then it has no harness filter
    And it links "../" as "Every harness"

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::the_dashboard::an_empty_kind_says_so_instead_of_drawing_an_empty_table
  Scenario: An empty kind says so instead of drawing an empty table
    When the dashboard for public-comment is rendered with no nodes
    Then it says "No node of this kind on this site yet."

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::the_node_page::titles_itself_from_the_node_and_links_to_the_kind_and_the_harness
  Scenario: A node page titles itself from the node and links to its kind and harness
    Given a todo node in harness alpha at "todos/items/x" with summary "Fix it"
    When its page is rendered
    Then its title heading is "Fix it"
    And it links "../../../../" as "todo" and "../../../" as "alpha"

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::the_node_page::shows_a_nested_value_as_JSON_rather_than_flattening_it
  Scenario: A node page shows a nested value as JSON
    Given the same node, whose refs hold an object with kind "bean"
    When its page is rendered
    Then the page holds the escaped JSON text "kind": "bean"

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::the_node_page::a_renderer's_sections_come_before_the_fields
  Scenario: A renderer's sections come before the node's fields
    Given a node page rendered with a "Comments" section holding "<p>Y</p>"
    Then the Comments heading and body are followed directly by the Fields heading

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::plannedPages::a_kind_page,_a_page_per_harness_and_a_page_per_node,_under_the_locale;_an_ancestor-only_kind_has_none
  Scenario: The planned pages are a kind page, a page per harness and a page per node, under the locale
    Given an index with a todo kind and an ancestor-only kind with no version or declarer
    And one todo node in harness alpha at "t/a"
    When the pages are planned
    Then they are "en/core/todo", "en/core/todo/alpha" and "en/core/todo/alpha/t/a"
    And the kind directory for todo in "en" is "en/core/todo"

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::plannedPages::the_locales_are_cat-harness's_PUBLISHED_LOCALES_—_one_list,_not_a_second_copy_(folio-assistant#2527)
  Scenario: The page locales are cat-harness's published locales
    Then the generator's locales are the very same list as PUBLISHED_LOCALES
    And planning a todo kind with no nodes gives one kind page per published locale

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::plannedPages::a_subclass's_node_gets_its_page_under_its_own_kind_only,_though_its_parent's_pages_list_it
  Scenario: A subclass's node gets its page under its own kind only
    Given a todo kind with the subclass sub, and one sub node listed under both
    When the pages are planned
    Then they are the todo kind and alpha pages, then the sub kind, alpha and node pages
    And no node page is planned under todo

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::unresolvedPages::a_planned_page_resolves_only_when_it_exists_AND_this_generator_wrote_it
  Scenario: A planned page resolves only when it exists and this generator wrote it
    Given a site where "en/a" carries the generator's page mark, "en/b" is someone else's page and "en/c" is absent
    When the unresolved pages are found
    Then they are "en/b" and "en/c"

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::unresolvedPages::a_renderer_must_provide_at_least_one_of_its_two_hooks
  Scenario: A renderer must provide at least one of its two hooks
    Then a renderer with a node hook is accepted
    And an empty renderer is not

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::each_page's_own_rail_section_(#1757)::the_kind_page_opens_on_itself_with_its_regions,_and_links_each_harness_page
  Scenario: The kind page's rail opens on itself with its regions and links each harness page
    Given a todo kind with a status enum and nodes in alpha and beta
    When the dashboard's rail section is made
    Then its first entry is "todo" with regions By harness, By status and Nodes
    And it then links "alpha/" and "beta/"

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::each_page's_own_rail_section_(#1757)::a_harness_page_opens_on_its_own_row,_and_a_tile_region_only_where_a_value_occurs
  Scenario: A harness page's rail opens on its own row with a tile region only where a value occurs
    Given the same kind and nodes, beta's node having no status
    When the rail section is made for the harness beta
    Then beta's row holds only the Nodes region
    And the first entry is "todo" linking "../"

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::each_page's_own_rail_section_(#1757)::a_node_page_links_up_to_its_kind_and_its_harness,_however_deep_its_path
  Scenario: A node page's rail links up to its kind and harness, however deep its path
    Given a todo node in alpha at "todos/items/x"
    When its rail section is made
    Then it links "todo" at "../../../../" and "alpha" at "../../../"
    And its own entry "x" holds the Fields region

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::each_page's_own_rail_section_(#1757)::a_renderer's_sections_are_regions_in_the_rail_too
  Scenario: A renderer's sections are regions in the rail too
    Given a node rail section made with a "Comments" section
    Then the node's entry holds Comments then Fields
    And a dashboard rail section made with a "Coverage" section has a "#coverage" region

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::the_pages_are_THEMED,_so_they_carry_the_site's_top_band_(2026-10-07)::each_is_on_the_default_layout,_not_a_standalone_document,_and_still_carries_the_mark
  Scenario: Each page is on the default layout, not a standalone document, and carries the mark
    Given a todo dashboard page and a todo node page
    Then each starts with front matter for the default layout
    And neither has a doctype, html, head or body tag
    And each has the "nk-title" heading
    And each wraps its content in the "nk-page" div with the page mark

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::the_pages_are_THEMED,_so_they_carry_the_site's_top_band_(2026-10-07)::each_styles_nothing_outside_its_own_wrapper
  Scenario: Each page styles nothing outside its own wrapper
    Given the same dashboard and node pages
    Then neither has a style selector not scoped to ".nk-page"

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::the_pages_are_THEMED,_so_they_carry_the_site's_top_band_(2026-10-07)::a_folio's_built_`_site`_still_gets_a_standalone_page:_nothing_there_reads_front_matter
  Scenario: A standalone node page is a full document for a folio's built site
    When a node page is rendered in standalone mode
    Then it starts with "<!doctype html>"
    And its body carries the page mark

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::pages_under_a_route_built_at_publish::a_page_under_a_declared_route_is_built_at_publish;_one_beside_it_is_not
  Scenario: A page under a declared publish-time route is built at publish, one beside it is not
    Given a declaration listing the route "docs/en/cat-harness/node-kind-index/" with site directory "docs"
    Then "en/cat-harness/node-kind-index" and a page below it are built at publish
    And "en/cat-harness/bean" is not

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::pages_under_a_route_built_at_publish::with_no_declaration_nothing_is_skipped_(a_folio's_site)
  Scenario: With no declaration no page is skipped as built at publish
    Then "en/cat-harness/node-kind-index" is not built at publish when there is no declaration

  @test:scripts/tests/ui/gen-node-kind-pages.test.ts::plannedPages::a_declared_kind_with_no_version_gets_its_pages_too:_the_schemas_page_links_it_(who-iris,_2026-11-13)
  Scenario: A declared kind with no version still gets its kind page
    # Gap: the schemas page's link to it is not checked
    Given kinds "bean" and "work-plan", the second declared but with no version or tag
    When the pages are planned with no nodes
    Then they are "en/core/bean" and "en/core/work-plan"
    And "work-plan" has kind pages
    And a kind declared by nothing, or no kind at all, has none
