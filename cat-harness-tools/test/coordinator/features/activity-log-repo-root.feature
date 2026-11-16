# Specifies, against the checkout's own root, that activity logs (LOG_DIR) are
# git-ignored while the rest of the fsh-guts trashcan stays committed, and that
# LOG_DIR lies inside the declared trashcan.
Feature: Activity logs are ignored and kept inside the trashcan; the trashcan itself is committed

  @test:test/coordinator/activity-log-repo-root.test.ts::persistence_is_off_by_default_in_the_repository_too::fsh-guts/logs/_is_git-ignored
  Scenario: The log directory is git-ignored
    Given the checkout root's .gitignore
    When it is read
    Then it contains LOG_DIR followed by "/"

  @test:test/coordinator/activity-log-repo-root.test.ts::persistence_is_off_by_default_in_the_repository_too::the_REST_of_the_trashcan_is_still_committed
  Scenario: The trashcan is not ignored wholesale
    Given the checkout root's .gitignore
    When it is read
    Then no line ignores "fsh-guts/" on its own
    And the declared trashcan's "retired" directory exists

  @test:test/coordinator/activity-log-repo-root.test.ts::logs_never_reach_a_published_graph::LOG_DIR_really_is_inside_the_stripped_tree,_so_the_guarantee_is_structural
  Scenario: The log directory lies inside the declared trashcan
    Given the checkout root
    When LOG_DIR is resolved against it
    Then the resolved path starts with the declared fsh-guts directory followed by a path separator
