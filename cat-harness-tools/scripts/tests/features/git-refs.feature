# src/core/git-refs.ts reads the publish targets and git facts (owner/repo, published paths, the remote URL);
# pipeline/readme-toc.ts builds the README config on the same reader. Each Scenario names the test that executes it.
Feature: Publish targets and git facts from one reader

  @test:scripts/tests/git-refs.test.ts::one_reader,_so_the_two_cannot_drift::the_three_publish_targets_agree_between_the_two_entry_points
  Scenario: publishTargets and the README config agree on the three publish targets
    Given an instance config whose readme block sets publishRef "site" and pagesBaseUrl "https://x.example/y"
    When publishTargets and loadReadmeConfig both read it
    Then they give the same publishRef, pagesBaseUrl and repoUrl

  @test:scripts/tests/git-refs.test.ts::one_reader,_so_the_two_cannot_drift::...and_on_THIS_repository,_where_the_config_is_real
  Scenario: The two readers agree on this repository's real config
    Given this repository's root
    When publishTargets and loadReadmeConfig both read it
    Then they give the same publishRef and pagesBaseUrl

  @test:scripts/tests/git-refs.test.ts::one_reader,_so_the_two_cannot_drift::the_README-shaped_fields_are_still_the_README's_own
  Scenario: The README config keeps its own README-only fields
    Given an instance config whose readme block sets linkStyle "pages" and marker "custom"
    When loadReadmeConfig reads it
    Then linkStyle is "pages" and marker is "custom"
    And it has at least one PDF path pattern

  @test:scripts/tests/git-refs.test.ts::one_reader,_so_the_two_cannot_drift::an_absent_config_still_yields_a_usable_publish_ref
  Scenario: An absent config yields the default publish ref
    Given an empty directory with no instance config
    When publishTargets reads it
    Then the publishRef is the default publish ref

  @test:scripts/tests/git-refs.test.ts::one_reader,_so_the_two_cannot_drift::a_config_that_will_not_parse_falls_back_rather_than_throwing
  Scenario: An unparseable config falls back to the default publish ref
    Given an instance config holding "{ not json"
    When publishTargets reads it
    Then it does not throw and the publishRef is the default publish ref

  @test:scripts/tests/git-refs.test.ts::the_git_facts::`ownerRepo`_takes_the_last_two_segments,_trailing_slash_or_not
  Scenario: ownerRepo takes the last two URL segments with or without a trailing slash
    Given the URL "https://github.com/litlfred/folio-assistant" with and without a trailing slash
    When ownerRepo reads each
    Then both give "litlfred/folio-assistant"

  @test:scripts/tests/git-refs.test.ts::the_git_facts::an_UNREADABLE_ref_is_`undefined`,_not_an_empty_set
  Scenario: An unreadable ref gives undefined rather than an empty set
    Given a scratch directory that is not a git repository
    When publishedPaths reads the ref "definitely-not-a-ref"
    Then it returns undefined

  @test:scripts/tests/git-refs.test.ts::the_git_facts::a_ref_the_repository_CAN_read_comes_back_as_a_set_of_paths
  Scenario: A readable ref comes back as a set of paths
    Given a throwaway repository whose one commit holds "AGENTS.md"
    When publishedPaths reads "HEAD"
    Then it returns a set that contains "AGENTS.md"

  @test:scripts/tests/git-refs.test.ts::withoutCredentials_—_no_token_reaches_a_page_(smart-ra,_2026-10-14)::strips_an_insteadOf_token,_and_leaves_clean_URLs_byte-identical
  Scenario: withoutCredentials strips userinfo and leaves clean URLs unchanged
    Given URLs carrying "x-access-token:ghs_abc@" and "user@" userinfo
    When withoutCredentials reads them
    Then the userinfo is removed, giving "https://github.com/litlfred/smart-ra" and "https://github.com/o/r.git"
    And "https://github.com/o/r" and "git@github.com:o/r.git" come back unchanged

  @test:scripts/tests/git-refs.test.ts::withoutCredentials_—_no_token_reaches_a_page_(smart-ra,_2026-10-14)::detectRepoUrl_never_returns_the_token_git's_insteadOf_puts_in_the_remote
  Scenario: detectRepoUrl drops the token an insteadOf rule adds to the remote
    Given a repository with origin "https://github.com/o/r.git"
    And a git insteadOf rule rewriting "https://github.com/" to a URL carrying a "SECRET" token
    When detectRepoUrl reads the repository
    Then it returns "https://github.com/o/r"

  @test:scripts/tests/git-refs.test.ts::withoutCredentials_—_no_token_reaches_a_page_(smart-ra,_2026-10-14)::detectRepoUrl_is_a_replayable_tree_read,_not_a_traced_input_site
  Scenario: detectRepoUrl is not recorded as an input site, while publishedPaths is
    Given a fixture repository holding "AGENTS.md" and an open input trace
    When detectRepoUrl reads it
    Then it returns a URL and the trace records no input site
    And when publishedPaths reads "HEAD" under a fresh trace it finds "AGENTS.md"
    And that trace records the input site "git-refs: git"
