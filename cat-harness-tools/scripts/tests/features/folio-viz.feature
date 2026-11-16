# scripts/gen-folio-viz.ts reads the declared folio directories into a graph, writes a machine-independent projection to assets/folio/index.json,
# and emits the themed folio viewer page, one per instance holding a folio directory. Each Scenario names the test that executes it.
Feature: The folio graph viewer

  @test:scripts/tests/folio-viz.test.ts::the_graph_is_read,_not_guessed::it_finds_the_declared_folio_directory_and_its_nodes
  Scenario: The reader finds the declared folio directory and its nodes
    Given the folio graph read from the harness and the repository root
    Then it is not null
    And it has at least one directory and at least one node

  @test:scripts/tests/folio-viz.test.ts::the_graph_is_read,_not_guessed::every_node_carries_the_fields_the_view_shows
  Scenario: Every folio node carries the fields the view shows
    Given the folio graph read from the harness and the repository root
    Then every node has a non-empty string id, a numeric chars count and a links array

  @test:scripts/tests/folio-viz.test.ts::the_graph_is_read,_not_guessed::a_declared_directory_is_reported_with_its_PRESENCE,_not_silently_skipped
  Scenario: Every declared directory reports whether it is present
    Given the folio graph read from the harness and the repository root
    Then every directory carries a boolean present flag

  @test:scripts/tests/folio-viz.test.ts::the_graph_is_read,_not_guessed::the_projection_declares_its_own_count,_so_a_wrong_one_is_visible
  Scenario: The projection's tile count equals its node count
    Given the projection of the folio graph
    Then the folio tile count equals the number of nodes

  @test:scripts/tests/folio-viz.test.ts::the_page::is_THEMED_(2026-10-07):_on_the_default_layout,_which_carries_the_folio,_so_no_mount_of_its_own
  Scenario: The page is themed on the default layout with no mount of its own
    Given the viewer page for "../../assets/folio/index.json"
    Then it starts with front matter "layout: default"
    And it has no doctype, html, head or body tag
    And it has the heading with id "fo-title"
    And it does not contain the folio mount marker

  @test:scripts/tests/folio-viz.test.ts::the_page::styles_nothing_outside_its_own_wrapper
  Scenario: The page styles nothing outside its wrapper
    Given the viewer page
    Then it has no selector not scoped to ".fo-page"

  @test:scripts/tests/folio-viz.test.ts::the_page::NO_BACKTICK_reaches_the_emitted_page_—_`bmr0`,_and_it_caught_this_author
  Scenario: No backtick reaches the emitted page
    Given the viewer page
    Then it contains no backtick

  @test:scripts/tests/folio-viz.test.ts::the_page::the_emitted_script_PARSES_—_an_escape_lost_in_the_generator's_template_literal_broke_it_once
  Scenario: Every emitted script parses
    Given the viewer page for "../../assets/folio/index.json"
    Then it has at least one script
    And each script parses as JavaScript

  @test:scripts/tests/folio-viz.test.ts::the_page::both_tables_carry_a_caption,_an_aria-label,_and_a_preceding_h2_heading_(finding_5)
  Scenario: Both tables carry a caption, an aria-label and a preceding h2
    Given the viewer page
    Then it has the h2 "Declared folio directories" with id "fo-dirs-head", and that aria-label and caption
    And it has the h2 "Folio nodes" with id "fo-nodes-head", and that aria-label and caption

  @test:scripts/tests/folio-viz.test.ts::the_page::link_cells_are_compact_and_wrap_links_in_.links_and_.link-pill_(finding_4)
  Scenario: Link cells wrap links in .links and .link-pill
    Given the viewer page
    Then it contains a div of class "links" and an element of class "link-pill"
    And ".fo-page .links" is a wrapping flex container
    And ".fo-page .link-pill" is inline-block

  @test:scripts/tests/folio-viz.test.ts::the_generated_artefacts_are_the_ones_declared::both_exist_—_run_`bun_run_cat_folio:viz`_if_not
  Scenario: The generated page and data file both exist
    Given the site directory of the harness
    Then the folio viewer index.html exists
    And assets/folio/index.json exists

  @test:scripts/tests/folio-viz.test.ts::the_generated_artefacts_are_the_ones_declared::the_committed_page_is_the_themed_one,_and_says_which_directories_it_draws
  Scenario: The committed page is the themed one
    # Gap: which directories the page draws is not checked
    Given the committed folio viewer page
    Then it starts with front matter "layout: default"
    And it has the line "rendered-by: folio-viewer"

  @test:scripts/tests/folio-viz.test.ts::the_committed_projection_is_MACHINE-INDEPENDENT::no_FILESYSTEM_path_in_the_committed_artefact_is_absolute
  Scenario: No filesystem path in the committed projection is absolute
    Given the committed assets/folio/index.json
    Then no directory dir and no node file starts with "/" or a drive letter
    And it holds at least one directory or node

  @test:scripts/tests/folio-viz.test.ts::the_committed_projection_is_MACHINE-INDEPENDENT::...and_the_graph_it_is_built_from_carries_none_either
  Scenario: The folio graph itself carries no absolute path
    Given the folio graph read relative to the repository root
    Then no directory dir and no node file starts with "/"

  @test:scripts/tests/folio-viz.test.ts::the_committed_projection_is_MACHINE-INDEPENDENT::the_SAME_tree_read_from_a_different_base_gives_the_same_paths
  Scenario: The same tree read from a different base gives the same paths
    Given the folio graph read relative to the repository root
    And the same checkout reached through a link from a scratch directory, read relative to that link
    Then the first read has nodes
    And both reads give the same node files and the same directories
    And every node file lies under "<harness>/folio/"

  @test:scripts/tests/folio-viz.test.ts::node_links_resolve_on_the_page_(qgjh)::an_absolute_http(s)_link_is_used_as_it_is
  Scenario: An absolute http(s) link is used as it is
    Given the page's own link resolver, for the data href "../../assets/folio/index.json"
    Then "https://github.com/x" resolves to itself

  @test:scripts/tests/folio-viz.test.ts::node_links_resolve_on_the_page_(qgjh)::a_site-rooted_link_resolves_against_the_site_root
  Scenario: A site-rooted link resolves against the site root
    Given the page's own link resolver, for the data href "../../assets/folio/index.json"
    Then "/agentic-harness.html" resolves to "../../agentic-harness.html"

  @test:scripts/tests/folio-viz.test.ts::node_links_resolve_on_the_page_(qgjh)::a_protocol-relative_or_unknown_href_stays_text
  Scenario: A protocol-relative or unknown link stays text
    Given the page's own link resolver
    Then "//evil.example/x" resolves to no link
    And "javascript:alert(1)" resolves to no link

  @test:scripts/tests/folio-viz.test.ts::the_'list'_view_is_the_harness's_own_file_list_(bean_ohx6)::each_present_directory's_files_are_EXACTLY_folioFileList's_answer,_not_a_second_listing
  Scenario: Each present directory lists exactly the harness file list
    Given the folio graph read from the harness and the repository root
    Then each present directory's files equal what folioFileList returns for that directory

  @test:scripts/tests/folio-viz.test.ts::the_'list'_view_is_the_harness's_own_file_list_(bean_ohx6)::the_projection_carries_a_formatted_size_for_every_file,_and_an_absent_directory_lists_none
  Scenario: The projection gives every file a formatted size and an absent directory no files
    Given the projection of the folio graph
    Then every absent directory lists no files
    And every file's size reads as a number with a unit B, KB, MB or GB

  @test:scripts/tests/folio-viz.test.ts::the_'list'_view_is_the_harness's_own_file_list_(bean_ohx6)::the_projection_parses_with_FolioGraphProjectionSchema,_files_included
  Scenario: The projection parses with the folio projection schema, files included
    Given the projection of the real folio graph
    Then it parses with FolioGraphProjectionSchema with no issues
    And a projection of a present directory listing README.md and an absent directory "gone" also parses

  @test:scripts/tests/folio-viz.test.ts::the_'list'_view_is_the_harness's_own_file_list_(bean_ohx6)::the_schema_is_still_strict:_a_file_row_with_a_key_the_writer_never_emits_is_refused
  Scenario: The projection schema refuses an unknown key on a file row
    Given a projection whose file row gains an "mtime" key
    When it is parsed with FolioGraphProjectionSchema
    Then parsing fails

  @test:scripts/tests/folio-viz.test.ts::the_'list'_view_is_the_harness's_own_file_list_(bean_ohx6)::the_page_has_a_place_for_the_list_view,_drawn_before_the_node_table
  Scenario: The page places the list view before the node table
    Given the viewer page for "../assets/folio/index.json"
    Then it contains an empty div with id "files"
    And that div comes before the element with id "nodes"
    And it contains "List view: files"

  @test:scripts/tests/folio-viz.test.ts::per-instance_folio_pages_(bean_folio-assistant-1nu0)::one_subject_per_instance_holding_a_folio_directory,_the_declarer's_by-id_directory_excluded
  Scenario: One subject per instance holding a folio directory, excluding the declarer's
    Given folio directories declared by cat-harness, folio-assistant-core and who-iris, and a beans directory of who-iris
    When the folio subjects are derived with cat-harness as the declarer
    Then the subjects are folio-assistant-core and who-iris
    And folio-assistant-core's directory is "/x/core/folios"

  @test:scripts/tests/folio-viz.test.ts::per-instance_folio_pages_(bean_folio-assistant-1nu0)::an_instance_page_names_its_instance_and_links_back_to_the_full_view
  Scenario: An instance page names its instance and links back to the full view
    Given the viewer page for the instance "who-iris"
    Then it contains "folio — who-iris"
    And it links "the full view" at "../"
    And it contains no backtick
