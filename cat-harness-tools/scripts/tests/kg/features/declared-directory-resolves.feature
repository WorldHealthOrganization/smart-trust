# Every module under scripts/, content/ and src/ that resolves a declared directory by graph
# typology can do so in a fresh process, without relying on another import to register the kind.
# Each Scenario names the test that executes it.
Feature: A module that resolves a declared directory can resolve one

  @test:scripts/tests/kg/declared-directory-resolves.test.ts::a_module_that_resolves_a_declared_directory_can_resolve_one::the_scan_found_modules_—_otherwise_nothing_below_proves_anything
  Scenario: The source scan finds modules that resolve a declared directory
    Given the non-test TypeScript modules under scripts/, content/ and src/
    When they are scanned for calls to directoriesForGraph, directoryForGraph or instanceDirectoryForGraph
    Then more than 10 modules are found

  @test:scripts/tests/kg/declared-directory-resolves.test.ts::a_module_that_resolves_a_declared_directory_can_resolve_one::IMPORTING_one_writes_nothing_—_an_entry_point_must_be_guarded
  Scenario: Importing any such module leaves the working tree unchanged
    Given the git status of the checkout before the run
    When each scanned module is imported in its own bun subprocess
    Then the git status afterwards equals the status before

  @test:scripts/tests/kg/declared-directory-resolves.test.ts::a_module_that_resolves_a_declared_directory_can_resolve_one::each_one_resolves_`library`_in_a_FRESH_process,_without_throwing
  Scenario: Each such module resolves the library typology in a fresh process without throwing
    Given each scanned module
    When it is imported in a fresh bun subprocess that then calls all three directory accessors for "library"
    Then no subprocess reports "unknown graph typology" on stderr
