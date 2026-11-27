# Specifies outermostDirs (scripts/known-skills.ts): nested and duplicate workflow directories are dropped so recursive callers do not walk the same diagrams twice.

Feature: Nested and duplicate workflow directories are dropped by outermostDirs

  @test:scripts/tests/workflow-dirs-nested.test.ts::outermostDirs::drops_a_directory_nested_inside_another_in_the_list
  Scenario: A directory nested inside another directory in the list is dropped
    Given a directory list containing "/r/smart-base/L2" and "/r/smart-base/L2/collab/processes" in either order
    When outermostDirs filters the list
    Then only "/r/smart-base/L2" is kept

  @test:scripts/tests/workflow-dirs-nested.test.ts::outermostDirs::drops_identical_directories,_as_before
  Scenario: Identical directories and trailing-slash duplicates are collapsed to one
    Given a directory list containing "/r/a/processes" twice and "/r/a/processes/"
    When outermostDirs filters the list
    Then only "/r/a/processes" is kept

  @test:scripts/tests/workflow-dirs-nested.test.ts::outermostDirs::keeps_siblings_and_directories_that_only_share_a_name_prefix
  Scenario: Sibling directories and directories sharing only a name prefix are kept
    Given a directory list containing "/r/smart-base/L2", "/r/smart-base/L2-bpmn" and "/r/smart-base/L3/collab/processes"
    When outermostDirs filters the list
    Then all three directories are kept in order
