# Every bean: an fsh-guts record carries (outside frozen subtrees) names a bean in one of the checkout's bean stores,
# read through schemas/kg/fsh-guts.ts and scripts/unlinked-beans.ts. Runs only in a composed checkout.
# Each Scenario names the test that executes it.
Feature: fsh-guts bean references resolve

  @test:scripts/tests/fsh-guts-bean-refs.test.ts::fsh-guts_bean_references_resolve::the_corpus_is_non-empty,_so_the_assertion_below_is_not_vacuous
  Scenario: The fsh-guts bean-reference corpus is non-empty
    # Skipped: when the fsh-guts trashcan and bean store are not mounted (a layer standing alone)
    Given the bean ids in every declared bean store and the bean: lines of the live fsh-guts records
    Then there is at least one bean id
    And at least one bean reference
    And the fsh-guts directory is not empty

  @test:scripts/tests/fsh-guts-bean-refs.test.ts::fsh-guts_bean_references_resolve::every_`bean:`_names_a_bean_in_the_work_plan
  Scenario: Every fsh-guts bean: names a bean in the work plan
    # Skipped: when the fsh-guts trashcan and bean store are not mounted (a layer standing alone)
    Given the bean ids in every declared bean store and the bean: lines of the live fsh-guts records
    When each reference is looked up among the bean ids
    Then no reference is dangling
