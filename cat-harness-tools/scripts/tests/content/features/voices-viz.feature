# scripts/voices-graph.ts reads the declared voices directories into a graph, and
# scripts/gen-voices-viz.ts projects it and renders the themed viewer page over it.
# Each Scenario names the test that executes it.
Feature: Voices graph reader and viewer page

  @test:scripts/tests/content/voices-viz.test.ts::a_declared_directory_that_is_not_there_is_a_ROW,_not_a_silence::a_declared-but-absent_directory_IS_reported,_on_a_fixture_that_cannot_be_closed
  Scenario: A declared but absent voices directory is reported as a row
    Given a fixture layer "myinst" declaring a voices directory at "skills/voices/" that does not exist
    When the voices graph is read for that layer
    Then a graph is returned
    And exactly one directory is not present
    And that directory lists no voices
    And its path contains "skills/voices"

  @test:scripts/tests/content/voices-viz.test.ts::a_declared_directory_that_is_not_there_is_a_ROW,_not_a_silence::...and_the_corpus's_directories_are_all_ACCOUNTED_FOR,_present_or_not
  Scenario: Every declared voices directory in the corpus appears in the graph
    Given the voices directories declared by every instance root in the repository
    When the voices graph of the harness is read
    Then the graph has one directory per declared voices directory
    And each directory's present flag is a boolean
    And every absent directory lists no voices

  @test:scripts/tests/content/voices-viz.test.ts::a_declared_directory_that_is_not_there_is_a_ROW,_not_a_silence::an_absent_directory_still_reports_its_declared_path
  Scenario: An absent directory still reports its path and instance
    Given the voices graph of the harness
    When its absent directories are inspected
    Then each has a non-empty path and a non-empty instance
    # Gap: passes vacuously when no directory in the corpus is absent

  @test:scripts/tests/content/voices-viz.test.ts::the_citations_—_the_reason_the_page_exists::every_rule_cites_something,_and_the_reader_says_WHICH_KIND
  Scenario: Every rule cites something and names its citation kind
    Given the voices graph of the harness
    When the rules of all its voices are collected
    Then there is at least one rule
    And every rule's citation kind is "library" or "kg-node"
    And every rule has a non-empty cites value

  @test:scripts/tests/content/voices-viz.test.ts::the_citations_—_the_reason_the_page_exists::every_rule_carries_the_passage_it_was_read_from
  Scenario: Every rule carries a non-empty quote from its source
    Given the voices graph of the harness
    When the rules of all its voices are collected
    Then every rule's quote is non-empty after trimming

  @test:scripts/tests/content/voices-viz.test.ts::the_citations_—_the_reason_the_page_exists::the_totals_add_up_to_the_rules,_rather_than_being_counted_twice
  Scenario: The graph totals agree with the rules and voices
    Given the voices graph of the harness
    When its totals are read
    Then the rule total equals the number of rules
    And the library and KG-node citation totals sum to the number of rules
    And the voice total equals the number of voices

  @test:scripts/tests/content/voices-viz.test.ts::the_page_agrees_with_the_QA_sidecars_about_severity::`overlaySeverity`_and_`criterion`_match_what_the_criteria_derivation_produces
  Scenario: Each voice's overlay severity and criterion match the criteria derivation
    # Gap: the describe says "agrees with the QA sidecars"; the body compares the graph with the criteria derivation functions, not with any sidecar
    Given the voices graph of the harness and the shipped voices of the criteria derivation
    When each graph voice is matched to its shipped voice by id
    Then every graph voice has a shipped voice
    And its overlay severity equals the severity the derivation computes
    And its criterion equals the overlay criterion id for that voice

  @test:scripts/tests/content/voices-viz.test.ts::the_viewer_page::it_carries_no_stray_backtick_—_the_failure_mode_this_generator_family_has
  Scenario: The viewer page contains no backtick
    Given the viewer page rendered for "../../assets/voices/index.json"
    Then the page contains no backtick character

  @test:scripts/tests/content/voices-viz.test.ts::the_viewer_page::it_is_THEMED,_so_it_carries_the_site's_top_band_(2026-10-07)
  Scenario: The viewer page is a themed page under the site layout
    Given the viewer page rendered for "../../assets/voices/index.json"
    Then it starts with front matter selecting "layout: default"
    And it contains no doctype, html, head, body, main, header or footer element
    And it contains the heading with id "vo-title"
    And every selector in its styles is scoped under ".vo-page"
    And a page rendered for scope "who-iris" among "smart-base" and "who-iris" links to "../smart-base/" and marks "who-iris" as the current page

  @test:scripts/tests/content/voices-viz.test.ts::the_viewer_page::it_names_its_own_scope,_which_is_what_makes_pruning_safe
  Scenario: The viewer page declares its own scope
    Given the viewer page rendered with no scope
    Then it declares an empty SCOPE
    And a page rendered for scope "who-iris" declares SCOPE "who-iris"

  @test:scripts/tests/content/voices-viz.test.ts::the_viewer_page::it_fetches_the_projection_at_the_href_it_was_given
  Scenario: The viewer page fetches the projection at its given href
    Given the viewer page rendered for "../../assets/voices/index.json"
    Then the page contains a fetch of "../../assets/voices/index.json"

  @test:scripts/tests/content/voices-viz.test.ts::the_viewer_page::it_escapes_interpolated_text
  Scenario: The viewer page carries an escaping function for interpolated text
    Given the viewer page rendered for "../../assets/voices/index.json"
    Then the page source contains a function that replaces "<" with "&lt;"
    # Gap: only the page source text is checked; no voice field is rendered and escaped at runtime

  @test:scripts/tests/content/voices-viz.test.ts::the_viewer_page::it_renders_the_no-citation_state_as_a_finding_rather_than_a_blank
  Scenario: The viewer page has a message for a rule with no citation
    Given the viewer page rendered for "../../assets/voices/index.json"
    Then the page contains "This rule cites nothing"
    # Gap: only the page source text is checked; the no-citation state is not rendered

  @test:scripts/tests/content/voices-viz.test.ts::the_viewer_page::it_is_dark_by_default,_and_the_site's_`light`_switch_beats_it
  Scenario: The viewer page is dark by default and follows the site's light switch
    Given the viewer page rendered for "../../assets/voices/index.json"
    Then its ".vo-page" rule starts with "color-scheme:dark"
    And it has a rule for ".vo-page" under the root attribute data-fa-scheme "light"

  @test:scripts/tests/content/voices-viz.test.ts::vendor_overrides_live_in_DECLARED_sub-graphs_of_voices::a_voice_under_`vendors/`_is_LOADED,_not_silently_skipped
  Scenario: A declared vendor override under vendors is loaded
    Given a fixture voices directory with voice "base-voice" and vendor voice "base-voice-acme" under "vendors/", both declared
    When the voices are loaded
    Then the loaded ids are "base-voice" and "base-voice-acme"

  @test:scripts/tests/content/voices-viz.test.ts::vendor_overrides_live_in_DECLARED_sub-graphs_of_voices::`vendors`_itself_is_never_loaded_AS_a_voice
  Scenario: The vendors directory is not loaded as a voice
    Given the fixture voices directory with a declared vendors sub-graph
    When the voices are loaded
    Then no loaded voice has id "vendors"

  @test:scripts/tests/content/voices-viz.test.ts::vendor_overrides_live_in_DECLARED_sub-graphs_of_voices::the_FILE_carries_the_relation,_not_the_path
  Scenario: A vendor voice's override relation comes from its file
    Given the fixture voices directory whose vendor voice declares it extends "base-voice"
    When the voices are loaded
    Then voice "base-voice-acme" extends voice id "base-voice"

  @test:scripts/tests/content/voices-viz.test.ts::vendor_overrides_live_in_DECLARED_sub-graphs_of_voices::an_UNDECLARED_directory_holding_voices_is_refused,_loudly
  Scenario: An undeclared directory holding a voice is refused
    Given the fixture voices directory plus a voice at "notes/draft" that voices.json does not declare
    When the voices are loaded
    Then loading throws an error saying it is not declared and naming voices.json

  @test:scripts/tests/content/voices-viz.test.ts::vendor_overrides_live_in_DECLARED_sub-graphs_of_voices::a_vendor_missing_from_vendors.json_is_refused,_not_skipped
  Scenario: A vendor voice not declared in vendors.json is refused
    Given the fixture voices directory plus a vendor voice "base-voice-other" that vendors.json does not declare
    When the voices are loaded
    Then loading throws an error naming vendors.json

  @test:scripts/tests/content/voices-viz.test.ts::vendor_overrides_live_in_DECLARED_sub-graphs_of_voices::the_declaration_files_are_never_loaded_AS_voices
  Scenario: The declaration files are not loaded as voices
    Given the fixture voices directory with voices.json and vendors/vendors.json
    When the voices are loaded
    Then no loaded voice has id "voices" or "vendors"

  @test:scripts/tests/content/voices-viz.test.ts::citations_carry_their_links_(qgjh)::a_library_citation_carries_the_library_resolver's_links
  Scenario: A library citation carries the library resolver's links
    Given a graph with a rule citing library item "lib-item#s1" and a library resolver that knows "lib-item"
    When the graph is projected
    Then that rule's links are the viewer link "v/#x%2Flib-item"

  @test:scripts/tests/content/voices-viz.test.ts::citations_carry_their_links_(qgjh)::a_KG-node_citation_carries_its_file_link
  Scenario: A KG-node citation carries its file link
    Given a graph with a rule citing KG node "skills/a.md" and a file resolver that knows it
    When the graph is projected
    Then that rule's links are the source link "https://host/skills/a.md"

  @test:scripts/tests/content/voices-viz.test.ts::citations_carry_their_links_(qgjh)::a_citation_nothing_resolves_carries_no_links
  Scenario: A citation no resolver knows carries no links
    Given a graph with a rule citing KG node "gone.md" that no resolver knows
    When the graph is projected
    Then that rule has no links
