# What scripts/tests/kg/kg-audit-corpus.test.ts covers: corpusPredicate in schemas/sdlc/git-corpus.ts decides
# which page paths the audit reads by asking git, not the disk. Each Scenario names the test that executes it.
Feature: The audit's page corpus is asked of git

  @test:scripts/tests/kg/kg-audit-corpus.test.ts::corpusPredicate::a_git-listed_page_is_IN
  Scenario: A git-listed page is in the corpus
    Given a git work tree with a tracked pages/tracked.md and a gitignored _kg/generated.html
    When the corpus predicate is asked about pages/tracked.md
    Then it is in

  @test:scripts/tests/kg/kg-audit-corpus.test.ts::corpusPredicate::a_GITIGNORED_page_under_the_repository_is_OUT_—_the_defect
  Scenario: A gitignored page under the repository is out of the corpus
    Given a git work tree with a tracked pages/tracked.md and a gitignored _kg/generated.html
    When the corpus predicate is asked about _kg/generated.html
    Then it is out

  @test:scripts/tests/kg/kg-audit-corpus.test.ts::corpusPredicate::a_path_OUTSIDE_the_repository_is_IN,_not_silently_dropped
  Scenario: A path outside the repository is kept
    Given a git work tree with a tracked pages/tracked.md and a gitignored _kg/generated.html
    When the corpus predicate is asked about "/some/other/checkout/pages/page.md"
    Then it is in

  @test:scripts/tests/kg/kg-audit-corpus.test.ts::corpusPredicate::git_unable_to_answer_keeps_EVERYTHING_—_an_unanswerable_question_is_not_an_empty_answer
  Scenario: When git cannot answer, every path is kept
    Given a temporary directory that is not a git work tree
    When the corpus predicate is asked about a page inside it and about "/elsewhere/x.html"
    Then both are in

  @test:scripts/tests/kg/kg-audit-corpus.test.ts::corpusPredicate::a_prefix_that_merely_SHARES_a_name_is_not_inside_the_repository
  Scenario: A sibling path that merely shares the repository's name prefix is not inside it
    Given a git work tree with a tracked pages/tracked.md and a gitignored _kg/generated.html
    When the corpus predicate is asked about "<root>-other/pages/p.md"
    Then it is in, being outside the repository
