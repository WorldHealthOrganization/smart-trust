# scripts/ensure-software.ts gets a missing program by a ladder of apt, pip and a pinned, sha256-checked GitHub release,
# driven here through an injected machine so no installer runs; it also checks the declared software table and --for selection.
# Each Scenario names the test that executes it.
Feature: Ensure required software is installed

  @test:scripts/tests/ensure-software.test.ts::the_ladder::present_is_present:_nothing_is_installed
  Scenario: Software already present is not installed again
    Given a machine that already has the "tesseract" command
    When tesseract is ensured
    Then it is reported "present" with no attempts
    And no apt-get command is run

  @test:scripts/tests/ensure-software.test.ts::the_ladder::apt_installs,_after_one_`apt-get_update`_when_the_package_lists_are_stale
  Scenario: Apt installs after updating stale package lists
    Given a machine whose apt install fails until the package lists are updated, and which then gets "tesseract"
    When tesseract is ensured
    Then it is reported as installed by "apt"
    And "apt-get update -q" was run

  @test:scripts/tests/ensure-software.test.ts::the_ladder::not_root_and_no_sudo:_apt_is_reported_as_not_offered,_never_skipped_silently
  Scenario: Without root or sudo, apt is reported as not offered
    Given a machine where the user is not root and sudo fails
    When tesseract is ensured
    Then it is reported "missing"
    And its first attempt is the "apt" rung with outcome "not-offered"
    And the rungs attempted are "apt", "pip" and "github"

  @test:scripts/tests/ensure-software.test.ts::the_ladder::pip_retries_with_--break-system-packages_on_an_externally_managed_interpreter
  Scenario: Pip retries with --break-system-packages on an externally managed interpreter
    Given a machine whose pip refuses as an externally managed environment unless "--break-system-packages" is passed
    When pymupdf is ensured
    Then it is reported as installed by "pip"
    And a command with "--break-system-packages" was run

  @test:scripts/tests/ensure-software.test.ts::the_ladder::--check_reports_and_installs_nothing
  Scenario: Check-only mode reports a missing program and installs nothing
    Given a machine missing tesseract whose apt could supply it
    When tesseract is ensured in check-only mode
    Then it is reported "missing"
    And no apt-get command is run

  @test:scripts/tests/ensure-software.test.ts::a_GitHub_release_is_installed_only_when_its_checksum_matches::a_matching_sha256_installs_the_binary_into_the_bin_dir
  Scenario: A release asset with a matching sha256 is installed
    # Gap: the binary's presence in the bin dir is not checked, only the reported state
    Given a GitHub release entry whose linux-x64 asset sha256 matches the fetched bytes
    When the entry is ensured
    Then it is reported as installed by "github"

  @test:scripts/tests/ensure-software.test.ts::a_GitHub_release_is_installed_only_when_its_checksum_matches::a_mismatched_sha256_installs_nothing
  Scenario: A release asset with a mismatched sha256 is not installed
    Given a GitHub release entry whose sha256 does not match the fetched bytes
    When the entry is ensured
    Then it is reported "missing"
    And the last attempt's detail says "not installed"

  @test:scripts/tests/ensure-software.test.ts::a_GitHub_release_is_installed_only_when_its_checksum_matches::no_asset_for_this_platform,_or_a_403,_is_said_as_such
  Scenario: A 403 fetching the release asset is reported as such
    # Gap: only the 403 case is checked, not a platform with no asset
    Given a GitHub release entry and a machine whose fetch answers 403
    When the entry is ensured
    Then the last attempt's detail contains "403"

  @test:scripts/tests/ensure-software.test.ts::the_declared_table::every_entry_has_a_way_to_get_it,_and_every_GitHub_asset_is_pinned_and_checksummed
  Scenario: Every declared software entry can be got, and GitHub assets are pinned and checksummed
    Given the declared software table
    Then it is not empty
    And every entry offers apt, pip or a GitHub release
    And every GitHub asset has a 64-hex sha256
    And no GitHub entry is pinned to the tag "latest"

  @test:scripts/tests/ensure-software.test.ts::the_declared_table::--for_picks_what_a_script_needs;_an_unknown_name_is_returned,_never_dropped
  Scenario: Selection picks what a script needs and returns unknown names
    Given the declared software table
    When software is selected for "cat-harness/scripts/pdf-ocr.py"
    Then "pdftoppm" and "tesseract" are picked
    When "tesseract" and "nope" are selected by name
    Then "nope" is returned as unknown
