# prose-reviewed-since-code-changed (bean cuxx, issue #1042 R1, R2): a code
# change with the prose standing still is a finding; a prose edit never is.
# Each Scenario names the test that executes it.
Feature: Prose reviewed since its code changed

  @test:scripts/tests/prose-code-pairs.test.ts::discoverPairs_—_declared_pairs_only_(R1)::a_workflow_naming_the_diagram_(`#_bpmn:`,_bean_61ca)_and_a_co-located_skill_.md/.ts
  Scenario: A workflow naming a diagram, and a co-located skill .md and .ts, are declared pairs
    Then the diagram pairs with the workflow whose bpmn header names it, not the one mentioning it in prose
    And the skill's .md pairs with the .ts beside it

  @test:scripts/tests/prose-code-pairs.test.ts::discoverPairs_—_declared_pairs_only_(R1)::a_skill_with_no_code_beside_it,_and_a_subject_with_no_path,_declare_nothing
  Scenario: A skill with no code beside it, and a subject with no path, declare nothing
    Then neither has a pair

  @test:scripts/tests/prose-code-pairs.test.ts::evaluatePairs_—_one-sided_change_(R2)::first_sight_records_a_baseline_and_passes
  Scenario: First sight records a baseline and passes
    When the skill's pair is evaluated with no attestations
    Then the result is pass and the attestation is a baseline

  @test:scripts/tests/prose-code-pairs.test.ts::evaluatePairs_—_one-sided_change_(R2)::code_changed,_prose_did_not_→_finding,_and_the_old_attestation_is_kept
  Scenario: Code changed while the prose did not is a finding, and the old attestation is kept
    Given the baseline, then the code changed
    When the pair is evaluated
    Then the result is fail at the code file and the attestations are the baseline's

  @test:scripts/tests/prose-code-pairs.test.ts::evaluatePairs_—_one-sided_change_(R2)::prose_edited_—_alone_or_with_the_code_—_never_raises,_and_the_baseline_moves
  Scenario: A prose edit never raises, and the baseline moves
    Given the baseline, then both the code and the prose changed
    When the pair is evaluated
    Then the result is pass and the attestation records the new code hash

  @test:scripts/tests/prose-code-pairs.test.ts::evaluatePairs_—_one-sided_change_(R2)::a_missing_side_of_a_declared_pair_is_unknown,_never_a_pass
  Scenario: A missing side of a declared pair is unknown
    When a pair whose workflow file does not exist is evaluated
    Then the result is unknown

  @test:scripts/tests/prose-code-pairs.test.ts::evaluatePairs_—_one-sided_change_(R2)::no_declared_pair_is_n/a
  Scenario: No declared pair is n/a
    When no pairs are evaluated
    Then the result is n/a

  @test:scripts/tests/prose-code-pairs.test.ts::attest_—_the_re-review_mark::moves_the_attestation_to_current_hashes_with_who_and_why,_which_clears_the_finding
  Scenario: Attesting moves the attestation to the current hashes with who and why
    Given a stored baseline and a code change that makes the pair fail
    When a human attests with a reason
    Then one attestation is moved, the store reads it back with that person and reason, the pair passes, and the file ends in a newline

  @test:scripts/tests/prose-code-pairs.test.ts::attest_—_the_re-review_mark::refuses_a_store_file_it_cannot_read,_rather_than_overwriting_it
  Scenario: Attesting refuses a store file it cannot read
    Given a store file holding a merge-conflict marker
    Then attesting throws saying it is corrupt and the file is unchanged

  @test:scripts/tests/prose-code-pairs.test.ts::the_prior_read_—_only_a_miss_is_first_sight_(bean_2gst)::(a)_no_store,_the_prior_sidecar_holds_an_attestation:_it_is_the_prior,_unchanged_—_drift_still_found
  Scenario: With no store, a prior sidecar's attestation is the prior, and drift is still found
    Given no store, and a sidecar holding the baseline taken before the code changed
    When the attestations are read, the state is absent with one moved
    And the pair evaluated from them fails, keeping the moved attestation

  @test:scripts/tests/prose-code-pairs.test.ts::the_prior_read_—_only_a_miss_is_first_sight_(bean_2gst)::(a)_no_store_and_no_prior_sidecar:_first_sight,_a_baseline
  Scenario: With no store and no prior sidecar, first sight is a baseline
    When the attestations are read with no store and no sidecar
    Then the state is absent and the evaluation records a baseline

  @test:scripts/tests/prose-code-pairs.test.ts::the_prior_read_—_only_a_miss_is_first_sight_(bean_2gst)::(b)_no_store_entry_and_a_prior_sidecar_that_will_not_parse_is_UNKNOWN:_nothing_is_re-baselined
  Scenario: A prior sidecar that will not parse is unknown, and nothing is re-baselined
    Given no store and a sidecar that is not JSON
    Then the read state is unknown, the evaluation is unknown, and no attestations are returned

  @test:scripts/tests/prose-code-pairs.test.ts::the_prior_read_—_only_a_miss_is_first_sight_(bean_2gst)::(c)_a_store_HIT_is_the_source:_the_prior_sidecar_is_never_read_for_judgements
  Scenario: A store hit is the source, and the prior sidecar is not read
    Given a store holding human attestations and a sidecar that would not parse
    Then the read is a hit returning the store's attestations

  @test:scripts/tests/prose-code-pairs.test.ts::the_prior_read_—_only_a_miss_is_first_sight_(bean_2gst)::a_corrupt_store_file_is_CORRUPT,_never_[]
  Scenario: A corrupt store file is corrupt, never empty
    Given a store file that is not JSON
    Then the read state is corrupt with no attestations, and the evaluation returns none

  @test:scripts/tests/prose-code-pairs.test.ts::the_prior_read_—_only_a_miss_is_first_sight_(bean_2gst)::a_present_store_with_no_file_for_the_subject_is_a_miss,_and_baselines
  Scenario: A store with no file for the subject is a miss and baselines
    Given an empty store directory
    Then the evaluation passes with a baseline attestation

  @test:scripts/tests/prose-code-pairs.test.ts::the_prior_read_—_only_a_miss_is_first_sight_(bean_2gst)::no_declared_pair_is_n/a_whatever_the_store_says
  Scenario: No declared pair is n/a whatever the store says
    Then evaluating no pairs from the store is n/a
