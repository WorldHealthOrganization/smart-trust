# scripts/site-links.ts resolves the navbar tiles (the graph viewer, the JSON-LD graph and the forge source) to where this layer publishes, and verifies each against a built site as ok, dead or unknown.
# Each Scenario names the test that executes it.
Feature: Navbar tiles point where the layer publishes

  @test:scripts/tests/ui/site-links.test.ts::siteLinks::resolves_the_viewer_and_the_graph_through_the_published_layout
  Scenario: The viewer and graph links follow the published layout
    Given the declaration with name and stub "folio-assistant" and the forge "https://github.com/o/r"
    When its site links are resolved
    Then the viewer path is "/folio-assistant/"
    And the graph path is "/folio-assistant/folio-assistant.jsonld"
    And the source url is "https://github.com/o/r"

  @test:scripts/tests/ui/site-links.test.ts::siteLinks::never_emits_the_`/kg/`_segment_the_renderings_moved_off
  Scenario: No site link carries the old "/kg/" segment
    Given the site links for "folio-assistant" with a forge
    When each path is read
    Then none contains "/kg/"

  @test:scripts/tests/ui/site-links.test.ts::siteLinks::a_directory_URL_is_checked_against_its_INDEX,_not_the_directory
  Scenario: A directory link is checked against its index file
    Given the site links for "folio-assistant"
    When the viewer link's target is read
    Then it is "folio-assistant/index.html"

  @test:scripts/tests/ui/site-links.test.ts::siteLinks::a_stub_that_is_not_the_repo_name_still_resolves
  Scenario: A stub that differs from the name still resolves
    Given a declaration with name "smart-base" and stub "base"
    When its site links are resolved
    Then the viewer path is "/base/"
    And the graph path is "/smart-base/base.jsonld"

  @test:scripts/tests/ui/site-links.test.ts::siteLinks::no_detectable_forge_means_no_source_link,_not_a_guessed_one
  Scenario: No forge means no source link
    Given the site links for "folio-assistant" with no forge
    When they are listed
    Then none has the id "source"

  @test:scripts/tests/ui/site-links.test.ts::siteLinks::paths_are_site-ROOT-relative,_so_`relative_url`_can_prepend_the_baseurl
  Scenario: Every path is site-root-relative with no baseurl baked in
    Given the site links for "folio-assistant"
    When each link that has a path is read
    Then it starts with "/"
    And it does not start with "/folio-assistant/folio-assistant/"

  @test:scripts/tests/ui/site-links.test.ts::verifySiteLinks::a_published_target_is_ok_because_the_file_is_there
  Scenario: A published target is ok because its file exists
    Given a built site holding both the viewer index and the graph file
    When the site links are verified
    Then the viewer and the graph are "ok"
    And the exit code is 0

  @test:scripts/tests/ui/site-links.test.ts::verifySiteLinks::the_`/kg/`_build_catches_the_original_defect
  Scenario: A missing viewer is reported dead
    Given a built site holding only the graph file
    When the site links are verified
    Then the viewer is "dead" with detail naming "folio-assistant/index.html"
    And the exit code is 1

  @test:scripts/tests/ui/site-links.test.ts::verifySiteLinks::an_absent_build_is_UNKNOWN_and_exits_2_—_never_ok,_never_dead
  Scenario: An absent build is unknown and exits 2
    Given a site directory that does not exist
    When the site links, including the forge, are verified
    Then the viewer, graph and source are each "unknown"
    And none is ok or dead
    And the exit code is 2

  @test:scripts/tests/ui/site-links.test.ts::verifySiteLinks::the_forge_link_is_unknown,_and_does_not_hold_the_build_open
  Scenario: The forge link is unknown and does not fail the gate
    Given a built site holding both artefacts and links including the forge
    When the site links are verified
    Then the source is "unknown"
    And the exit code is 0

  @test:scripts/tests/ui/site-links.test.ts::the_template_and_the_data_agree::harness.json_carries_links,_each_with_exactly_one_destination
  Scenario: harness.json carries each link with exactly one destination
    # Skipped: when the harness data _data/harness.json has not been built.
    Given the built _data/harness.json
    When its links are read
    Then the "kg", "jsonld" and "source" links are present
    And each has either a path or a url, not both

  @test:scripts/tests/ui/site-links.test.ts::the_template_and_the_data_agree::no_published_link_has_the_`/kg/`_segment
  Scenario: No link in harness.json carries the "/kg/" segment
    # Skipped: when the harness data _data/harness.json has not been built.
    Given the built _data/harness.json
    When each link's path is read
    Then none contains "/kg/"

  @test:scripts/tests/ui/site-links.test.ts::the_template_and_the_data_agree::head_custom.html_READS_the_resolved_links_and_composes_no_path_of_its_own
  Scenario: head_custom.html reads the resolved links and writes no literal path
    # Gap: a source-text check; the rendered Liquid output is not checked here.
    Given the harness's _includes/head_custom.html
    When its "fa-site-links" JSON script block is read
    Then the block exists
    And it reads "site.data.harness.links"
    And it applies "l.path | relative_url"
    And it pipes no quoted literal path through relative_url

  @test:scripts/tests/ui/site-links.test.ts::the_template_and_the_data_agree::the_site_config_no_longer_draws_the_forge_link_as_header_text
  Scenario: The site config has no active aux_links
    Given the harness site's _config.yml
    When its lines are read
    Then no uncommented line starts with "aux_links"
