# sibling-root writes the two root files into a sibling layout and never
# overwrites a different file without --force. Each Scenario names the test
# that executes it.
Feature: Sibling layout root files

  @test:scripts/tests/sibling-root.test.ts::sibling-root::the_index_names_the_four_siblings_as_local_instances_and_validates
  Scenario: The root index names the siblings as local instances
    When the sibling root files are generated
    Then index.config.json validates and names each sibling as a local instance at its directory
    And package.json's only script is cat, running run-script.ts

  @test:scripts/tests/sibling-root.test.ts::sibling-root::writes_both_files,_then_reports_them_current
  Scenario: The root files are written, then current
    # Gap: only package.json's content is checked; index.config.json is not read back, and "current" is inferred from a second exit 0.
    Given a layout holding all four siblings
    When the root is written
    Then it exits 0 and package.json is the generated text
    And writing again exits 0

  @test:scripts/tests/sibling-root.test.ts::sibling-root::refuses_a_different_existing_file_unless_--force
  Scenario: A different existing file is refused unless forced
    Given a layout with a different package.json
    Then writing exits 1 and leaves it unchanged
    And writing with force exits 0 and replaces it with the generated text

  @test:scripts/tests/sibling-root.test.ts::sibling-root::a_layout_missing_a_sibling_is_exit_2_and_writes_nothing
  Scenario: A layout missing a sibling is refused
    Given a layout missing bootstrap
    When the root is written
    Then it exits 2 and index.config.json does not exist
