# The companion-role vocabulary in schemas/sdlc/block-qa.ts and the companion helpers in
# pipeline/qa-utils (resolveCompanions, applicabilityGap, missingCompanionNote, hashBlockFiles,
# freshnessKeys, entryIsFresh) that gate QA criteria on a block's sibling files.
# Each Scenario names the test that executes it.
Feature: Companion roles gate QA applicability and freshness

  @test:scripts/tests/companion-roles.test.ts::companion_role_vocabulary::covers_the_paper_adapter's_set
  Scenario: The role vocabulary includes the paper adapter's companions
    Given the companion role vocabulary
    Then it contains "md", "ts" and "lean"

  @test:scripts/tests/companion-roles.test.ts::companion_role_vocabulary::covers_what_WHO_L2_DAK_and_L3_FHIR_blocks_are_made_of
  Scenario: The role vocabulary includes the WHO L2 DAK and L3 FHIR file kinds
    Given the companion role vocabulary
    Then it contains "bpmn", "dmn", "xlsx", "fsh" and "cql"

  @test:scripts/tests/companion-roles.test.ts::companion_role_vocabulary::compiled_FHIR_JSON_is_not_a_role_—_SUSHI_generates_it_from_.fsh
  Scenario: Compiled FHIR JSON is not a companion role
    Given the companion role vocabulary
    Then it does not contain "json"

  @test:scripts/tests/companion-roles.test.ts::companion_role_vocabulary::xlsx_is_not_textual_—_it_is_a_ZIP_container,_not_greppable
  Scenario: xlsx is not a textual companion role but dmn is
    Given the textual companion roles
    Then they do not contain "xlsx"
    And they contain "dmn"

  @test:scripts/tests/companion-roles.test.ts::companion_role_vocabulary::no_duplicates
  Scenario: The role vocabulary has no duplicates
    Given the companion role vocabulary
    Then its distinct count equals its length

  @test:scripts/tests/companion-roles.test.ts::resolveCompanions::discovers_new-role_siblings_from_the_stem
  Scenario: Companions are discovered as siblings of the block stem
    Given a stem "dt-anc-01" with .ts, .dmn and .fsh siblings on disk
    When its companions are resolved from the stem
    Then the dmn, fsh and ts roles point at those sibling files

  @test:scripts/tests/companion-roles.test.ts::resolveCompanions::omits_absent_siblings_rather_than_inventing_paths
  Scenario: Absent siblings are left out rather than guessed
    Given a stem with no .bpmn or .md sibling
    When its companions are resolved from the stem
    Then the bpmn and md roles are undefined

  @test:scripts/tests/companion-roles.test.ts::resolveCompanions::a_caller-resolved_path_wins_over_the_stem_guess
  Scenario: A path supplied by the caller overrides the stem guess
    Given a stem and a caller-supplied lean path "/elsewhere/Foo.lean"
    When its companions are resolved
    Then the lean role is "/elsewhere/Foo.lean"

  @test:scripts/tests/companion-roles.test.ts::resolveCompanions::an_explicitly-absent_role_stays_absent
  Scenario: A role the caller marks absent stays absent
    Given a stem with a .dmn sibling on disk
    When its companions are resolved with dmn explicitly undefined
    Then the dmn role is undefined

  @test:scripts/tests/companion-roles.test.ts::applicabilityGap::undefined_when_every_declared_companion_is_present
  Scenario: No gap when every declared companion is present
    Given a block with .dmn and .ts siblings
    When the applicability gap for depends_on "dmn" and "ts" is computed
    Then there is no gap

  @test:scripts/tests/companion-roles.test.ts::applicabilityGap::names_the_missing_role_—_this_is_what_used_to_be_unreachable
  Scenario: The gap names the missing companion role
    Given a block with no .md or .bpmn sibling
    When the applicability gap for "md" is computed
    Then the gap is "md"
    And the gap for "bpmn" is "bpmn"

  @test:scripts/tests/companion-roles.test.ts::applicabilityGap::reports_in_declared_order,_so_the_sidecar_note_is_stable
  Scenario: The first missing role in declared order is reported
    Given a block with no companions
    When the gap for "md, lean" is computed
    Then it is "md"
    And the gap for "lean, md" is "lean"

  @test:scripts/tests/companion-roles.test.ts::applicabilityGap::a_criterion_depending_on_nothing_always_applies
  Scenario: A criterion with no dependencies always applies
    Given a block with no companions
    When the gap for an empty depends_on is computed
    Then there is no gap

  @test:scripts/tests/companion-roles.test.ts::no_churn_on_the_existing_paper_corpus::the_n/a_note_is_byte-identical_to_the_strings_sidecars_already_hold
  Scenario: The missing-companion note keeps its existing wording
    When the missing-companion note is built for "md" and for "lean"
    Then they are "block has no .md sibling" and "block has no .lean sibling"

  @test:scripts/tests/companion-roles.test.ts::no_churn_on_the_existing_paper_corpus::every_built-in-scoped_criterion_still_declares_only_built-in_companions
  Scenario: Criteria scoped to the content adapters depend only on paper companions
    Given the QA criteria registry
    When each criterion that applies to a content adapter is inspected
    Then every role in its depends_on is "md", "ts" or "lean"

  @test:scripts/tests/companion-roles.test.ts::freshness_over_the_new_roles::hashBlockFiles_hashes_a_.dmn
  Scenario: A .dmn companion is hashed
    Given a block's .dmn file
    When its block files are hashed
    Then the dmn hash is 12 lowercase hex characters

  @test:scripts/tests/companion-roles.test.ts::freshness_over_the_new_roles::existing_{md,_ts,_lean}_call_sites_are_unaffected
  Scenario: Hashing only a .ts yields only a ts key
    Given a block's .ts file
    When its block files are hashed with only the ts role
    Then the hashes hold exactly the key "ts"

  @test:scripts/tests/companion-roles.test.ts::freshness_over_the_new_roles::freshnessKeys_passes_a_new_role_through
  Scenario: Freshness keys include a new role
    Given a criterion depending on "dmn" and also invalidated by "graph"
    When its freshness keys are computed
    Then they are "dmn" then "graph"

  @test:scripts/tests/companion-roles.test.ts::freshness_over_the_new_roles::editing_the_.dmn_invalidates_a_verdict_keyed_on_it
  Scenario: Editing the .dmn makes a verdict keyed on it stale
    Given a pass verdict recorded against the current .dmn hash
    Then the verdict is fresh for the dmn key
    When the .dmn file is rewritten and rehashed
    Then the verdict is no longer fresh

  @test:scripts/tests/companion-roles.test.ts::freshness_over_the_new_roles::a_.dmn_appearing_after_the_audit_invalidates_too
  Scenario: A companion appearing after the audit makes an n/a verdict stale
    # Gap: the test uses a bpmn companion, not a .dmn as the title says
    Given an n/a verdict recorded with no file hashes
    Then it is fresh for the bpmn key while no bpmn hash exists
    And it is not fresh once a bpmn hash appears
