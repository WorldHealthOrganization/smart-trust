# scripts/lib/default-scope-globs.ts expands the glob front-matter scopes in a Jekyll _config.yml
# into the exact paths each glob matches, rewriting only the defaults block.
# Each Scenario names the test that executes it.
Feature: Glob front-matter scopes are expanded to exact paths

  @test:scripts/tests/default-scope-globs.test.ts::a_glob_scope's_exact_paths_are_the_glob's_own_matches::`process/*`_matches_its_own_entries,_never_`processes/`,_and_no_dotfile
  Scenario: "process/*" matches only its own entries
    Given a fixture tree with "process/", "processes/", "start/" and a dotfile "process/.hidden.md"
    When the matches of "process/*" are listed
    Then they are exactly "process/fr" and "process/index.md"

  @test:scripts/tests/default-scope-globs.test.ts::a_glob_scope's_exact_paths_are_the_glob's_own_matches::equal_to_Bun's_glob_and_to_Ruby's_Dir.glob_on_the_fixture
  Scenario: The glob matches agree with Bun's glob and with Ruby's Dir.glob
    # Skipped: the Ruby comparison runs only when a ruby is on the PATH
    Given the fixture tree
    When the matches of "process/*", "start/*", "processes/*", "*.md", "start/?.md" and "*/fr" are listed
    Then each list equals Bun's glob over the same tree, without dotfiles
    And each list equals Ruby's Dir.glob when Ruby is available

  @test:scripts/tests/default-scope-globs.test.ts::a_glob_scope's_exact_paths_are_the_glob's_own_matches::the_expanded_scopes_cover_exactly_the_glob's_pages,_under_Jekyll_3.10_AND_Jekyll_4
  Scenario: The exact paths cover the same pages as the glob under both Jekyll subpath tests
    Given the fixture tree and the globs "process/*", "start/*" and "processes/*"
    When the pages covered by the exact paths and by the glob's matches are compared
    Then they are the same under Jekyll 3.10's ascendant-equals test
    And they are the same under Jekyll 4's prefix test
    And the paths from "process/*" cover nothing under "processes/" even with the prefix test

  @test:scripts/tests/default-scope-globs.test.ts::a_glob_scope's_exact_paths_are_the_glob's_own_matches::a_glob_feature_it_does_not_implement_is_refused,_not_approximated
  Scenario: An unsupported glob feature is refused
    Given the fixture tree
    When the matches of "**/*.md", "start/[a-z]*", "{start,process}/*", "/start/*", "../x/*" or "start/*/" are requested
    Then each request throws

  @test:scripts/tests/default-scope-globs.test.ts::expandGlobScopes::replaces_each_glob_entry_in_place,_values_copied,_other_entries_untouched
  Scenario: Each glob entry is replaced in place by one entry per match
    Given a config whose defaults are "start", "process/*" and "index.md"
    When its glob scopes are expanded over the fixture tree
    Then the defaults become "start", "process/fr", "process/index.md" and "index.md", in that order
    And the two new entries carry the glob entry's values
    And the expansion reports "process/*" as expanded to those two paths
    And the two values objects are distinct copies
    And the input config still holds "process/*"

  @test:scripts/tests/default-scope-globs.test.ts::expandGlobScopes::a_config_with_no_glob_scope_is_returned_as_given
  Scenario: A config with no glob scope is returned unchanged
    Given a config whose only default has the scope "start"
    When its glob scopes are expanded
    Then the very same config object is returned
    And nothing is reported as expanded

  @test:scripts/tests/default-scope-globs.test.ts::expandGlobScopes::refuses_when_a_longer_overlapping_scope_sets_the_same_key_—_precedence_could_flip
  Scenario: A longer overlapping scope setting the same key is refused
    Given defaults "process/*" and "process/fr" both setting permalink
    When the glob scopes are expanded
    Then it throws an error naming precedence
    And a shorter scope "" setting the same key alongside "process/*" does not throw

  @test:scripts/tests/default-scope-globs.test.ts::spliceDefaults_rewrites_the_defaults_block_and_no_other_byte::everything_outside_the_block_is_byte-identical
  Scenario: Splicing the defaults leaves everything outside the block byte-identical
    Given a _config.yml with a comment, a quoted title, a folded scalar, a defaults block and an exclude list
    When its defaults are spliced with one "start/a.md" entry
    Then the first five lines are unchanged
    And the text after the block, from the trailing comment to the exclude list, is unchanged
    And the parsed defaults equal the new entry

  @test:scripts/tests/default-scope-globs.test.ts::spliceDefaults_rewrites_the_defaults_block_and_no_other_byte::a_config_with_no_block_`defaults:`_is_refused,_not_re-serialised
  Scenario: A config without a block-style defaults key is refused
    Given a config with no defaults, and one with an inline flow-style defaults
    When defaults are spliced into each
    Then each splice throws

  @test:scripts/tests/default-scope-globs.test.ts::on_the_REAL_composed_tree::no_glob_scope_is_left,_and_each_one_became_exactly_its_glob's_matches
  Scenario: The real composed docs tree has no glob scope left
    Given the glob scopes authored in the docs layers' _config.yml files, of which there is at least one
    When the docs tree is composed and its scopes are expanded
    Then the composed defaults hold no glob scope
    And every key other than defaults keeps its value
    And the expanded globs are exactly the authored ones
    And each glob's paths equal Bun's glob, and Ruby's when available, over the composed tree
    And each path is the scope of some composed default
    And the paths of "process/*", if present, all start with "process/"
