# The root-scan census: it reports rather than fails, so these cases pin the
# measurement's honesty. Each Scenario names the test that executes it.
Feature: Root-scan census

  @test:scripts/tests/root-scan-census.test.ts::the_census_covers_the_repository,_and_says_which_instances_it_scanned_(tqv4)::a_script_in_a_SECOND_instance_is_counted_—_moving_a_script_up_never_drops_it_from_the_census
  Scenario: Scripts in every instance are counted
    Given a repository with instances alpha and beta, each with one root-enumerating script, and gamma with no scripts directory
    When the repository is censused
    Then the rows are alpha/scripts/a.ts and beta/scripts/b.ts
    And the scope says alpha and beta "scanned" with 1 each and gamma "no-scripts-dir" with 0

  @test:scripts/tests/root-scan-census.test.ts::the_census_covers_the_repository,_and_says_which_instances_it_scanned_(tqv4)::the_sidecar_carries_the_scope,_so_a_drop_in_scope_cannot_read_as_a_drop_in_scanners
  Scenario: The sidecar carries the scope
    Given a repository with one instance alpha holding one enumerating script
    When the census sidecar is built
    Then its scope family has the one entry for alpha/scripts, "scanned", enumerating 1

  @test:scripts/tests/root-scan-census.test.ts::root-scan_census::A_CONVERTED_SCANNER_STAYS_IN_THE_DENOMINATOR
  Scenario: A converted scanner stays in the census
    Given a script that walks its root with gitFiles and one that walks it with readdirSync
    When the scripts are censused
    Then both are rows
    And the converted one is git-aware and the other is not

  @test:scripts/tests/root-scan-census.test.ts::root-scan_census::a_script_that_enumerates_but_binds_no_root_constant_is_not_censused
  Scenario: A script with no root constant is not censused
    Given a script that calls readdirSync on a local variable
    When the scripts are censused
    Then there are no rows

  @test:scripts/tests/root-scan-census.test.ts::root-scan_census::`seededAtRoot`_is_narrower_than_`enumerates`,_and_that_GAP_is_the_finding
  Scenario: seededAtRoot misses a walk through a helper
    Given a script that walks REPO_ROOT directly and one that walks it through a helper function
    When the scripts are censused
    Then the direct one is seededAtRoot and the helper one is not

  @test:scripts/tests/root-scan-census.test.ts::root-scan_census::tests_and_declaration_files_are_not_scanners
  Scenario: Tests and declaration files are not scanners
    Given a .test.ts and a .d.ts file that each walk a root
    When the scripts are censused
    Then there are no rows

  @test:scripts/tests/root-scan-census.test.ts::root-scan_census::it_is_DISCRIMINATING_over_this_repository
  Scenario: The census finds scanners in this layer's scripts
    When this layer's scripts directory is censused
    Then there are more than 20 rows and at least one is git-aware

  @test:scripts/tests/root-scan-census.test.ts::the_git-helper_roster_is_derived_from_git-corpus.ts::EVERY_exported_helper_is_recognised_as_git-aware
  Scenario: Every exported git-corpus helper is recognised as git-aware
    Given every function exported by schemas/sdlc/git-corpus.ts, more than 3 of them
    And one script per helper calling it on a root constant
    When the scripts are censused
    Then there is one row per helper and every row is git-aware

  @test:scripts/tests/root-scan-census.test.ts::the_git-helper_roster_is_derived_from_git-corpus.ts::a_converted_scanner_MOVES_to_the_good_side_rather_than_leaving
  Scenario: Converting a scanner keeps the population the same size
    Given one script walking with readdirSync and the same script converted to gitTopLevelDirs
    When each is censused
    Then both censuses have the same number of rows
    And the bare one is not git-aware while the converted one is
