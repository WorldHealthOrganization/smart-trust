# gitScan in schemas/sdlc/git-corpus.ts: the repository corpus is what git does not
# ignore, matched with Bun Glob semantics, with a reported fallback outside a work tree.
# Each Scenario names the test that executes it.
Feature: gitScan reads the corpus git does not ignore

  @test:schemas/git-scan.test.ts::gitScan::an_IGNORED_file_matching_the_pattern_is_not_in_the_corpus
  Scenario: An ignored file matching the pattern is left out of the corpus
    Given a git repository with a/library/x/manifest.jsonld and build/library/y/manifest.jsonld, and "build/" ignored
    When it is scanned for "**/library/*/manifest.jsonld"
    Then the source is "git"
    And the files are exactly "a/library/x/manifest.jsonld"

  @test:schemas/git-scan.test.ts::gitScan::an_UNTRACKED_but_not_ignored_file_IS_in_the_corpus
  Scenario: An untracked, unignored file is in the corpus
    Given a git repository with an unstaged a/library/x/manifest.jsonld
    When it is scanned for "**/library/*/manifest.jsonld"
    Then the files are exactly "a/library/x/manifest.jsonld"

  @test:schemas/git-scan.test.ts::gitScan::the_pattern_keeps_Bun_`Glob`_semantics,_not_git_pathspec_semantics
  Scenario: A single star in the pattern does not cross a path separator
    Given a git repository with one/x.md, one/two/x.md and one/two/three/x.md
    When it is scanned for "one/*/x.md"
    Then the files are exactly "one/two/x.md"

  @test:schemas/git-scan.test.ts::gitScan::outside_a_work_tree_it_falls_back_to_the_bare_scan_and_SAYS_SO
  Scenario: Outside a work tree the scan falls back to a walk and says so
    Given a plain directory, not a git repository, holding a/library/x/manifest.jsonld
    When it is scanned for "**/library/*/manifest.jsonld"
    Then the source is "walk"
    And the files are exactly "a/library/x/manifest.jsonld"
