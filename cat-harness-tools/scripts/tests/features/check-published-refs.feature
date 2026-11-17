# scripts/check-published-refs.ts holds that a SHA may stage but only a version may publish: it
# classifies the refs of instance dependencies and asset sources, and never reads examining nothing as a pass.
# Each Scenario names the test that executes it.
Feature: Published references are pinned by version

  @test:scripts/tests/check-published-refs.test.ts::classifyRef::accepts_a_version,_with_or_without_the_tag's_leading_v
  Scenario: A version is classified as semver, with or without a leading v
    When "1.2.3", "v1.2.3" and "1.2.3-rc.1" are classified
    Then each is "semver"

  @test:scripts/tests/check-published-refs.test.ts::classifyRef::calls_a_SHA_a_SHA,_at_both_git's_lengths
  Scenario: Short and full SHAs are classified as sha
    When the 7-character "50d2369" and its 40-character form are classified
    Then each is "sha"

  @test:scripts/tests/check-published-refs.test.ts::classifyRef::names_FHIR's_pseudo-versions_separately_from_a_branch
  Scenario: FHIR pseudo-versions are distinct from branches
    When "current" and "dev" are classified
    Then each is "prerelease"
    And "main" and "release-2026" are "moving"

  @test:scripts/tests/check-published-refs.test.ts::classifyRef::absent_and_empty_are_`unpinned`_—_`current`_by_omission
  Scenario: An absent or blank ref is unpinned
    When no ref and a whitespace-only ref are classified
    Then each is "unpinned"

  @test:scripts/tests/check-published-refs.test.ts::carrier_1_—_instance_dependencies::a_SHA-pinned_dependency_is_a_MAJOR_finding
  Scenario: A SHA-pinned dependency is a major finding
    Given an instance config with a folioAssistant dependency "core" pinned by a 40-character SHA ref
    When the dependency refs are audited
    Then 1 dependency is examined
    And the first finding is of kind "sha" at severity "major"

  @test:scripts/tests/check-published-refs.test.ts::carrier_1_—_instance_dependencies::a_version_passes,_and_`version`_wins_over_a_`ref`_left_behind
  Scenario: A version passes even with a branch ref left behind
    Given a dependency "core" with version "1.2.3" and ref "main"
    When the dependency refs are audited
    Then there are no findings

  @test:scripts/tests/check-published-refs.test.ts::carrier_1_—_instance_dependencies::a_branch_is_a_finding,_and_says_WHY_rather_than_just_naming_it
  Scenario: A branch ref is a finding that says why
    Given a dependency "core" with ref "main" and no version
    When the dependency refs are audited
    Then the finding is of kind "moving"
    And its detail contains "different content later"

  @test:scripts/tests/check-published-refs.test.ts::carrier_1_—_instance_dependencies::an_unreadable_config_is_a_finding,_NOT_an_empty_dependency_set
  Scenario: An unreadable config is a finding, not an empty dependency set
    Given an instance config holding "{ not json"
    When the dependency refs are audited
    Then there is exactly one finding

  @test:scripts/tests/check-published-refs.test.ts::carrier_2_—_asset_sources::an_asset_with_no_`source`_is_not_examined_—_authored_here_is_a_third_state
  Scenario: An asset with no source is not examined
    Given a declaration with an asset "A.md" that has no source
    When the asset source refs are audited
    Then 0 assets are examined

  @test:scripts/tests/check-published-refs.test.ts::carrier_2_—_asset_sources::a_`source`_with_no_ref_is_`unpinned`,_at_MINOR
  Scenario: An asset source with no ref is unpinned at minor severity
    Given an asset whose source names instance "o/r" and path "A.md" with no ref
    When the asset source refs are audited
    Then the finding is of kind "unpinned" at severity "minor"

  @test:scripts/tests/check-published-refs.test.ts::carrier_2_—_asset_sources::this_repository_names_no_asset_source_now,_and_the_carrier_SAYS_so_rather_than_reading_clean
  Scenario: This repository's asset sources carry no agent-instructions finding, and an empty sweep says so
    Given the repository this checkout sits in
    When the asset source refs are audited
    Then no finding is for "agent-instructions"
    And if nothing was examined, the note contains "authored in place"
    # Gap: when some asset source is examined, nothing about the note is checked

  @test:scripts/tests/check-published-refs.test.ts::provenance_is_not_a_reference::the_keys_are_DECLARED,_so_adding_one_is_a_decision
  Scenario: Provenance keys are declared
    Then the declared provenance keys include "stagingSha" and "sourceCommitSha"

  @test:scripts/tests/check-published-refs.test.ts::provenance_is_not_a_reference::the_published-graph_carrier_says_the_stamp_is_out_of_scope,_and_why
  Scenario: The published-graph carrier says the build stamp is provenance
    When the published-graph refs of "." are read
    Then the note contains "PROVENANCE"

  @test:scripts/tests/check-published-refs.test.ts::examining_nothing_is_never_a_pass::an_empty_repository_reports_NOTHING_WAS_EXAMINED
  Scenario: An empty repository reports that nothing was examined
    Given an empty directory
    When its published refs are audited and the report formatted
    Then the report contains "NOTHING WAS EXAMINED"
    And it contains "not a pass"

  @test:scripts/tests/check-published-refs.test.ts::examining_nothing_is_never_a_pass::every_carrier_with_nothing_examined_explains_why
  Scenario: Every carrier that examined nothing carries a note
    Given an empty directory
    When its published refs are audited
    Then every carrier with 0 examined has a note

  @test:scripts/tests/check-published-refs.test.ts::examining_nothing_is_never_a_pass::the_report_states_that_previews_are_out_of_scope_BY_DESIGN
  Scenario: The report mentions staging
    Given the repository this checkout sits in
    When its published refs are audited and the report formatted
    Then the report contains "STAGING"
    # Gap: only the word "STAGING" is checked, not a statement that previews are out of scope by design
