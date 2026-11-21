# A package's exports follow the code subgraphs it declares and ships, and the
# check names each way they can disagree. Each Scenario names the test that executes it.
Feature: Package exports follow the declared code directories

  @test:scripts/tests/package-exports.test.ts::package-exports::a_declared,_shipped_code_directory_is_exported;_an_unshipped_one_is_not
  Scenario: A declared, shipped code directory is exported; an unshipped one is not
    Given a layer declaring src/ and test/ as code, shipping src/ only, with src exported
    Then src/ is exported, test/ is unshipped, and there is no drift

  @test:scripts/tests/package-exports.test.ts::package-exports::a_missing_pattern,_a_stray_pattern_and_a_named_entry_outside_code_are_each_named
  Scenario: A missing pattern, a stray pattern and a named entry outside code are each named
    Given exports naming a beans file and a test/ pattern, and none for src
    Then the drift names the missing src pattern, the test/* pattern exporting an undeclared directory, and the named entry ./x

  @test:scripts/tests/package-exports.test.ts::package-exports::--write_keeps_named_entries_and_makes_the_check_pass
  Scenario: Writing the expected exports keeps named entries and makes the check pass
    Given exports naming only the package root
    When the expected exports are written
    Then package.json exports the root entry and the src patterns, and the check finds no drift

  @test:scripts/tests/package-exports.test.ts::package-exports::nothing_shipped_is_cannot-tell,_never_a_pass
  Scenario: Nothing shipped is cannot-tell
    Given a package shipping no files
    Then the check cannot tell

  @test:scripts/tests/package-exports.test.ts::package-exports::this_layer's_own_package.json_agrees_with_its_declaration
  Scenario: This layer's own package.json agrees with its declaration
    When this layer's exports are checked
    Then there is no drift and tools/ is exported
