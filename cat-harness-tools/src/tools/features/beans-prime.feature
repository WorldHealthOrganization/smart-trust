# The no-CLI fallback of src/tools/beans-prime.ts primes an agent with the beans listed in the
# repository's declared bean-defs store. Each Scenario names the test that executes it.
Feature: The work-plan primer's fallback reads the declared bean store

  @test:src/tools/beans-prime.test.ts::beans-prime's_fallback_reads_the_declared_store::the_declared_bean-defs_directory_primes_the_real_beans
  Scenario: The declared bean-defs directory primes the real beans
    Given this checkout's declared bean-defs directory
    Then the directory is declared
    And it holds more than one Markdown file
    And priming from it lists one line per Markdown file

  @test:src/tools/beans-prime.test.ts::beans-prime's_fallback_reads_the_declared_store::the_old_spelling_primed_the_README_alone_—_the_defect_this_replaced
  Scenario: The old spelling primed the README alone, the defect this replaced
    Given the repository's "beans" directory, the old spelling
    When the primer reads it
    Then exactly one item is listed
