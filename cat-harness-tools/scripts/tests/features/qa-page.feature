# The integrated QA page of an instance (owner, 2026-11-24: "build integrated
# page into platform"): one tile per QA axis from the published manifest's
# listing, a section per axis drawn when opened, a record fetched when its row
# is opened. The script runs in a VM with a stub DOM and a stub fetch. Each
# Scenario names the test that executes it.
Feature: An instance's integrated QA page

  @test:scripts/tests/qa-page.test.ts::qaLiveSourceOf::names_the_layer's_repository,_pinned_commit,_branch_and_entry_root
  Scenario: The live source names repository, pinned commit, branch and entry root
    Given layer "fhir-harness" with path "test/results/" and storage "cat/cat-harness/qa-reports", mounted at a pinned commit
    When its live source is derived
    Then it names the repository, the commit, the branch, and root "fhir-harness/test/results"

  @test:scripts/tests/qa-page.test.ts::qaLiveSourceOf::is_undefined_without_a_storage_branch_or_a_plain_pin
  Scenario: No live source without a storage branch or a plain pin
    Then there is no live source without storage, without a mount, with ref "main", or with a storage value holding markup

  @test:scripts/tests/qa-page.test.ts::qaIntegratedPanel::carries_the_source_as_data_attributes,_a_no-script_link_and_the_further_sections
  Scenario: The panel carries the source, a no-script link and the further sections
    When the panel is rendered with a "health" section
    Then it carries data-repo, data-ref and data-root, a <noscript> element and a link to the health page

  @test:scripts/tests/qa-page.test.ts::qaIntegratedPanel::holds_nothing_Liquid_would_evaluate
  Scenario: The panel holds nothing Liquid would evaluate
    When the panel is rendered
    Then it contains neither "{{" nor "{%"

  @test:scripts/tests/qa-page.test.ts::qaIntegratedPanel::names_no_forge_host_in_the_script:_the_forge_is_data
  Scenario: The forge is an input, not a literal
    Then the page script names no forge host
    And a panel for another forge carries none of GitHub's

  @test:scripts/tests/qa-page.test.ts::the_page_script::one_tile_per_axis_from_the_listing_alone:_no_tree_API_call,_other_roots_ignored
  Scenario: One tile per axis from the listing alone
    Given the pinned commit's manifest lists two KG records, one rendering record, one unclassified record and one record of another layer
    When the page script runs
    Then it fetches the manifest and nothing else
    And the Knowledge graph tile says "fail" with "1 fail · 0 unknown · 1 pass · 2 n/a"
    And the Rendering tile says "warn" and comes before the Knowledge graph tile
    And the unclassified record is "not counted", and the other layer's record is not drawn

  @test:scripts/tests/qa-page.test.ts::the_page_script::a_declared_axis_with_nothing_published_is_unknown,_never_absent_or_zero
  Scenario: A declared axis with nothing published is unknown
    Given the instance declares the "lean" axis
    When the page script runs
    Then the Lean tile says "unknown" and "nothing published"

  @test:scripts/tests/qa-page.test.ts::the_page_script::a_declared_writer's_globs_put_its_files_on_its_axis
  Scenario: A declared writer's globs place its files
    Given the instance declares a compute writer writing "odd/**"
    When the page script runs
    Then the record under odd/ is on the Compute tile and nothing is unclassified

  @test:scripts/tests/qa-page.test.ts::the_page_script::a_section's_table_is_drawn_on_open,_and_a_row_fetches_its_record's_checks
  Scenario: Sections and records load when opened
    When the Knowledge graph section is opened and the "tool:b" row is clicked
    Then the record is fetched and its checks are shown, failures first, with "Task_X: names no tool"

  @test:scripts/tests/qa-page.test.ts::the_page_script::an_entry_with_no_listing_falls_back_to_the_tree_listing,_and_says_so
  Scenario: An entry published before the listing falls back to the forge's tree, and says so
    Given the manifest carries no listing
    When the page script runs
    Then it says the entry "predates the published listing" and counts nothing until a section is opened

  @test:scripts/tests/qa-page.test.ts::the_page_script::falls_back_to_the_newest_main_entry_and_says_it_is_another_commit's
  Scenario: The script falls back to the newest main entry and says so
    Given no entry at the pinned commit, and an index whose main entry is another commit
    When the page script runs
    Then it says "ANOTHER commit"

  @test:scripts/tests/qa-page.test.ts::the_page_script::a_layer_with_no_branch_is_'not_available',_never_an_empty_page
  Scenario: A layer with no published results is not available, not an empty page
    Given every fetch answers 404
    When the page script runs
    Then it says "no QA results are published for this instance yet"

  @test:scripts/tests/qa-page.test.ts::the_page_script::an_unreachable_forge_is_unknown,_not_zero
  Scenario: An unreachable forge is unknown, not zero
    Given the pinned commit's manifest answers 503
    When the page script runs
    Then it says "unknown, not zero"

  @test:scripts/tests/qa-page.test.ts::the_page_and_the_publisher_share_one_vocabulary::the_config_the_page_carries_is_the_schema_module's
  Scenario: The page and the publisher share one vocabulary
    Then the page's axes, titles, format rules and forge are the schema module's own
