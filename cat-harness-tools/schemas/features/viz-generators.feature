# The schema and library visualiser generators (scripts/gen-schema-viz.ts, scripts/gen-library-viz.ts):
# the themed pages they emit, where viewerPlacement puts them, and the graphs their readers publish.
# Each Scenario names the test that executes it.
Feature: Schema and library viewer generators

  @test:schemas/viz-generators.test.ts::the_schema_viewer::is_a_themed_Jekyll_page,_not_a_standalone_document
  Scenario: The schema viewer is a themed Jekyll page
    Given the schema viewer generated for the data href "../../assets/schemas/index.json" and subjects "cat-harness" and "smart-base"
    Then the page starts with front matter "layout: default"
    And it contains no doctype, html, head, body, main or header element
    And it contains the heading with id "sc-title"
    And it contains a closing script tag and a closing style tag

  @test:schemas/viz-generators.test.ts::the_schema_viewer::fetches_its_projection_RELATIVE_to_its_own_location,_with_no_base_URL
  Scenario: The schema viewer references its projection by a relative href
    Given the generated schema viewer page
    Then it contains "../../assets/schemas/index.json"
    And it does not contain "https://litlfred.github.io"

  @test:schemas/viz-generators.test.ts::the_schema_viewer::restyles_nothing_of_the_theme's,_and_follows_the_site's_scheme_switch
  Scenario: The schema viewer's styles are scoped to its wrapper and switch with the site scheme
    Given the generated schema viewer page
    Then it has no selectors outside ".sc-page"
    And ".sc-page" declares "color-scheme: dark"
    And it contains a rule for ".sc-page" under the light data-fa-scheme

  @test:schemas/viz-generators.test.ts::the_schema_viewer::lists_its_subject_pages,_since_the_theme's_sidebar_does_not
  Scenario: The schema viewer links its subject pages
    Given the generated schema viewer page
    Then it contains a link to "smart-base/"
    And it marks "All instances" as the current page

  @test:schemas/viz-generators.test.ts::the_schema_viewer::says_so_when_the_projection_cannot_be_read,_rather_than_showing_nothing
  Scenario: The schema viewer carries a could-not message for an unreadable projection
    # Gap: only checks the page text contains "could not"; the failed-fetch behaviour is not run
    Given the generated schema viewer page
    Then it contains "could not"

  @test:schemas/viz-generators.test.ts::the_library_viewer::is_a_themed_page_on_the_default_layout,_with_its_body_Liquid-raw
  Scenario: The library viewer is a themed page with a Liquid-raw body
    Given the library viewer generated for the data href "../../assets/schemas/index.json"
    Then the page starts with front matter "layout: default"
    And it has a quoted title line and "nav_exclude: true"
    And it contains no doctype, html, head or body element
    And it contains "{% raw %}" and ends with "{% endraw %}"
    And it contains the heading with id "lib-title"

  @test:schemas/viz-generators.test.ts::the_library_viewer::fetches_its_projection_RELATIVE_to_its_own_location,_with_no_base_URL
  Scenario: The library viewer references its projection by a relative href
    Given the generated library viewer page
    Then it contains "../../assets/schemas/index.json"
    And it does not contain "https://litlfred.github.io"

  @test:schemas/viz-generators.test.ts::the_library_viewer::its_stylesheet_styles_only_its_own_wrapper,_in_both_colour_schemes
  Scenario: The library viewer stylesheet styles only its wrapper in both schemes
    Given the library viewer CSS with comments removed
    Then it has more than 50 rule selectors
    And every selector starts with ".lib-page", optionally under the light data-fa-scheme
    And no rule targets body, :root or a
    And it contains a ".lib-page" rule under the light data-fa-scheme
    And ".lib-page" sets "--bg" to "#27262b" and the light scheme sets it to "#fff"

  @test:schemas/viz-generators.test.ts::the_library_viewer::says_so_when_the_projection_cannot_be_read,_rather_than_showing_nothing
  Scenario: The library viewer script carries a could-not message for an unreadable projection
    # Gap: only checks the viewer script text contains "could not"; the failed-fetch behaviour is not run
    Given the library viewer script
    Then it contains "could not"

  @test:schemas/viz-generators.test.ts::viewerPlacement_—_the_URL_is_the_directory's_path,_not_a_composition::a_directory_publishes_at_its_own_repo-relative_path
  Scenario: A viewer page is placed at its directory's repo-relative path
    When viewerPlacement places "cat-harness/schemas" under "/site"
    Then the page directory is "/site/cat-harness/schemas"

  @test:schemas/viz-generators.test.ts::viewerPlacement_—_the_URL_is_the_directory's_path,_not_a_composition::a_directory_NOT_at_owner/kind_is_addressed_by_its_path,_not_by_the_renderer
  Scenario: A library directory outside cat-harness is placed at its own path
    When viewerPlacement places "who-iris/library" with kind "library" under "/site"
    Then the page directory is "/site/who-iris/library"
    And it does not contain "cat-harness"

  @test:schemas/viz-generators.test.ts::viewerPlacement_—_the_URL_is_the_directory's_path,_not_a_composition::the_data_href_is_relative_to_the_page's_own_depth
  Scenario: The data href climbs as many levels as the page is deep
    When viewerPlacement places "cat-harness/schemas"
    Then the data href is "../../assets/schemas/index.json"
    And for "deep/er/still" it is "../../../assets/schemas/index.json"

  @test:schemas/viz-generators.test.ts::the_readers_agree_with_what_the_generators_publish::the_schema_graph_spans_every_DECLARED_schemas_directory,_not_one
  Scenario: The schema graph reads more than one declared schemas directory
    # Gap: checks more than one root and instance, not that every declared schemas directory is included
    Given the schema graph read from this layer
    Then it is not null
    And it has more than one root
    And its modules come from more than one instance

  @test:schemas/viz-generators.test.ts::the_readers_agree_with_what_the_generators_publish::a_queue's_declared_intake_is_ONE_unit,_not_one_per_file_it_carries
  Scenario: Each declared intake is one upload row
    Given the library graph read from this layer and its repository root
    Then it is not null
    And every intake upload declares more than zero files
    And each intake's path appears in exactly one upload row

  @test:schemas/viz-generators.test.ts::the_readers_agree_with_what_the_generators_publish::every_queue's_uningested_count_is_total_minus_ingested,_and_never_negative
  Scenario: A queue's uningested count is total minus ingested and never negative
    Given the library graph
    Then for every queue the uningested count equals total minus ingested
    And it is at least zero

  @test:schemas/viz-generators.test.ts::the_projection_is_stable_under_edits_that_do_not_change_the_graph::no_declaration_carries_a_line_number
  Scenario: The published schema projection carries no line numbers
    # Skipped: when the schema projection has not been built under the harness site
    Given the schema projection index.json under the harness site
    Then this layer declares a schemas directory
    And the projection has at least one declaration
    And no declaration has a "line" field

  @test:schemas/viz-generators.test.ts::the_projection_is_stable_under_edits_that_do_not_change_the_graph::the_reader_still_knows_the_line,_so_a_consumer_that_wants_one_can_have_it
  Scenario: The schema graph reader keeps each declaration's line
    Given the schema graph read from this layer
    Then every declaration has a positive numeric line
