# merge-priority.dmn, the table scripts/merge-queue.ts orders the queue by, checked
# against PRIORITY_CLASSES in schemas/sdlc/merge-queue.ts and this repo's DMN evaluator.
# Each Scenario names the test that executes it.
Feature: The merge-priority table agrees with its vocabulary

  @test:scripts/tests/sdlc/merge-priority-table.test.ts::the_merge-priority_table_and_its_vocabulary::every_class_the_table_returns_is_in_PRIORITY_CLASSES
  Scenario: Every class the table returns is in the vocabulary
    Given the class output of every rule, read from merge-priority.dmn
    When each is looked up in PRIORITY_CLASSES
    Then no class is unknown to the vocabulary

  @test:scripts/tests/sdlc/merge-priority-table.test.ts::the_merge-priority_table_and_its_vocabulary::...and_every_class_in_PRIORITY_CLASSES_is_returned_by_some_rule
  Scenario: Every class in the vocabulary is returned by some rule
    Given the class output of every rule, read from merge-priority.dmn
    When each of PRIORITY_CLASSES is looked for among them
    Then no class in the vocabulary is unreturned

  @test:scripts/tests/sdlc/merge-priority-table.test.ts::the_merge-priority_table_and_its_vocabulary::every_unary_test_in_the_table_parses_under_this_repo's_own_evaluator
  Scenario: Every unary test in the table can be read by this repo's evaluator
    Given every non-empty, non-"-" input entry of merge-priority.dmn
    When each is evaluated against 0, "x" and true
    Then there is at least one such entry
    And each either evaluates or fails with a DecisionError about the value, never an unreadable expression

  @test:scripts/tests/sdlc/merge-priority-table.test.ts::the_merge-priority_table_and_its_vocabulary::the_table_loads,_and_its_hit_policy_is_the_one_the_ordering_assumes
  Scenario: The table loads with the FIRST hit policy
    When the priority table is loaded
    Then its hit policy is "FIRST"
