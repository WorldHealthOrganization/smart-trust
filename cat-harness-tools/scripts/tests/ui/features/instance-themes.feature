# scripts/check-instance-themes.ts (check:instance-themes): the gate that covers the themes kind, resolving each
# instance's themes directory and reporting theme kinds without grading them. Each Scenario names the test that executes it.
Feature: check:instance-themes covers the themes kind

  @test:scripts/tests/ui/instance-themes.test.ts::the_repository_passes_as_committed::`--check`_is_green
  Scenario: check:instance-themes passes on the repository as committed
    Given the repository checkout
    When check-instance-themes.ts is run with "--check"
    Then its output contains "instances read"
    And it exits 0

  @test:scripts/tests/ui/instance-themes.test.ts::the_repository_passes_as_committed::every_count_carries_its_denominator
  Scenario: Every count in the report carries its denominator
    Given the repository checkout
    When check-instance-themes.ts is run without flags
    Then its output has a "...declaring a themes graph N of M" line

  @test:scripts/tests/ui/instance-themes.test.ts::the_declaration_matches_the_scan_set_—_z6xd_itself::exactly_one_script_declares_`@covers_themes`,_and_it_is_this_one
  Scenario: Exactly one script declares it covers themes, and it is check-instance-themes.ts
    Given every .ts script in the harness and tools scripts directories
    When each script's @covers kinds are read with the auditor's own parser
    Then the only script claiming "themes" is "check-instance-themes.ts"

  @test:scripts/tests/ui/instance-themes.test.ts::the_declaration_matches_the_scan_set_—_z6xd_itself::the_claimant_actually_resolves_a_themes_directory
  Scenario: The themes claimant resolves a themes directory
    # Gap: a source-text check; it does not run the directory resolution
    Given the source of check-instance-themes.ts
    When it is read
    Then it contains "instanceDirectoriesForGraph"
    And it contains "THEMES_GRAPH_TYPOLOGY"

  @test:scripts/tests/ui/instance-themes.test.ts::the_declaration_matches_the_scan_set_—_z6xd_itself::the_three_former_claimants_declare_`none`_WITH_a_reason
  Scenario: The three former themes claimants declare none with a reason
    Given check-theme-art.ts, gen-themes-css.ts and render-theme-sheet.ts
    When each one's @covers kinds are read
    Then each declares exactly ["none"]
    And each "@covers none" line carries a reason longer than 8 characters

  @test:scripts/tests/ui/instance-themes.test.ts::one_answer,_not_two::it_calls_the_runtime's_own_resolution_rather_than_re-deriving_it
  Scenario: The gate imports the runtime's own theme resolution
    # Gap: a source-text check of the import line; it does not compare results with the generators
    Given the source of check-instance-themes.ts
    When its imports are read
    Then it imports instanceThemes from the schemas theme-by-ref.js module

  @test:scripts/tests/ui/instance-themes.test.ts::kinds_are_reported,_never_graded::a_declaring_instance_with_no_`sticky`_theme_is_still_green
  Scenario: A declaring instance with no sticky theme is still green
    Given a fixture checkout with one layer "acme" whose themes graph holds only a "webpage" theme
    When check-instance-themes.ts is run there with "--check"
    Then its output lists "webpage" among the kinds
    And its output does not mention "sticky"
    And it exits 0

  @test:scripts/tests/ui/instance-themes.test.ts::kinds_are_reported,_never_graded::the_kinds_line_is_printed,_so_the_gap_is_visible_without_being_fatal
  Scenario: The kinds line is printed
    Given the repository checkout
    When check-instance-themes.ts is run without flags
    Then its output contains a "kinds: " line

  @test:scripts/tests/ui/instance-themes.test.ts::could-not-determine_is_never_green::an_empty_declaring_set_is_reported_as_a_determined_empty,_not_a_pass
  Scenario: An empty declaring set is reported as a determined empty
    # Gap: a source-text check; the empty-set branch is not executed
    Given the source of check-instance-themes.ts
    When it is read
    Then it contains "determined empty rather than a clean sweep"
    And it contains "nothing to check"

  @test:scripts/tests/ui/instance-themes.test.ts::could-not-determine_is_never_green::a_themes_module_that_throws_refuses_rather_than_counting_zero
  Scenario: A themes module that throws refuses rather than counting zero
    # Gap: a source-text check; no throwing themes module is run
    Given the source of check-instance-themes.ts
    When it is read
    Then it contains "a module that throws is not a module that has no themes"
