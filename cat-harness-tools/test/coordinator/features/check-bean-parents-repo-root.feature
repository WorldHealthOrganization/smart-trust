# Specifies checkBeanParents (scripts/check-bean-parents.ts) over the
# checkout's real bean store.
Feature: Every open bean in the real store belongs to an epic

  @test:test/coordinator/check-bean-parents-repo-root.test.ts::every_open_bean_belongs_to_an_epic::the_real_corpus_passes
  Scenario: The real bean store has no orphan and every open bean was counted
    Given the checkout's bean store
    When the bean parents are checked
    Then there are no orphans
    And the store was found
    And the number of open beans the check counted equals an independent count of todo or in-progress beans that are neither milestones nor epics
    And that count is more than zero
