# Specifies openBeans (scripts/beans-landed.ts) over the checkout's real store.
Feature: openBeans reads the real store and returns only open, non-epic beans

  @test:test/coordinator/beans-landed-repo-root.test.ts::openBeans::reads_the_real_store_through_its_declaration,_and_excludes_epics_and_closed_beans
  Scenario: openBeans returns open beans and no epics
    Given the checkout's bean store, reached through its declaration
    When the open beans are read
    Then there is at least one
    And none is an epic
    And every one is "todo", "in-progress" or "draft"
