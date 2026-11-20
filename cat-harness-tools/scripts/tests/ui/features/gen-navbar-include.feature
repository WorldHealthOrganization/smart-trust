# scripts/gen-navbar-include.ts writes the Jekyll sidebar's navbar include from harness.json through the shared renderer, with a canonical and a staging variant split on one Liquid conditional.
# Each Scenario names the test that executes it.
Feature: The generated navbar include

  @test:scripts/tests/ui/gen-navbar-include.test.ts::what_Jekyll_is_handed::every_href_goes_through_`relative_url`
  Scenario: Every href in the generated navbar goes through relative_url
    # Skipped: when the generated navbar include has not been built
    Given the generated navbar-footer.html include
    When its href attributes are collected
    Then there is at least one
    And every one goes through the relative_url filter

  @test:scripts/tests/ui/gen-navbar-include.test.ts::what_Jekyll_is_handed::the_avatar_`src`_goes_through_it_too_—_the_one_that_looks_like_content
  Scenario: The avatar image src goes through relative_url too
    # Skipped: when the generated navbar include has not been built
    Given the generated navbar-footer.html include
    When the src attributes of its img tags are collected
    Then there is at least one
    And every one goes through the relative_url filter

  @test:scripts/tests/ui/gen-navbar-include.test.ts::what_Jekyll_is_handed::the_checkbox_is_rendered_ONCE,_inside_the_copy_guard
  Scenario: The navbar checkbox is rendered once, inside the copy guard
    # Skipped: when the generated navbar include has not been built
    Given the generated navbar-footer.html include
    Then exactly one input has the id "fa-nav-open"
    And the "if fa_nav_copy == 1" guard block exists and holds that input

  @test:scripts/tests/ui/gen-navbar-include.test.ts::what_Jekyll_is_handed::neither_variant_renders_a_label:_the_theme's_avatar_is_the_way_in_(#1757)
  Scenario: Neither variant renders a label, and the theme's avatar opens the sidebar instead
    # Skipped: when the generated navbar include has not been built
    # Gap: the click behaviour is a source-text check on docs-ui.js, not run
    Given the generated include split into its canonical and staging variants
    Then neither variant holds a label for "fa-nav-open"
    And docs-ui.js queries the bar's ".site-title"
    And docs-ui.js sets the checkbox to checked

  @test:scripts/tests/ui/gen-navbar-include.test.ts::the_two_deploy_variants_differ_ONLY_at_a_staging-only_viewer::the_difference_is_the_staging-only_rows,_and_no_other_row
  Scenario: The two deploy variants differ only in the staging-only note
    # Skipped: when the generated navbar include has not been built
    Given the generated include split into its canonical and staging variants
    Then both variants list the same row labels in the same order
    And the canonical variant contains "staging only"
    And the staging variant does not

  @test:scripts/tests/ui/gen-navbar-include.test.ts::the_two_deploy_variants_differ_ONLY_at_a_staging-only_viewer::the_canonical_side_renders_the_withheld_viewer_as_a_DEAD_row,_not_a_hidden_one
  Scenario: The canonical variant renders the withheld viewer as a dead row, not a hidden one
    # Skipped: when the generated navbar include has not been built
    Given the canonical variant of the generated include
    Then it contains "staging only"
    And a "fa-nav-dead" row precedes that note

  @test:scripts/tests/ui/gen-navbar-include.test.ts::the_template_composes_nothing::it_is_a_single_include_and_not_one_tag_of_markup
  Scenario: The sidebar template is a single include with no markup of its own
    Given the nav_footer_custom.html template
    Then it includes "generated/navbar-footer.html"
    And it contains no HTML element tag other than comments

  @test:scripts/tests/ui/gen-navbar-include.test.ts::the_writer_is_a_fixpoint_over_the_real_data::running_it_leaves_the_committed_file_unchanged
  Scenario: Running the navbar writer with --check over the real data reports nothing stale
    # Skipped: when harness.json or the generated include has not been built
    When gen-navbar-include.ts is run with --check from the repo root
    Then its output does not contain "stale"
    And it exits 0

  @test:scripts/tests/ui/gen-navbar-include.test.ts::one_navbar_section_per_instantiated_harness_(bean_`nvbr`)::two_instantiated_harnesses_render_two_sections;_a_declared-only_one_renders_none
  Scenario: Two instantiated harnesses render two sections and a declared-only one renders none
    Given the harnesses alpha and beta instantiated and gamma declared only
    When the navbar is rendered
    Then both variants have sections for "alpha" and "beta" only

  @test:scripts/tests/ui/gen-navbar-include.test.ts::one_navbar_section_per_instantiated_harness_(bean_`nvbr`)::zero_instances_renders_without_error,_and_with_no_empty_Harnesses_group
  Scenario: Zero harnesses render without error and with no empty Harnesses group
    When the navbar is rendered with no harnesses
    Then it holds the "fa-nav-top" block
    And it has no harness sections
    And it has no "Harnesses" heading

  @test:scripts/tests/ui/gen-navbar-include.test.ts::one_navbar_section_per_instantiated_harness_(bean_`nvbr`)::a_SCANNED_root_with_two_instantiated_harnesses_renders_exactly_their_two_sections
  Scenario: A scanned root with two instantiated harnesses renders exactly their two sections
    Given a repository declaring host, alpha, beta and gamma
    And root config files for alpha and beta only
    When its harness tiles are scanned, round-tripped through JSON and rendered
    Then both variants have sections for "alpha" and "beta" only

  @test:scripts/tests/ui/gen-navbar-include.test.ts::one_navbar_section_per_instantiated_harness_(bean_`nvbr`)::a_SCANNED_root_with_no_declaration_at_all_yields_no_tiles_and_still_renders
  Scenario: A scanned root with no declaration yields no tiles and still renders
    Given an empty repository directory
    When its harness tiles are scanned
    Then there are none
    And rendering them gives the "fa-nav-top" block with no harness sections and no "Harnesses" heading

  @test:scripts/tests/ui/gen-navbar-include.test.ts::a_graph_row_says_the_destination's_ONE_name_(bean_`ob3m`_finding_6)::the_row_prints_the_data's_label,_not_the_kind_word
  Scenario: A graph row prints the data's label, not the kind word
    Given a harness whose visualisations include the kind "methodology" labelled "Methodologies"
    When the navbar is rendered
    Then the canonical variant has a row labelled "Methodologies"
    And no row labelled "methodology"

  @test:scripts/tests/ui/gen-navbar-include.test.ts::a_graph_row_says_the_destination's_ONE_name_(bean_`ob3m`_finding_6)::a_kind_whose_page_is_another_kind's_row_is_listed_once
  Scenario: A kind whose page is another kind's row is listed once
    Given a harness whose "cat-harness" visualisation is sameAs the "schemas" one, both labelled "Schemas"
    When the navbar is rendered
    Then the canonical variant has exactly one row labelled "Schemas"

  @test:scripts/tests/ui/gen-navbar-include.test.ts::instanceView_—_an_instance's_own_site::the_instance_first,_then_only_what_it_needs,_transitively
  Scenario: An instance's own view lists the instance first, then only what it needs, transitively
    Given rows core, ig needing base, base needing core, and other
    When the view for the instance "ig" is made
    Then its rows are "ig", "core" and "base" in that order

  @test:scripts/tests/ui/gen-navbar-include.test.ts::instanceView_—_an_instance's_own_site::the_instance's_own_pages_move_to_this_site's_root;_every_other_link_is_the_main_site's
  Scenario: An instance's own pages move to its site root and every other link is the main site's
    Given the view for the instance "ig" with main site "https://main.example/site/"
    Then the instance's href is "/" and its docs path is "/artifacts.html"
    And core's href is "https://main.example/site/core/"
    And core's docs path is "https://main.example/site/core/docs/"

  @test:scripts/tests/ui/gen-navbar-include.test.ts::instanceView_—_an_instance's_own_site::every_row_it_shows_is_rendered_—_a_dependency_here_is_reachable_on_the_main_site
  Scenario: Every row of an instance's view is rendered
    Given the view for the instance "ig", which includes the uninstantiated base
    Then every row in it is marked instantiated
    And rendering it contains the link "https://main.example/site/core/"
