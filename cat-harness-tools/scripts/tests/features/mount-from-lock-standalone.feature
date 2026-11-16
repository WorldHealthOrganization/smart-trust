# mount-from-lock.ts runs alone, checked out without the rest of the layer, so
# it imports nothing but node: modules. Each Scenario names the test that executes it.
Feature: mount-from-lock.ts is self-contained

  @test:scripts/tests/mount-from-lock-standalone.test.ts::mount-from-lock.ts_is_self-contained::it_imports_only_node:_modules
  Scenario: It imports only node: modules
    When the import and export-from specifiers of mount-from-lock.ts are read
    Then there is at least one and every one starts with node:

  @test:scripts/tests/mount-from-lock-standalone.test.ts::mount-from-lock.ts_is_self-contained::a_copy_of_the_file_alone_loads_and_prints_its_usage
  Scenario: A copy of the file alone loads and prints its usage
    Given mount-from-lock.ts copied alone into an empty directory
    When it is run with --help
    Then it exits 0 and reports no missing module
