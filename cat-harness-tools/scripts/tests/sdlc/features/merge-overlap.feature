# scripts/merge-overlap.ts measures which open PRs conflict: the T3 test on authored
# paths plus shared declarations, with generated paths counted and regions set apart.
# Each Scenario names the test that executes it.
Feature: Which PRs overlap on authored paths and shared declarations

  @test:scripts/tests/sdlc/merge-overlap.test.ts::classifyMember::generated_paths_are_counted,_not_listed;_shared_declarations_and_harness_flags_are_found
  Scenario: Generated paths are counted, and shared declarations and harness flags are found
    Given a member touching a generated file, two harness scripts, package.json and beans/README.md
    When the member is classified
    Then one generated path is counted
    And the authored paths are cat-harness-tools/x.ts, cat-harness/scripts/a.ts and package.json, sorted
    And the region paths are beans/README.md
    And it touches the shared declaration "package-json" through package.json
    And it touches both cat-harness and cat-harness-tools

  @test:scripts/tests/sdlc/merge-overlap.test.ts::classifyMember::a_README_whose_prose_changed_(or_could_not_be_read)_is_authored
  Scenario: A README whose prose changed or could not be read is authored
    Given a member touching beans/README.md
    When the region check says the prose changed, or cannot say
    Then beans/README.md is an authored path either way

  @test:scripts/tests/sdlc/merge-overlap.test.ts::pairsOf_—_the_T3_rule::two_PRs_sharing_only_generated_files_are_independent_(R7)
  Scenario: Two PRs sharing only generated files are independent
    Given two members sharing a generated file and each with its own authored file
    When their pairs are taken
    Then the pair is independent

  @test:scripts/tests/sdlc/merge-overlap.test.ts::pairsOf_—_the_T3_rule::an_authored_overlap_is_not_independent,_and_is_listed
  Scenario: An authored overlap is not independent and is listed
    Given two members that both touch x.ts
    When their pairs are taken
    Then the pair is not independent
    And its authored overlap is x.ts

  @test:scripts/tests/sdlc/merge-overlap.test.ts::pairsOf_—_the_T3_rule::touching_a_shared_declaration_makes_a_pair_dependent_even_with_disjoint_paths
  Scenario: Touching a shared declaration makes a pair dependent with disjoint paths
    Given one member touching a schemas file and another touching only b.ts
    When their pairs are taken
    Then the pair is not independent
    And the shared touchers are "#1"
    And there is no shared overlap

  @test:scripts/tests/sdlc/merge-overlap.test.ts::pairsOf_—_the_T3_rule::a_region-only_overlap_is_reported_but_does_not_by_itself_make_a_pair_dependent
  Scenario: A region-only overlap is reported but leaves the pair independent
    Given two members that both touch beans/README.md and nothing else in common
    When their pairs are taken
    Then the region overlap is beans/README.md
    And the pair is independent

  @test:scripts/tests/sdlc/merge-overlap.test.ts::pairsOf_—_the_T3_rule::an_undetermined_member_makes_no_pair_independent
  Scenario: An undetermined member makes no pair independent
    Given a member that could not be determined because "fetch failed"
    When it is paired with another member
    Then the pair's independence is null

  @test:scripts/tests/sdlc/merge-overlap.test.ts::pairsOf_—_the_T3_rule::the_report_lists_only_the_pairs_that_are_not_independent,_with_counts
  Scenario: The report lists only dependent pairs, with counts
    Given three members where #3 shares a.ts with #1 and touches bun.lock
    When the report is built
    Then its pairs are "#1×#3" and "#2×#3"
    And the summary counts 3 members, 1 touching shared, 2 conflicting pairs and 0 undetermined

  @test:scripts/tests/sdlc/merge-overlap.test.ts::parseGhPrLines::one_object_per_line;_a_bad_line_fails_the_listing_rather_than_dropping_a_PR
  Scenario: PR listings are one object per line and a bad line fails the listing
    Given gh output of two JSON objects separated by a blank line
    When it is parsed
    Then the PRs are numbers 1 and 2
    And output with a line that is not JSON parses to an error string

  @test:scripts/tests/sdlc/merge-overlap.test.ts::measure_on_a_real_history::diffs_against_the_fork_point,_and_reads_READMEs_to_tell_regions_from_prose
  Scenario: Measuring diffs against the fork point and tells regions from prose
    Given a PR branch changing a.ts, a generated file, one README's region and another README's prose
    And main moving on with an unrelated file after the fork
    When the PR is measured against moved main
    Then the authored paths are a.ts and notes/README.md
    And the region paths are docs/README.md
    And one generated path is counted
    And main's own new file is not counted

  @test:scripts/tests/sdlc/merge-overlap.test.ts::measure_on_a_real_history::an_unknown_head_is_undetermined,_not_empty
  Scenario: An unknown head is undetermined, not empty
    Given a repository and a head sha that does not exist in it
    When the head is measured
    Then the member records that it could not be determined
