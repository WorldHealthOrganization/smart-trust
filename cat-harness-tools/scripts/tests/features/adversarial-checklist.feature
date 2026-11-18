# What schemas/sdlc/adversarial-checklist.ts, scripts/adversarial-backfill.ts and the adversarial column of scripts/audit-coverage.ts do:
# the per-kind adversarial review checklists, the risk-ranked backfill that writes review sidecars, and the coverage that counts them.
# Each Scenario names the test that executes it.
Feature: Adversarial review checklists, backfill and coverage

  @test:scripts/tests/adversarial-checklist.test.ts::Adversarial_Checklist_Definitions_(schemas/sdlc/adversarial-checklist.ts)::defines_checklists_for_all_four_content_kinds
  Scenario: Checklists are defined for the tool, schema, skill and process kinds
    Given the adversarial content kinds
    Then they are exactly "tool", "schema", "skill" and "process" in that order
    And each kind has a defined, non-empty checklist

  @test:scripts/tests/adversarial-checklist.test.ts::Adversarial_Checklist_Definitions_(schemas/sdlc/adversarial-checklist.ts)::validates_every_item_against_AdversarialChecklistItemSchema
  Scenario: Every checklist item parses against the checklist item schema
    Given every item of every adversarial checklist
    When each is parsed with AdversarialChecklistItemSchema
    Then every parse succeeds

  @test:scripts/tests/adversarial-checklist.test.ts::Adversarial_Checklist_Definitions_(schemas/sdlc/adversarial-checklist.ts)::retrieves_checklists_by_kind_via_getChecklistForKind
  Scenario: getChecklistForKind returns each kind's own checklist and an empty list for an unknown kind
    When getChecklistForKind is called for "tool", "schema", "skill" and "process"
    Then each returns that kind's checklist constant itself
    And for "unknown" it returns an empty list

  @test:scripts/tests/adversarial-checklist.test.ts::Adversarial_Checklist_Definitions_(schemas/sdlc/adversarial-checklist.ts)::validates_kind_strings_with_isAdversarialContentKind
  Scenario: isAdversarialContentKind accepts the four kinds and rejects anything else
    Then isAdversarialContentKind is true for "tool", "schema", "skill" and "process"
    And it is false for "doc", for null and for the number 123

  @test:scripts/tests/adversarial-checklist.test.ts::Adversarial_Checklist_Definitions_(schemas/sdlc/adversarial-checklist.ts)::tool_checklist_extends_code-node-review_with_expected_rules
  Scenario: The tool checklist extends code-node-review and holds its expected rules
    Given the tool checklist
    Then every item has kind "tool" and extends "code-node-review"
    And its ids include "tool-description-fidelity", "tool-unknown-on-failure", "tool-side-effects-declared" and "tool-deletion-guarded"

  @test:scripts/tests/adversarial-checklist.test.ts::Adversarial_Checklist_Definitions_(schemas/sdlc/adversarial-checklist.ts)::schema_checklist_extends_code-node-review_with_expected_rules
  Scenario: The schema checklist extends code-node-review and holds its expected rules
    Given the schema checklist
    Then every item has kind "schema" and extends "code-node-review"
    And its ids include "schema-field-readers", "schema-enums-closed", "schema-docstring-fidelity" and "schema-backwards-compatible"

  @test:scripts/tests/adversarial-checklist.test.ts::Adversarial_Checklist_Definitions_(schemas/sdlc/adversarial-checklist.ts)::skill_checklist_extends_devils-advocate-watcher_with_expected_rules
  Scenario: The skill checklist extends devils-advocate-watcher and holds its expected rules
    Given the skill checklist
    Then every item has kind "skill" and extends "devils-advocate-watcher"
    And its ids include "skill-narrative-asserts-code", "skill-no-contradiction", "skill-no-prose-counts" and "skill-no-unasked-irreversible-action"

  @test:scripts/tests/adversarial-checklist.test.ts::Adversarial_Checklist_Definitions_(schemas/sdlc/adversarial-checklist.ts)::process_checklist_extends_kg-audit_with_expected_rules
  Scenario: The process checklist extends kg-audit and holds its expected rules
    Given the process checklist
    Then every item has kind "process" and extends "kg-audit"
    And its ids include "process-gateway-branches", "process-no-context-write" and "process-diagram-workflow-fidelity"

  @test:scripts/tests/adversarial-checklist.test.ts::Adversarial_Backfill_&_Risk-Ranking_(scripts/adversarial-backfill.ts)::specifies_the_5_critical_gate-path_nodes_in_mandatory_order
  Scenario: The five gate-path nodes are listed in their mandatory order
    Given the gate-path node list
    Then it holds 5 nodes
    And their ids are "gates", "merge-base", "regen-after-merge", "merge-conflict-patterns" and "kg-qa" in that order

  @test:scripts/tests/adversarial-checklist.test.ts::Adversarial_Backfill_&_Risk-Ranking_(scripts/adversarial-backfill.ts)::ranks_the_5_critical_gate-path_nodes_first_in_risk_ranking
  Scenario: Risk ranking puts the five gate-path nodes first
    Given the candidate nodes gathered from this checkout, at least 5 of them
    When they are risk-ranked
    Then the ranking holds at least 5 nodes
    And its first five ids are "gates", "merge-base", "regen-after-merge", "merge-conflict-patterns" and "kg-qa" in that order

  @test:scripts/tests/adversarial-checklist.test.ts::Adversarial_Backfill_&_Risk-Ranking_(scripts/adversarial-backfill.ts)::reviews_a_node_adversarially_producing_valid_AdversarialReview
  Scenario: An adversarial review of a node is a valid AdversarialReview
    Given a tool node "test-gates" at "scripts/gates.ts"
    When it is reviewed adversarially
    Then the duration is not negative and the token estimate is positive
    And the review parses against AdversarialReviewSchema
    And it records 1 file reviewed
    And it carries one flag per blocking finding

  @test:scripts/tests/adversarial-checklist.test.ts::Adversarial_Backfill_&_Risk-Ranking_(scripts/adversarial-backfill.ts)::records_the_declared_not-disclosed_model,_never_a_hard-coded_id_(owner_E1,_2026-10-15)
  Scenario: A review records the declared not-disclosed model, never a hard-coded id
    Given a tool node "test-gates" at "scripts/gates.ts"
    When it is reviewed adversarially
    Then the reviewer model is the not-disclosed marker
    And the reviewer session is set

  @test:scripts/tests/adversarial-checklist.test.ts::Adversarial_Backfill_&_Risk-Ranking_(scripts/adversarial-backfill.ts)::detects_known_defect_pattern_in_review_(narrative_asserts_code)
  Scenario: A skill whose narrative quotes the known-broken command fails its review
    Given a scratch root holding skill "bad-skill" at "skills/bad-skill.md" quoting "beans <id> --status in-progress"
    When it is reviewed adversarially
    Then the review result is "fail"
    And the only finding is "adv-bad-skill-skill-narrative-asserts-code"
    And it is flagged at "skills/bad-skill.md:command-invocation"
    And the review is a valid AdversarialReview
    When the skill is corrected to "beans update <id> --status in-progress" and reviewed again
    Then the review result is "pass" with no findings

  @test:scripts/tests/adversarial-checklist.test.ts::Adversarial_Backfill_&_Risk-Ranking_(scripts/adversarial-backfill.ts)::never_passes_a_node_whose_file_does_not_exist,_nor_counts_it_as_reviewed
  Scenario: A node whose file does not exist is never reviewed and never passes
    Given a scratch root with no file at "scripts/ghost.ts"
    When tool node "ghost" at "scripts/ghost.ts" is reviewed adversarially
    Then the review result is "unknown", not "pass"
    And no file is counted as reviewed
    And "scripts/ghost.ts" is recorded as skipped because the file does not exist
    And the review has no findings and is a valid AdversarialReview

  @test:scripts/tests/adversarial-checklist.test.ts::Adversarial_Backfill_&_Risk-Ranking_(scripts/adversarial-backfill.ts)::executes_backfill_batch_writing_to_sidecars_and_NEVER_creates_beans
  Scenario: A backfill batch writes its sidecars and never creates beans
    Given the ranked candidate nodes of this checkout with their sidecars redirected to a scratch tree
    When a backfill batch runs with a limit of 2
    Then 2 nodes are reviewed with 2 measurements and a positive token estimate
    And every sidecar is written, and only inside the scratch tree
    And the number of files in "beans/defs" is unchanged

  @test:scripts/tests/adversarial-checklist.test.ts::Audit_Coverage_Adversarial_Integration_(scripts/audit-coverage.ts)::adversarialCoverageByGraph_reports_reviewed_for_kinds_with_reviewed_sidecars
  Scenario: Adversarial coverage counts the tools and skills graphs as reviewed
    Given this repository
    When adversarial coverage is computed per graph
    Then "tools" is "reviewed"
    And "skills" is "reviewed"

  @test:scripts/tests/adversarial-checklist.test.ts::Audit_Coverage_Adversarial_Integration_(scripts/audit-coverage.ts)::KindCoverage_rows_include_adversarial_column_with_valid_states
  Scenario: Every coverage row carries a valid adversarial state
    Given the coverage rows of this repository
    Then there is at least one row
    And every row's adversarial state is "reviewed", "stale" or "never"
    And the "tools" and "skills" rows are "reviewed"
    And the "docs" row is "never"

  @test:scripts/tests/adversarial-checklist.test.ts::Audit_Coverage_Adversarial_Integration_(scripts/audit-coverage.ts)::asRecord_preserves_adversarial_coverage_state
  Scenario: asRecord keeps the row's adversarial state and drops its file lists
    Given the "tools" coverage row of this repository
    When it is turned into a record with asRecord
    Then the record's adversarial state equals the row's, which is "reviewed", "stale" or "never"
    And the record has no "files" or "sidecars" property
    And the record says it has files

  @test:scripts/tests/adversarial-checklist.test.ts::Adversarial_reviews_in_the_attestation_store_(D2_(a),_cat-harness#857)::counts_a_committed_review_as_reviewed_when_its_pinned_hash_is_current
  Scenario: A committed review whose pinned hash is current counts as reviewed
    Given a scratch repository with one skill and a committed adversarial-review attestation pinning the skill's current hash
    And no "test/results" tree
    When adversarial coverage is computed per graph
    Then "skills" is "reviewed"

  @test:scripts/tests/adversarial-checklist.test.ts::Adversarial_reviews_in_the_attestation_store_(D2_(a),_cat-harness#857)::counts_a_committed_review_as_stale_when_the_subject_changed_since
  Scenario: A committed review whose subject changed since counts as stale
    Given a scratch repository with one skill and a committed adversarial-review attestation pinning hash "000000000000"
    And no "test/results" tree
    When adversarial coverage is computed per graph
    Then "skills" is "stale"

  @test:scripts/tests/adversarial-checklist.test.ts::Adversarial_reviews_in_the_attestation_store_(D2_(a),_cat-harness#857)::resolveSidecarPath_derives_the_post-#1014_sdlc_skill_path_from_the_store_and_marks_reviewed_sdlc_skills_as_reviewed_in_--rank
  Scenario: The sidecar path of an sdlc skill uses the post-#1014 layout, and ranking marks the reviewed skill as reviewed
    Given the skill node among the gate-path nodes
    When its sidecar path is resolved
    Then it is "test/results/kg-qa/sdlc/skills/sdlc-core/<id>.kg-qa.json", not the pre-#1014 "skills/sdlc" path
    And the attestation file for the derived path exists while the one for the old path does not
    And in the risk ranking of this checkout that skill has a review that is not stale
