# pipeline/qa-witness.ts projects QA sidecars (block, kg, script, translation) into witness documents
# that say whether each verdict still holds against the tree, and never report `unknown` as `fresh`.
# Each Scenario names the test that executes it.
Feature: QA witness projection and freshness

  @test:pipeline/qa-witness.test.ts::digestsAgree_—_a_prefix_and_a_full_digest_of_the_same_bytes_are_not_a_change::block-qa's_12-char_prefix_agrees_with_kg-qa's_sha256:<64>
  Scenario: A 12-char digest prefix agrees with the full sha256 of the same bytes
    Given a 64-hex sha256 digest
    When its first 12 characters are compared with "sha256:" plus the full digest
    Then the digests agree

  @test:pipeline/qa-witness.test.ts::digestsAgree_—_a_prefix_and_a_full_digest_of_the_same_bytes_are_not_a_change::a_real_difference_is_still_a_difference
  Scenario: A different digest still disagrees
    When "aaaaaaaaaaaa" is compared with "sha256:" plus a different full digest
    Then the digests do not agree

  @test:pipeline/qa-witness.test.ts::digestsAgree_—_a_prefix_and_a_full_digest_of_the_same_bytes_are_not_a_change::a_missing_side_is_undefined,_never_agreement
  Scenario: A missing digest is undefined, never agreement
    When either side of the comparison is undefined or empty
    Then the result is undefined

  @test:pipeline/qa-witness.test.ts::freshnessOf_—_three_states,_and_`unknown`_is_never_`fresh`::every_recorded_input_matches_the_tree:_fresh
  Scenario: Every recorded input matching the tree is fresh
    Given recorded hashes md "aaa" and ts "bbb"
    When freshness is measured against a tree with the same hashes
    Then the freshness is "fresh" with nothing else reported

  @test:pipeline/qa-witness.test.ts::freshnessOf_—_three_states,_and_`unknown`_is_never_`fresh`::one_input_moved:_stale,_and_it_NAMES_the_input
  Scenario: One moved input is stale and is named
    Given recorded hashes md "aaa" and ts "bbb"
    When freshness is measured against a tree where md is "zzz"
    Then the freshness is "stale"
    And the changed inputs are exactly "md"

  @test:pipeline/qa-witness.test.ts::freshnessOf_—_three_states,_and_`unknown`_is_never_`fresh`::a_file_on_disk_the_entry_never_hashed_is_`unknown`,_not_`fresh`
  Scenario: A file on disk the entry never hashed is unknown
    Given a recorded hash for md only
    When freshness is measured against a tree that also has a lean file
    Then the freshness is "unknown"
    And the first changed note names "lean"

  @test:pipeline/qa-witness.test.ts::freshnessOf_—_three_states,_and_`unknown`_is_never_`fresh`::a_DERIVED_input_the_entry_hashed_is_`partial`,_not_a_missing_file
  Scenario: A hashed derived input is partial, not a missing file
    Given recorded hashes for md and the derived input "graph"
    When freshness is measured against a tree with only a matching md
    Then the freshness is "partial"
    And the first not-compared note names "graph"
    And nothing is reported as changed

  @test:pipeline/qa-witness.test.ts::freshnessOf_—_three_states,_and_`unknown`_is_never_`fresh`::`partial`_is_not_`fresh`:_it_says_how_much_was_established,_not_that_all_was
  Scenario: Partial is not fresh
    Given recorded hashes for md and the derived input "lean_statement"
    When freshness is measured against a tree with only a matching md
    Then the freshness is not "fresh"
    And the freshness is "partial"

  @test:pipeline/qa-witness.test.ts::freshnessOf_—_three_states,_and_`unknown`_is_never_`fresh`::a_changed_FILE_outranks_an_unchecked_derived_input
  Scenario: A changed file outranks an unchecked derived input
    Given recorded hashes for md and the derived input "graph"
    When freshness is measured against a tree where md differs
    Then the freshness is "stale"
    And the changed inputs are exactly "md"

  @test:pipeline/qa-witness.test.ts::freshnessOf_—_three_states,_and_`unknown`_is_never_`fresh`::a_genuinely_missing_FILE_outranks_an_unchecked_derived_input
  Scenario: A missing file outranks an unchecked derived input
    Given recorded hashes for md and the derived input "graph"
    When freshness is measured against an empty tree
    Then the freshness is "unknown"

  @test:pipeline/qa-witness.test.ts::freshnessOf_—_three_states,_and_`unknown`_is_never_`fresh`::a_reviewed_file_that_is_gone_is_`unknown`,_not_`fresh`
  Scenario: A reviewed file that is gone is unknown
    Given a recorded hash for md
    When freshness is measured against an empty tree
    Then the freshness is "unknown"
    And the first changed note says "missing on disk"

  @test:pipeline/qa-witness.test.ts::freshnessOf_—_three_states,_and_`unknown`_is_never_`fresh`::an_unresolved_input_cannot_be_outvoted_by_matching_ones
  Scenario: An unresolved input is not outvoted by matching ones
    Given a recorded hash for md only
    When freshness is measured against a tree with a matching md and an unhashed ts
    Then the freshness is "unknown"

  @test:pipeline/qa-witness.test.ts::freshnessOf_—_three_states,_and_`unknown`_is_never_`fresh`::a_stale_input_outranks_an_unresolved_one
  Scenario: A stale input outranks an unresolved one
    Given a recorded hash for md only
    When freshness is measured against a tree where md differs and ts is unhashed
    Then the freshness is "stale"

  @test:pipeline/qa-witness.test.ts::freshnessOf_—_three_states,_and_`unknown`_is_never_`fresh`::an_entry_with_no_hashes_at_all_is_`unknown`
  Scenario: An entry with no hashes at all is unknown
    When freshness is measured with no recorded hashes against an empty tree
    Then the freshness is "unknown"

  @test:pipeline/qa-witness.test.ts::stateOf_—_a_criterion_with_no_verdict_does_not_make_a_sidecar_clean::only_`unknown`_and_`n/a`_is_`unswept`
  Scenario: Only unknown and n/a criteria make a sidecar unswept
    When the state of counts with 3 "n/a", 2 "unknown" and nothing else is taken
    Then the state is "unswept"

  @test:pipeline/qa-witness.test.ts::stateOf_—_a_criterion_with_no_verdict_does_not_make_a_sidecar_clean::a_pass_alongside_an_unknown_is_still_`pass`
  Scenario: A pass alongside unknowns is still a pass
    When the state of counts with 1 pass and 4 unknown is taken
    Then the state is "pass"

  @test:pipeline/qa-witness.test.ts::stateOf_—_a_criterion_with_no_verdict_does_not_make_a_sidecar_clean::fail_outranks_warn_outranks_pass
  Scenario: Fail outranks warn, and warn outranks pass
    When the state of counts with 1 fail, 9 warn and 9 pass is taken
    Then the state is "fail"
    When the state of counts with 1 warn and 9 pass is taken
    Then the state is "warn"

  @test:pipeline/qa-witness.test.ts::readWitnessDoc_—_block_family::the_FIRST_entry_is_the_verdict;_the_rest_are_still_published_as_history
  Scenario: The first entry is the verdict and the rest stay as history
    Given a block "b.md" with a "b.qa.json" sidecar whose "voice-status-leak" criterion has a critical script "fail" entry, then an older human "pass" entry by "litlfred"
    When the block witness document is read
    Then there is one criterion with result "fail"
    And it lists 2 witnesses, the second being the human "litlfred"

  @test:pipeline/qa-witness.test.ts::readWitnessDoc_—_block_family::freshness_is_measured_against_the_TREE,_not_the_sidecar's_own_header
  Scenario: Freshness is measured against the tree, not the sidecar's header
    Given a block sidecar whose recorded md and ts hashes are not the files' hashes
    When the block witness document is read
    Then the first witness is "stale"
    And its changed inputs are "md" and "ts"

  @test:pipeline/qa-witness.test.ts::readWitnessDoc_—_block_family::a_legacy_entry_keeps_its_commit;_a_current_one_carries_its_tree_(bean_69lr)
  Scenario: A legacy entry keeps its commit and a current one carries its tree
    Given a block "b.md" with a "b.qa.json" sidecar whose "voice-status-leak" criterion has a critical script "fail" entry, then an older human "pass" entry by "litlfred"
    And the script entry records a reviewed commit sha and the human entry a reviewed tree
    When the block witness document is read
    Then the first witness has that sha and no tree
    And the second witness has that tree and no sha

  @test:pipeline/qa-witness.test.ts::readWitnessDoc_—_block_family::evidence_and_severity_reach_the_projection
  Scenario: Evidence and severity reach the projection
    Given a block "b.md" with a "b.qa.json" sidecar whose "voice-status-leak" criterion has a critical script "fail" entry, then an older human "pass" entry by "litlfred"
    When the block witness document is read
    Then the criterion's severity is "critical"
    And its first evidence contains "Not yet implemented"

  @test:pipeline/qa-witness.test.ts::readWitnessDoc_—_block_family::a_sidecar_that_will_not_parse_is_undefined,_not_a_crash
  Scenario: A sidecar that will not parse is undefined, not a crash
    Given a block "b.md" whose "b.qa.json" is not valid JSON
    When the block witness document is read
    Then the result is undefined

  @test:pipeline/qa-witness.test.ts::readWitnessDoc_—_block_family::no_sidecar_is_undefined_—_the_caller_decides_`unswept`_vs_no_icon
  Scenario: No sidecar reads as undefined
    Given a block "b.md" with no sidecar
    When the block witness document is read
    Then the result is undefined

  @test:pipeline/qa-witness.test.ts::readWitnessDoc_—_kg_family_keeps_one_auditor,_and_says_what_it_does_not_know::one_criterion,_one_witness_—_synthesised_from_the_corpus_manifest
  Scenario: A kg criterion has one witness synthesised from the corpus manifest
    Given a BPMN process "Process_X" with a kg-qa sidecar failing "activity-names-skill" at "Task_A" and "n/a" for "decision-ref-resolves"
    And a kg-qa manifest recording the auditor "scripts/kg-audit.ts"
    When the kg witness document is read
    Then the subject is "process Process_X"
    And the first criterion is the failing "activity-names-skill"
    And it has one witness whose id is "scripts/kg-audit.ts"
    And its first evidence names "Task_A"

  @test:pipeline/qa-witness.test.ts::readWitnessDoc_—_kg_family_keeps_one_auditor,_and_says_what_it_does_not_know::no_manifest_says_`unrecorded`_rather_than_inventing_a_hash
  Scenario: Without a manifest the auditor is unrecorded rather than invented
    Given a BPMN process "Process_X" with a kg-qa sidecar failing "activity-names-skill" at "Task_A" and "n/a" for "decision-ref-resolves"
    And no kg-qa manifest
    When the kg witness document is read
    Then the first witness id is "unrecorded"
    And it has no script hash

  @test:pipeline/qa-witness.test.ts::readWitnessDoc_—_kg_family_keeps_one_auditor,_and_says_what_it_does_not_know::kg-audit_records_no_timestamp,_so_the_witness_carries_none_rather_than_one_invented
  Scenario: A kg witness carries no invented timestamp
    Given a BPMN process "Process_X" with a kg-qa sidecar failing "activity-names-skill" at "Task_A" and "n/a" for "decision-ref-resolves"
    And a kg-qa manifest recording the auditor "scripts/kg-audit.ts"
    When the kg witness document is read
    Then the first witness has no timestamp and no sha

  @test:pipeline/qa-witness.test.ts::readWitnessDoc_—_kg_family_keeps_one_auditor,_and_says_what_it_does_not_know::a_wrong_source_hash_is_stale,_not_fresh
  Scenario: A wrong kg source hash is stale
    Given a BPMN process "Process_X" with a kg-qa sidecar failing "activity-names-skill" at "Task_A" and "n/a" for "decision-ref-resolves"
    And a kg-qa manifest recording the auditor "scripts/kg-audit.ts"
    And the sidecar's source hash is all zeros
    When the kg witness document is read
    Then the first witness is "stale"

  @test:pipeline/qa-witness.test.ts::readWitnessDoc_—_script_family::a_script_sidecar_reads,_hashing_the_script_itself
  Scenario: A script sidecar reads, hashing the script itself
    Given a script "s.ts" with a script-qa sidecar whose recorded hash is not the file's and whose one criterion is a "warn"
    When the script witness document is read
    Then the subject is "s.ts"
    And the state is "warn"
    And the first witness is "stale" with changed input "script"

  @test:pipeline/qa-witness.test.ts::sidecarPaths_—_translation_is_per_locale,_collected_per_block::every_locale's_sidecar_is_found,_in_a_stable_order
  Scenario: Every locale's translation sidecar is found in a stable order
    Given a block "b.md" with translation sidecars for "fr", "ar" and "es"
    And a sidecar "other.fr.translation-qa.json" for another block
    When the translation sidecar paths are listed
    Then they are the "ar", "es" and "fr" sidecars of "b", in that order

  @test:pipeline/qa-witness.test.ts::sidecarPaths_—_translation_is_per_locale,_collected_per_block::a_stem_that_is_a_prefix_of_another_does_not_steal_its_sidecars
  Scenario: A stem that is a prefix of another does not take its sidecars
    Given a block "b.md" and a sidecar "b-extra.fr.translation-qa.json"
    When the translation sidecar paths of "b.md" are listed
    Then none are found

  @test:pipeline/qa-witness.test.ts::readWitnessDoc_—_translation_family::locales_are_merged_into_one_view,_each_criterion_tagged_with_its_own
  Scenario: Translation locales merge into one view, each criterion tagged with its locale
    Given a block "b.md" with "fr" and "es" translation sidecars
    And each passes "translation-coverage" and has an empty "translation-semantic-roundtrip"
    When the translation witness document is read
    Then there are 4 criteria
    And 2 count as pass and 2 as unknown
    And the round-trip criteria are tagged "es" and "fr" and have no witnesses
    And the state is "pass"
