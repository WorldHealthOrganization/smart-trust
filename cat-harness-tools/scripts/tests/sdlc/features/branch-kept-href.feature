# scripts/branch-kept-href.ts links a file to the branch the file is on: a file
# under a branch-kept directory links to that branch, anything else to main.
# Each Scenario names the test that executes it.
Feature: Links to branch-kept files name their branch

  @test:scripts/tests/sdlc/branch-kept-href.test.ts::branchKeptLocation::a_bean_links_to_the_beans_branch,_not_main_—_the_reported_404
  Scenario: A bean links to the beans branch, not main
    Given "beans" is kept on the branch "cat/cat-harness/beans"
    When the link to a bean definition under "beans/defs/" is made
    Then it is the repository's blob URL on "cat/cat-harness/beans" at the bean's path

  @test:scripts/tests/sdlc/branch-kept-href.test.ts::branchKeptLocation::a_todo_links_to_the_todos_branch,_and_edit_uses_the_same_branch
  Scenario: An edit link to a todo uses the todos branch
    Given "todos" is kept on the branch "cat/cat-harness/todos"
    When the edit link to "todos/items/x.md" is made
    Then it is the repository's edit URL on "cat/cat-harness/todos" at "todos/items/x.md"

  @test:scripts/tests/sdlc/branch-kept-href.test.ts::branchKeptLocation::a_file_in_no_branch-kept_directory_stays_on_main
  Scenario: A file in no branch-kept directory stays on main
    Given the declared branch-kept directories
    When the location of "index.config.json" is resolved
    Then it is the same repository, ref "main", path "index.config.json"

  @test:scripts/tests/sdlc/branch-kept-href.test.ts::branchKeptLocation::a_prefix_that_is_not_a_directory_boundary_does_not_match
  Scenario: A prefix that is not a directory boundary does not match
    Given "beans" is a branch-kept directory
    When the location of "beansprout/x.md" is resolved
    Then its ref is "main"

  @test:scripts/tests/sdlc/branch-kept-href.test.ts::branchKeptLocation::the_longest_declared_directory_wins
  Scenario: The longest declared directory wins
    Given "beans" is kept on the beans branch and "beans/workflows" on "cat/cat-harness/state"
    When the location of "beans/workflows/w.json" is resolved
    Then its ref is "cat/cat-harness/state"

  @test:scripts/tests/sdlc/branch-kept-href.test.ts::branchKeptLocation::a_remote_instance's_graph_links_to_its_own_repository_at_its_branch_path
  Scenario: A remote instance's graph links to its own repository at its branch path
    Given "who-iris/health" is kept on "cat/who-iris/health" in the repository "litlfred/who-iris" under the branch path "health"
    When the location of "who-iris/health/a.json" is resolved
    Then it is "https://github.com/litlfred/who-iris", ref "cat/who-iris/health", path "health/a.json"
