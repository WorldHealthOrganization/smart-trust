# schemas/sdlc/git-corpus.ts (gitCorpus) over a directory git ignores as a whole reads its files from the
# disk rather than reporting none, while a directory git does not ignore is still asked of git.
# Each Scenario names the test that executes it.
Feature: gitCorpus over a wholly ignored directory

  @test:scripts/tests/git-corpus-ignored-dir.test.ts::gitCorpus_over_a_directory_git_ignores_wholesale_(bean_72a8)::its_files_are_read_from_the_disk,_not_reported_as_none
  Scenario: Files in an ignored directory are read from the disk
    Given a repository whose ".gitignore" ignores "results/", holding JSON files at several depths, a node_modules tree and a dot-directory
    When gitCorpus lists "results" with the pathspec "*.json"
    Then it returns exactly "results/a.qa.json" and "results/kg-qa/b.kg-qa.json"

  @test:scripts/tests/git-corpus-ignored-dir.test.ts::gitCorpus_over_a_directory_git_ignores_wholesale_(bean_72a8)::with_no_pathspec_every_file_is_listed_—_still_never_a_dependency_tree_or_a_dot-directory
  Scenario: With no pathspec every file is listed except dependency trees and dot-directories
    Given the same repository with an ignored "results/" directory
    When gitCorpus lists "results" with no pathspec
    Then it returns exactly "results/a.qa.json", "results/kg-qa/b.kg-qa.json" and "results/kg-qa/notes.md"
    And nothing under node_modules or ".hidden" is listed

  @test:scripts/tests/git-corpus-ignored-dir.test.ts::gitCorpus_over_a_directory_git_ignores_wholesale_(bean_72a8)::a_directory_that_is_NOT_ignored_is_still_asked_of_git,_untracked-not-ignored_included
  Scenario: A directory that is not ignored lists its untracked, unignored files
    Given the same repository with an unignored "src" directory holding two untracked files
    When gitCorpus lists "src"
    Then it returns exactly "src/ignored.log" and "src/kept.json"
