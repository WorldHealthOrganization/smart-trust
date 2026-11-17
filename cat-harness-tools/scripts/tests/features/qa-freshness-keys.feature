# A QA verdict's freshness keys: depends_on (applicability) unioned with
# also_invalidated_by (freshness only), and the criterion definition's own
# hash, def_hash (bean cv10). Each Scenario names the test that executes it.
Feature: A cached QA verdict goes stale when what it read or its criterion changes

  @test:scripts/tests/qa-freshness-keys.test.ts::freshnessKeys::is_depends_on_when_nothing_extra_is_declared
  Scenario: Freshness keys are depends_on when nothing extra is declared
    Then the freshness keys of depends_on ["md", "ts"] are "md" and "ts"

  @test:scripts/tests/qa-freshness-keys.test.ts::freshnessKeys::unions_in_also_invalidated_by
  Scenario: Freshness keys union in also_invalidated_by
    Then the freshness keys of depends_on ["md"] and also_invalidated_by ["lean"] are "lean" and "md"

  @test:scripts/tests/qa-freshness-keys.test.ts::freshnessKeys::de-duplicates_an_overlapping_declaration
  Scenario: Freshness keys are de-duplicated
    Then the freshness keys of depends_on ["md", "lean"] and also_invalidated_by ["lean"] are "lean" and "md"

  @test:scripts/tests/qa-freshness-keys.test.ts::entryIsFresh_honours_also_invalidated_by::a_Lean-only_edit_makes_the_entry_STALE_(the_bug)
  Scenario: A Lean-only edit makes the entry stale
    Given a script entry recorded with md "aaa" and lean "old", and current md "aaa" and lean "new"
    Then the entry is fresh by md alone
    And it is stale by the freshness keys of a criterion invalidated by lean

  @test:scripts/tests/qa-freshness-keys.test.ts::entryIsFresh_honours_also_invalidated_by::an_untouched_Lean_file_leaves_the_entry_fresh
  Scenario: An untouched Lean file leaves the entry fresh
    Given an entry recorded with md and lean unchanged since
    Then it is fresh by the freshness keys of a criterion invalidated by lean

  @test:scripts/tests/qa-freshness-keys.test.ts::entryIsFresh_honours_also_invalidated_by::a_prose-only_block_stays_fresh_—_no_.lean_on_either_side
  Scenario: A prose-only block stays fresh
    Given an entry recorded with md only, and a block that still has no lean file
    Then it is fresh by the freshness keys of a criterion invalidated by lean

  @test:scripts/tests/qa-freshness-keys.test.ts::entryIsFresh_honours_also_invalidated_by::gaining_a_.lean_sibling_invalidates
  Scenario: Gaining a Lean sibling invalidates
    Given an entry recorded with md only, and a block that now has a lean file
    Then it is stale by the freshness keys of a criterion invalidated by lean

  @test:scripts/tests/qa-freshness-keys.test.ts::voice-scholarly-default_registry_wiring::is_registered
  Scenario: voice-scholarly-default is registered
    Then the registry holds "voice-scholarly-default"

  @test:scripts/tests/qa-freshness-keys.test.ts::voice-scholarly-default_registry_wiring::does_NOT_gate_applicability_on_.lean_—_prose-only_blocks_must_still_run
  Scenario: voice-scholarly-default does not gate applicability on Lean
    Then its depends_on contains "md" and not "lean"

  @test:scripts/tests/qa-freshness-keys.test.ts::voice-scholarly-default_registry_wiring::but_DOES_invalidate_on_.lean,_because_the_checker_reads_docstrings
  Scenario: voice-scholarly-default is invalidated by Lean
    Then its also_invalidated_by contains "lean"

  @test:scripts/tests/qa-freshness-keys.test.ts::voice-scholarly-default_registry_wiring::so_its_freshness_key_set_covers_both_files
  Scenario: voice-scholarly-default's freshness keys cover both files
    Then its freshness keys are "lean" and "md"

  @test:scripts/tests/qa-freshness-keys.test.ts::registry_invariant::no_criterion_lists_a_file_in_both_depends_on_and_also_invalidated_by
  Scenario: No criterion lists a file in both depends_on and also_invalidated_by
    Then no registry criterion lists a non-graph key in both

  @test:scripts/tests/qa-freshness-keys.test.ts::criterionDefHash::re-scoping_a_criterion_makes_a_cached_verdict_stale
  Scenario: Re-scoping a criterion makes a cached verdict stale
    Given a criterion definition hash before and after adding profiles ["paper"]
    Then the hashes differ
    And an entry stamped with the old def_hash is stale against the new one, all else unchanged

  @test:scripts/tests/qa-freshness-keys.test.ts::criterionDefHash::an_unchanged_definition_stays_fresh
  Scenario: An unchanged definition stays fresh
    Given an entry stamped with the definition's def_hash and script hash
    Then it is fresh against the same hashes

  @test:scripts/tests/qa-freshness-keys.test.ts::criterionDefHash::re-grading_severity_invalidates_—_the_entry_records_it
  Scenario: Re-grading severity changes the definition hash
    # Gap: the title says the entry records it; the body checks only that "minor" and "major" give different hashes, not any entry.
    Then the definition hashes with default_severity "minor" and "major" differ

  @test:scripts/tests/qa-freshness-keys.test.ts::criterionDefHash::description_is_NOT_in_the_key_—_a_typo_fix_must_not_re-sweep_a_corpus
  Scenario: The description is not in the definition hash
    Then two definitions differing only in description hash the same

  @test:scripts/tests/qa-freshness-keys.test.ts::criterionDefHash::field_ORDER_does_not_change_the_hash_—_all_six_are_sets
  Scenario: Field order does not change the definition hash
    Then profiles ["paper", "document"] and ["document", "paper"] hash the same

  @test:scripts/tests/qa-freshness-keys.test.ts::criterionDefHash::an_entry_with_no_def_hash_is_STALE_once_the_criterion_has_one
  Scenario: An entry with no def_hash is stale once the criterion has one
    Given an entry with a script hash and no def_hash
    Then it is stale against a def_hash "deadbeef1234"

  @test:scripts/tests/qa-freshness-keys.test.ts::criterionDefHash::a_live_registry_criterion_produces_a_stable_hash
  Scenario: A live registry criterion produces a stable hash
    Then hashing voice-scholarly-default's definition twice gives the same 12-hex-digit hash
