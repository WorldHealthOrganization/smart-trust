# Specifies gitCorpus (schemas/sdlc/git-corpus.ts) in scratch repositories
# carrying the checkout's own node_modules ignore rule, with node_modules as a
# symlink and as a real directory.
Feature: Neither a symlinked nor a real node_modules enters the git corpus

  @test:test/coordinator/git-corpus-symlinked-deps.test.ts::this_repository_still_has_a_dependency_ignore_rule_at_all
  Scenario: The checkout's .gitignore has a node_modules rule
    Given the checkout's .gitignore
    When the lines that are "node_modules" with or without a trailing slash are collected
    Then there is at least one

  @test:test/coordinator/git-corpus-symlinked-deps.test.ts::a_symlinked_node_modules_is_NOT_in_the_corpus
  Scenario: A symlinked node_modules is not in the corpus
    Given a scratch repository with the checkout's node_modules rule and node_modules as a symlink to a directory
    When its git corpus is read
    Then git answers
    And no entry ends with "/node_modules"

  @test:test/coordinator/git-corpus-symlinked-deps.test.ts::...and_neither_is_a_real_node_modules_directory_—_the_control
  Scenario: A real node_modules directory is not in the corpus, and the tracked file is
    Given a scratch repository with the checkout's node_modules rule and node_modules as a real directory
    When its git corpus is read
    Then git answers
    And no entry ends with "/node_modules"
    And an entry ends with "/tracked.md"
