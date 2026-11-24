# scripts/result-store.ts files green gate results content-addressed, many per gate, and
# offers one for reuse only on an exact match. Each Scenario names the test that executes it.
Feature: Content-addressed gate result store

  @test:scripts/tests/sdlc/result-store.test.ts::result-store::the_digest_is_of_gate,_recipe_and_record,_whatever_the_key_order
  Scenario: The digest covers gate, recipe and record, whatever the key order
    Given an entry digest for gate "g", recipe "recipe-1" and a record
    When the same record is digested with its keys in another order
    Then the digest is the same
    And changing the gate to "h" or the recipe to "recipe-2" gives a different digest

  @test:scripts/tests/sdlc/result-store.test.ts::result-store::the_same_inputs_file_once;_different_inputs_file_apart,_newest_first
  Scenario: The same inputs are filed once, different inputs apart, newest first
    Given a temporary store
    When the same entry is put at 01:00 and again at 02:00, and a different entry at 03:00
    Then listing the gate gives two results, the newer different entry first
    And the repeated entry keeps its first recordedAt, 01:00

  @test:scripts/tests/sdlc/result-store.test.ts::result-store::a_gate_keeps_at_most_MAX_PER_GATE_entries,_dropping_the_oldest
  Scenario: A gate keeps at most MAX_PER_GATE entries, dropping the oldest
    Given MAX_PER_GATE plus 3 distinct entries put in time order
    When the gate is listed
    Then it holds exactly MAX_PER_GATE results
    And the oldest kept is the entry numbered 3

  @test:scripts/tests/sdlc/result-store.test.ts::result-store::a_script_name_with_colons_is_a_directory_of_its_own
  Scenario: A gate name with colons gets a directory of its own
    Given an entry put under gate "x:check"
    When the gate directory is resolved
    Then its path contains "x%3Acheck"
    And gate "y:check" lists no results

  @test:scripts/tests/sdlc/result-store.test.ts::result-store::an_edited_or_truncated_entry,_or_another_recipe's,_is_never_offered
  Scenario: An edited or truncated entry, or another recipe's, is never offered
    Given one entry stored under recipe-1 and the same entry under recipe-2
    When the recipe-1 file is rewritten with an edited entry that no longer matches its digest name
    Then listing recipe-1 gives no results
    And after a junk, unparseable "junk.json" is added, recipe-1 still lists none
    And recipe-2 still lists its one result

  @test:scripts/tests/sdlc/result-store.test.ts::result-store::findReusable_takes_the_newest_entry_the_matcher_accepts,_and_names_its_run
  Scenario: findReusable takes the newest entry the matcher accepts and names its run
    Given entries with p "1" at 01:00 and p "2" at 02:00
    When findReusable runs with a matcher that accepts only p "1"
    Then the result is reused
    And its reason is "reused sha-2026-11-05T01:00:00Z: same"

  @test:scripts/tests/sdlc/result-store.test.ts::result-store::nothing_stored,_nothing_matching,_or_a_matcher_that_throws:_the_gate_runs
  Scenario: Nothing stored, nothing matching, or a throwing matcher means the gate runs
    Given an empty store
    When findReusable runs, the answer is no reuse with reason "no stored result"
    And with one stored entry and a rejecting matcher, the reason is "none of 1 stored result(s) matches (newest: p changed)"
    And with a matcher that throws, the answer is no reuse
    And the stored entry is still the only file in the gate directory
