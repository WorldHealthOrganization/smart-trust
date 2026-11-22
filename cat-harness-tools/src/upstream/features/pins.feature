# src/upstream/pins.ts reads each upstream pin out of the file the build reads and
# judges it current, behind or unknown against upstream's release tags.
# Each Scenario names the test that executes it.
Feature: Upstream version pins

  @test:src/upstream/pins.test.ts::readPin::reads_the_ref_out_of_the_file_the_build_reads
  Scenario: The pinned ref is read out of the file the build reads
    Given a config file with the line "remote_theme: just-the-docs/just-the-docs@v0.12.0"
    When the pin is read with the just-the-docs pattern
    Then the pinned ref is "v0.12.0"

  @test:src/upstream/pins.test.ts::readPin::an_UNPINNED_line_does_not_match,_so_the_caller_reports_unknown
  Scenario: An unpinned line does not match
    Given a config file with "remote_theme: just-the-docs/just-the-docs" and no "@" ref
    When the pin is read with the just-the-docs pattern
    Then no ref is read

  @test:src/upstream/pins.test.ts::readPin::a_commented-out_pin_is_not_read_as_the_pin
  Scenario: A commented-out pin is not read as the pin
    Given a config file with a commented-out pin at "v0.11.0" followed by a live pin at "v0.12.0"
    When the pin is read with the just-the-docs pattern
    Then the pinned ref is "v0.12.0"

  @test:src/upstream/pins.test.ts::compareVersions::orders_numerically,_not_lexicographically
  Scenario: Versions are ordered numerically, not lexicographically
    When "v0.9.0" is compared with "v0.12.0"
    Then "v0.9.0" is the older
    And "v0.12.0" compared with "v0.9.0" is the newer
    And "v0.12.0" compared with itself is equal

  @test:src/upstream/pins.test.ts::compareVersions::an_unparseable_tag_never_sorts_newest
  Scenario: An unparseable tag never sorts newest
    When "nightly" is compared with "v0.1.0"
    Then "nightly" is the older

  @test:src/upstream/pins.test.ts::releases::keeps_only_what_tagPattern_admits,_oldest_first
  Scenario: Releases keep only the tags the tag pattern admits, oldest first
    Given the tags "v0.9.0", "v0.10.0", "v0.10.1", "v0.11.2", "v0.12.0" and "v0.4.0.rc1"
    When the releases are taken with a "vX.Y.Z" tag pattern
    Then they are "v0.9.0", "v0.10.0", "v0.10.1", "v0.11.2" and "v0.12.0", in that order

  @test:src/upstream/pins.test.ts::assessPin::at_the_newest_release_is_current
  Scenario: A pin at the newest release is current
    Given the just-the-docs tags, newest release "v0.12.0"
    When a pin at "v0.12.0" is assessed
    Then its state is "current"
    And it is behind by no releases

  @test:src/upstream/pins.test.ts::assessPin::behind_reports_every_release_in_between,_oldest_first
  Scenario: A pin behind reports every release in between, oldest first
    Given the just-the-docs tags, newest release "v0.12.0"
    When a pin at "v0.10.0" is assessed
    Then its state is "behind"
    And it is behind by "v0.10.1", "v0.11.2" and "v0.12.0", in that order
    And the latest release is "v0.12.0"

  @test:src/upstream/pins.test.ts::assessPin::an_unreachable_remote_is_unknown,_NEVER_current
  Scenario: An unreachable remote is unknown, never current
    Given the tags could not be read
    When a pin at "v0.12.0" is assessed
    Then its state is "unknown"
    And the detail says "could not read tags"

  @test:src/upstream/pins.test.ts::assessPin::a_pattern_that_matched_nothing_is_unknown,_not_'unpinned'
  Scenario: A pattern that matched nothing is unknown
    Given the just-the-docs tags
    When a pin with no ref read is assessed
    Then its state is "unknown"
    And the detail says the pattern "drifted"

  @test:src/upstream/pins.test.ts::assessPin::a_ref_upstream_does_not_list_is_unknown,_not_behind_by_everything
  Scenario: A ref upstream does not list is unknown, not behind by everything
    Given the just-the-docs tags
    When a pin at "ba03257" is assessed
    Then its state is "unknown"
    And no behind-by list is given

  @test:src/upstream/pins.test.ts::assessPin::no_tag_matches_the_pattern_at_all
  Scenario: A pin is unknown when no tag matches the tag pattern
    Given upstream tags "nightly" and "latest" only
    When a pin at "v0.12.0" is assessed
    Then its state is "unknown"

  @test:src/upstream/pins.test.ts::exitCode::unknown_outranks_behind,_and_both_outrank_current
  Scenario: The exit code ranks unknown over behind over current
    Given a current, a behind and an unknown verdict
    Then the exit code for the current verdict alone is 0
    And for current and behind it is 1
    And for current, behind and unknown it is 2

  @test:src/upstream/pins.test.ts::render::names_the_governing_process,_so_the_reader_can_act_without_opening_anything
  Scenario: The rendered report names the governing process
    Given a pin at "v0.10.0" assessed against the just-the-docs tags
    When the verdicts are rendered
    Then the output names "upstream-version-adoption"
    And it names the latest release "v0.12.0"

  @test:src/upstream/pins.test.ts::render::an_empty_registry_says_so_rather_than_rendering_a_green_table
  Scenario: An empty registry says so rather than rendering a green table
    When no verdicts are rendered
    Then the output says "declares no pins"

  @test:src/upstream/pins.test.ts::tagPrefix::WITHOUT_it_the_verdict_is_`unknown`,_which_is_the_defect_it_fixes
  Scenario: Without a tag prefix a bare Bun version is unknown
    Given the Bun pin with its "bun-v" tag prefix removed and tags "bun-v1.3.11" to "bun-v1.4.2"
    When a pin at "1.3.14" is assessed
    Then its state is "unknown"
    And the exit code is 2

  @test:src/upstream/pins.test.ts::tagPrefix::WITH_it,_a_pin_behind_upstream_reads_`behind`,_counting_only_newer_releases
  Scenario: With a tag prefix a pin behind upstream reads behind, counting only newer releases
    Given the Bun pin with tag prefix "bun-v" and tags "bun-v1.3.11" to "bun-v1.4.2"
    When a pin at "1.3.14" is assessed
    Then its state is "behind"
    And it is behind by "bun-v1.4.0", "bun-v1.4.1" and "bun-v1.4.2"
    And the latest release is "bun-v1.4.2"
    And the pinned ref is reported as the file's literal "1.3.14"

  @test:src/upstream/pins.test.ts::tagPrefix::the_newest_release_reads_`current`
  Scenario: With a tag prefix the newest release reads current
    Given the Bun pin with tag prefix "bun-v"
    When a pin at "1.4.2" is assessed
    Then its state is "current"

  @test:src/upstream/pins.test.ts::tagPrefix::a_literal_upstream_never_tagged_is_still_`unknown`,_not_`behind`
  Scenario: A prefixed literal upstream never tagged is still unknown
    Given the Bun pin with tag prefix "bun-v"
    When a pin at "1.3.99" is assessed
    Then its state is "unknown"
    And the detail names "bun-v1.3.99"

  @test:src/upstream/pins.test.ts::tagPrefix::an_absent_prefix_leaves_every_existing_pin's_behaviour_untouched
  Scenario: An absent tag prefix leaves an existing pin's behaviour untouched
    Given the just-the-docs pin, which declares no tag prefix
    When a pin at "v0.11.2" is assessed
    Then its state is "behind"
    And a pin at "v0.12.0" is "current"

  @test:src/upstream/pins.test.ts::locatePins_—_each_row_resolves_against_the_layer_that_declares_it_(folio-assistant#1481)::a_row_resolves_against_ITS_registry's_root,_not_the_harness's
  Scenario: A pin row resolves against its own registry's root
    Given a cat-harness registry at "/h" declaring just-the-docs and a cat-harness-tools registry at "/t" declaring pdfjs
    When the pins are located
    Then just-the-docs is in layer cat-harness at "/h/docs/_config.yml"
    And pdfjs is in layer cat-harness-tools at "/t/scripts/pdf-viewer.ts"

  @test:src/upstream/pins.test.ts::locatePins_—_each_row_resolves_against_the_layer_that_declares_it_(folio-assistant#1481)::the_same_id_in_two_registries_is_reported_twice,_never_merged
  Scenario: The same pin id in two registries is located twice, never merged
    Given the pdfjs pin declared in both the cat-harness and cat-harness-tools registries
    When the pins are located
    Then two located pins are returned

  @test:src/upstream/pins.test.ts::locatePins_—_each_row_resolves_against_the_layer_that_declares_it_(folio-assistant#1481)::a_missing_file_is_unknown,_and_says_the_file_is_missing_rather_than_that_the_pattern_drifted
  Scenario: A missing pinned file is unknown and says the file is missing
    Given the pdfjs pin located in cat-harness
    When the verdict for its missing file is made
    Then its state is "unknown"
    And the detail says "scripts/pdf-viewer.ts is not in cat-harness"
    And the detail does not say "pattern has drifted"
    And the exit code is 2

  @test:src/upstream/pins.test.ts::this_layer's_own_registry::every_row's_pinnedIn_file_is_in_this_layer,_and_its_pattern_reads_a_ref_out_of_it
  Scenario: Every row of this layer's registry reads a ref out of a file in this layer
    Given this layer's "upstream/upstream-pins.json" registry
    Then it declares at least one pin
    And every pin's pinnedIn file exists in this layer
    And its pattern reads a ref containing a digit out of that file
