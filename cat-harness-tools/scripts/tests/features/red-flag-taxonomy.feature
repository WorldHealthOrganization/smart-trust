# The RED FLAG taxonomy, the adversarial review sidecar shape, the human
# override path, and gate state derivation (bean folio-assistant-abmq,
# proposal merge-gate-2026-10-02 §6). The sample blocking finding is "rf-1",
# category security, critical, open. Each Scenario names the test that
# executes it.
Feature: RED FLAG findings, their review records and their gate states

  @test:scripts/tests/red-flag-taxonomy.test.ts::RED_FLAG_taxonomy_(closed_enum_and_definitions)::contains_exactly_the_8_specified_categories
  Scenario: The taxonomy has exactly the 8 categories
    Then the categories are security, data-loss, correctness, false-green, provenance, scope-breach, irreversible-action and licence

  @test:scripts/tests/red-flag-taxonomy.test.ts::RED_FLAG_taxonomy_(closed_enum_and_definitions)::validates_members_with_RedFlagCategorySchema_and_rejects_foreign_values
  Scenario: The category schema accepts members and rejects foreign values
    Then every category parses and is recognised
    And "arbitrary-issue", "style" and "" do not parse
    And "other" and null are not categories

  @test:scripts/tests/red-flag-taxonomy.test.ts::RED_FLAG_taxonomy_(closed_enum_and_definitions)::every_category_has_a_definition_and_a_historical_repository_example
  Scenario: Every category has a definition and a historical example
    Then every category has a definition naming it, with definition and example longer than 15 characters, returned by lookup
    And the examples cite lean-bare-import and dh4f, plj1, de9k, beans:claim, w4tq, 7u3g and agent-review.yml

  @test:scripts/tests/red-flag-taxonomy.test.ts::AdversarialFindingSchema_validation::parses_a_valid_blocking_finding_with_category_and_evidence
  Scenario: A valid blocking finding parses
    Then the sample blocking finding parses

  @test:scripts/tests/red-flag-taxonomy.test.ts::AdversarialFindingSchema_validation::rejects_a_blocking_finding_with_no_category
  Scenario: A blocking finding with no category is refused
    Then the sample finding without a category fails, with an issue on "category"

  @test:scripts/tests/red-flag-taxonomy.test.ts::AdversarialFindingSchema_validation::rejects_a_blocking_finding_with_empty_evidence
  Scenario: A blocking finding with blank evidence is refused
    Then the sample finding with evidence "   " fails, with an issue on "evidence"

  @test:scripts/tests/red-flag-taxonomy.test.ts::AdversarialFindingSchema_validation::allows_non-blocking_findings_(suggestion)_without_category_or_evidence
  Scenario: A suggestion needs no category or evidence
    Then a minor suggestion with empty evidence and no category parses

  @test:scripts/tests/red-flag-taxonomy.test.ts::AdversarialFindingSchema_validation::allows_non-blocking_findings_(praise)
  Scenario: Praise needs no category or evidence
    Then a minor praise finding with empty evidence parses

  @test:scripts/tests/red-flag-taxonomy.test.ts::AdversarialReview_and_sidecar_compatibility::parses_an_adversarial_review_record
  Scenario: An adversarial review record parses
    Then a review flagging the sample finding parses

  @test:scripts/tests/red-flag-taxonomy.test.ts::AdversarialReview_and_sidecar_compatibility::parses_a_MergeReview_record_with_bound_commit_SHAs
  Scenario: A merge review bound to commit shas parses
    Then a merge-review/v1 for PR 42 with base and head shas and a flagged review parses

  @test:scripts/tests/red-flag-taxonomy.test.ts::AdversarialReview_and_sidecar_compatibility::KgQaReportSchema_accepts_optional_adversarial_reviews[]_(compatible_with_kg-qa/v1)
  Scenario: A kg-qa/v1 sidecar may carry adversarial reviews
    Then a kg-qa/v1 sidecar with adversarial_reviews parses
    And the same sidecar without them still parses

  @test:scripts/tests/red-flag-taxonomy.test.ts::Human_override_path_(OverrideDecisionSchema_&_applyRedFlagOverride)::valid_human_override_parses_successfully
  Scenario: A valid human override parses
    Then an override of "rf-1" by human "litlfred" with standing, reason, time and commit parses

  @test:scripts/tests/red-flag-taxonomy.test.ts::Human_override_path_(OverrideDecisionSchema_&_applyRedFlagOverride)::accepts_flag_id_as_alternative_to_finding_id
  Scenario: flag_id is accepted in place of finding_id
    Then a human override naming flag_id "rf-1" parses

  @test:scripts/tests/red-flag-taxonomy.test.ts::Human_override_path_(OverrideDecisionSchema_&_applyRedFlagOverride)::refuses_override_from_non-human_reviewer_(agents_cannot_override_red_flags)
  Scenario: An agent cannot override a red flag
    Then the override by agent "claude-code" fails, with an issue mentioning "human"

  @test:scripts/tests/red-flag-taxonomy.test.ts::Human_override_path_(OverrideDecisionSchema_&_applyRedFlagOverride)::refuses_override_missing_finding_id_or_flag_id
  Scenario: An override must name its finding
    Then the override with neither finding_id nor flag_id fails

  @test:scripts/tests/red-flag-taxonomy.test.ts::Human_override_path_(OverrideDecisionSchema_&_applyRedFlagOverride)::applyRedFlagOverride_updates_status_to_overridden_without_deleting_finding
  Scenario: Applying an override marks the finding overridden without deleting it
    When the override is applied to the open finding "rf-1"
    Then its id, category, severity, weight, where and evidence are unchanged
    And its status is "overridden" with a resolution recording who, when, which decision, why and the commit

  @test:scripts/tests/red-flag-taxonomy.test.ts::Human_override_path_(OverrideDecisionSchema_&_applyRedFlagOverride)::applyRedFlagOverride_throws_if_finding_ID_does_not_match_override
  Scenario: Applying an override to another finding throws
    When the override is applied to finding "rf-mismatch"
    Then it throws "Finding IDs must match"

  @test:scripts/tests/red-flag-taxonomy.test.ts::Gate_behaviour_and_state_derivation_across_all_6_states::all_6_expected_gate_states_are_defined_in_RED_FLAG_GATE_STATES
  Scenario: The 6 gate states
    Then the gate states are open, resolved, overridden, would-have-blocked, unknown and stale

  @test:scripts/tests/red-flag-taxonomy.test.ts::Gate_behaviour_and_state_derivation_across_all_6_states::State_1:_'would-have-blocked'_under_warn-only_ruling_(2026-10-03_owner_ruling)
  Scenario: An open finding under warn-only would have blocked
    When the open finding is evaluated in "warn" mode
    Then the state is "would-have-blocked", the action "warn", the merge is not blocked
    And the message says it "would have blocked the merge (warn-only ruling 2026-10-03)"

  @test:scripts/tests/red-flag-taxonomy.test.ts::Gate_behaviour_and_state_derivation_across_all_6_states::State_2:_'open'_blocks_merge_under_hard-gate_enforcement
  Scenario: An open finding under the hard gate blocks the merge
    When the open finding is evaluated in "hard" mode
    Then the state is "open", the action "block", the merge is blocked
    And the message says "open blocking finding blocks merge"

  @test:scripts/tests/red-flag-taxonomy.test.ts::Gate_behaviour_and_state_derivation_across_all_6_states::State_3:_'resolved'_passes_the_gate_without_blocking_or_warning
  Scenario: A resolved finding passes
    When a resolved finding is evaluated in "warn" mode
    Then the state is "resolved", the action "pass", and the merge is not blocked

  @test:scripts/tests/red-flag-taxonomy.test.ts::Gate_behaviour_and_state_derivation_across_all_6_states::State_4:_'overridden'_passes_the_gate_and_stays_on_audit_record
  Scenario: An overridden finding passes
    # Gap: the title says it stays on the audit record; the body checks only the state, action and blocking.
    When an overridden finding is evaluated in "warn" mode
    Then the state is "overridden", the action "pass", and the merge is not blocked

  @test:scripts/tests/red-flag-taxonomy.test.ts::Gate_behaviour_and_state_derivation_across_all_6_states::State_5:_'unknown'_when_review_result_is_unknown_or_reviewer_failed
  Scenario: A review whose result is unknown is unknown
    # Gap: the title also says "or reviewer failed"; only a review with result "unknown" is evaluated.
    Given a review with result "unknown"
    When it is evaluated in "warn" mode
    Then the state is "unknown", the action "warn", not blocking, saying "Review outcome is unknown"
    When it is evaluated in "hard" mode
    Then the state is "unknown", the action "block", and the merge is blocked

  @test:scripts/tests/red-flag-taxonomy.test.ts::Gate_behaviour_and_state_derivation_across_all_6_states::State_6:_'stale'_when_commit_head_moved_after_review
  Scenario: A merge review whose head moved is stale
    Given a merge review of head 1111… and a current head 2222…
    When it is evaluated in "warn" mode
    Then the state is "stale", the action "warn", not blocking, saying "Merge review is stale"
    When it is evaluated in "hard" mode
    Then the state is "stale", the action "block", and the merge is blocked

  @test:scripts/tests/red-flag-taxonomy.test.ts::Gate_behaviour_and_state_derivation_across_all_6_states::evaluateReviewGateState_aggregates_findings_correctly
  Scenario: A review's gate state aggregates its findings
    Given a review flagging an open blocking finding
    Then in "warn" mode it is "would-have-blocked", "warn", not blocking
    And in "hard" mode it is "open", "block", blocking
    And a review whose only flag is overridden is "overridden", "pass", not blocking in "warn" mode
