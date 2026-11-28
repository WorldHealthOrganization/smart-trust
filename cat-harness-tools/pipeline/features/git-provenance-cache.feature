# gitFileCommitSha in pipeline/qa-utils.ts is memoised per repository and path, and the
# memo is keyed on HEAD so a new commit touching the path expires it.
# Each Scenario names the test that executes it.
Feature: Memoised file commit lookup keyed on HEAD

  @test:pipeline/git-provenance-cache.test.ts::gitFileCommitSha_—_memoised,_keyed_on_HEAD::returns_the_commit_that_last_touched_the_path
  Scenario: The lookup returns the commit that last touched the path
    Given a throwaway git repository with one commit adding "a.txt"
    When the commit of "a.txt" is looked up
    Then it is the repository's HEAD

  @test:pipeline/git-provenance-cache.test.ts::gitFileCommitSha_—_memoised,_keyed_on_HEAD::a_repeated_call_agrees_with_itself_—_the_memo_does_not_change_the_answer
  Scenario: A repeated lookup agrees with itself
    Given a throwaway git repository with one commit adding "a.txt"
    When the commit of "a.txt" is looked up three times
    Then every answer is the same

  @test:pipeline/git-provenance-cache.test.ts::gitFileCommitSha_—_memoised,_keyed_on_HEAD::a_NEW_COMMIT_touching_the_path_changes_the_answer_—_the_memo_expires_on_HEAD
  Scenario: A new commit touching the path changes the answer
    Given a throwaway git repository with one commit adding "a.txt"
    And the commit of "a.txt" has been looked up
    When a second commit changes "a.txt"
    Then the lookup no longer gives the earlier answer
    And it gives the new commit

  @test:pipeline/git-provenance-cache.test.ts::gitFileCommitSha_—_memoised,_keyed_on_HEAD::a_commit_touching_ANOTHER_path_leaves_this_path's_answer_alone
  Scenario: A commit touching another path leaves this path's answer alone
    Given a throwaway git repository with one commit adding "a.txt"
    And the commit of "a.txt" has been looked up
    When a commit adds "b.txt"
    Then the commit of "a.txt" is unchanged

  @test:pipeline/git-provenance-cache.test.ts::gitFileCommitSha_—_memoised,_keyed_on_HEAD::two_paths_in_one_repo_do_not_share_an_entry
  Scenario: Two paths in one repository do not share an entry
    Given a throwaway git repository with one commit adding "a.txt"
    When a commit adds "b.txt"
    Then the commit of "b.txt" is that new commit
    And the commit of "a.txt" is not

  @test:pipeline/git-provenance-cache.test.ts::gitFileCommitSha_—_memoised,_keyed_on_HEAD::a_path_git_knows_nothing_about_is_unknown,_and_stays_unknown
  Scenario: A path git knows nothing about is unknown, and stays unknown
    Given a throwaway git repository with one commit adding "a.txt"
    When the commit of "absent.txt" is looked up twice
    Then both answers are the unknown sha

  @test:pipeline/git-provenance-cache.test.ts::gitFileCommitSha_—_memoised,_keyed_on_HEAD::a_directory_that_is_not_a_repo_at_all_is_unknown,_not_a_throw
  Scenario: A directory that is not a repository gives unknown rather than throwing
    Given a plain directory holding "a.txt" that is not a git repository
    When the commit of "a.txt" is looked up
    Then the answer is the unknown sha

  @test:pipeline/git-provenance-cache.test.ts::gitFileCommitSha_—_memoised,_keyed_on_HEAD::two_repos_do_not_share_an_entry_for_the_same_relative_path
  Scenario: Two repositories do not share an entry for the same relative path
    Given two throwaway repositories each with "a.txt"
    And the second has a further commit giving "a.txt" different content
    When the commit of "a.txt" is looked up in each
    Then the second repository's answer is its new commit
    And the two answers differ
    And looking up the first repository again still gives its own answer
