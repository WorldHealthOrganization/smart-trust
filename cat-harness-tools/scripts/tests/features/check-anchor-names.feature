# scripts/check-anchor-names.ts checks that a constant named for an anchor (REPO_ROOT, INSTANCE_ROOT) actually lands on that anchor, refuses the ambiguous PLATFORM, and states what it does not catch.
# Each Scenario names the test that executes it.
Feature: Anchor names land on their anchors

  @test:scripts/tests/check-anchor-names.test.ts::a_name_that_claims_an_anchor_must_land_on_it::REPO_ROOT_landing_on_an_instance_root_is_a_finding,_and_names_its_fix
  Scenario: REPO_ROOT landing on an instance root is a finding that names its fix
    Given a repo with one layer "cat-harness" whose scripts/tests/a.ts sets REPO_ROOT two levels up
    When the anchor names are checked
    Then there is 1 finding
    And its detail says "rename it to `INSTANCE_ROOT`"

  @test:scripts/tests/check-anchor-names.test.ts::a_name_that_claims_an_anchor_must_land_on_it::INSTANCE_ROOT_landing_on_the_repository_root_is_a_finding_the_other_way
  Scenario: INSTANCE_ROOT landing on the repository root is a finding the other way
    Given a layer file that sets INSTANCE_ROOT three levels up
    When the anchor names are checked
    Then there is 1 finding
    And its detail says "rename it to `REPO_ROOT`"

  @test:scripts/tests/check-anchor-names.test.ts::a_name_that_claims_an_anchor_must_land_on_it::%s_is_clean_—_%s
  Scenario: A correctly named anchor or a name claiming no anchor is clean
    Given a layer file holding one of these ascents
    When the anchor names are checked
    Then there are no findings
    # Rows: INSTANCE_ROOT two levels up, REPO_ROOT three levels up, OUT_DIR resolving to "../build".

  @test:scripts/tests/check-anchor-names.test.ts::a_symbolic_link_is_not_walked::a_file_reached_through_a_link_is_judged_at_its_real_path_only
  Scenario: A file reached through a symbolic link is judged at its real path only
    Given a layer whose scripts/tests/a.ts sets INSTANCE_ROOT correctly
    And a "content/scripts" link pointing back at "../scripts"
    When the anchor names are checked
    Then exactly 1 file is read
    And there are no findings

  @test:scripts/tests/check-anchor-names.test.ts::PLATFORM_is_refused_because_it_means_two_things_HERE::it_is_a_finding_wherever_it_lands
  Scenario: PLATFORM is a finding wherever it lands
    Given one layer file setting PLATFORM two levels up and another setting it three levels up
    When each is checked
    Then each has 1 finding
    And the first suggests "`INSTANCE_ROOT`" and the second "`REPO_ROOT`"

  @test:scripts/tests/check-anchor-names.test.ts::PLATFORM_is_refused_because_it_means_two_things_HERE::the_vocabulary_is_the_reason,_not_a_style_preference
  Scenario: PLATFORM and platformRoot are in the ambiguous vocabulary
    When AMBIGUOUS_NAMES is tested against "PLATFORM" and "platformRoot"
    Then both match

  @test:scripts/tests/check-anchor-names.test.ts::what_this_check_does_NOT_claim::a_re-rooted_ascent_with_a_truthful_name_passes_—_the_defect_is_NOT_caught
  Scenario: A re-rooted ascent with a truthful name passes, so that defect is not caught
    Given a layer file setting INSTANCE_ROOT two levels up
    When the anchor names are checked
    Then there are no findings

  @test:scripts/tests/check-anchor-names.test.ts::what_this_check_does_NOT_claim::EXAMINED_NOTHING_is_not_a_pass
  Scenario: A tree with nothing to examine reports zero files read
    Given an empty directory
    When the anchor names are checked
    Then filesRead is 0
    # Gap: only the count is asserted; nothing checks that the result is reported as not a pass.

  @test:scripts/tests/check-anchor-names.test.ts::what_this_check_does_NOT_claim::instances_are_discovered_by_harness.json,_never_listed
  Scenario: Instances are discovered by their declaration, never listed
    Given a repo with layers "cat-harness" and "who-iris", each with a declaration file
    When instanceDirs is read
    Then it returns "cat-harness" and "who-iris"

  @test:scripts/tests/check-anchor-names.test.ts::a_quoted_example_of_an_ascent_is_not_an_ascent::a_fixture_string_is_skipped_—_this_file_would_otherwise_report_itself
  Scenario: An ascent quoted inside a string is skipped
    Given a layer file with a sample REPO_ROOT ascent inside a string and one real correctly named ascent
    When the anchor names are checked
    Then 1 ascent is counted
    And there are no findings

  @test:scripts/tests/check-anchor-names.test.ts::every_spelling_of_the_base_is_matched::resolve(%s,_...)_is_an_ascent_—_%s
  Scenario: Each spelling of the base directory makes a resolve() call an ascent
    Given a layer file setting REPO_ROOT by resolve from the base two levels up
    When the anchor names are checked
    Then 1 ascent is counted
    And there is 1 finding saying "rename it to `INSTANCE_ROOT`"
    # Rows: import.meta.dir, __dirname, dirname(fileURLToPath(import.meta.url)), dirname(__filename).

  @test:scripts/tests/check-anchor-names.test.ts::every_spelling_of_the_base_is_matched::join(%s,_...)_is_an_ascent_too_—_%s
  Scenario: Each spelling of the base directory makes a join() call an ascent
    Given a layer file setting REPO_ROOT by join from the base two levels up
    When the anchor names are checked
    Then 1 ascent is counted
    And there is 1 finding
    # Rows: import.meta.dir, __dirname, dirname(fileURLToPath(import.meta.url)), dirname(__filename).

  @test:scripts/tests/check-anchor-names.test.ts::every_spelling_of_the_base_is_matched::a_correctly-named_anchor_in_a_dirname()_spelling_stays_clean
  Scenario: A correctly named anchor in a dirname() spelling stays clean
    Given a layer file setting INSTANCE_ROOT from dirname(fileURLToPath(import.meta.url)) two levels up
    When the anchor names are checked
    Then 1 ascent is counted
    And there are no findings

  @test:scripts/tests/check-anchor-names.test.ts::every_spelling_of_the_base_is_matched::whitespace_inside_the_dirname()_call_does_not_hide_the_ascent
  Scenario: Whitespace inside the dirname() call does not hide the ascent
    Given a layer file setting REPO_ROOT from a dirname(fileURLToPath(...)) call padded with spaces
    When the anchor names are checked
    Then 1 ascent is counted
    And there is 1 finding
