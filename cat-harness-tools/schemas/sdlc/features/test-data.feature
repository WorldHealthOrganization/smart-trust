# Specifies schemas/sdlc/test-data.ts: fixed and generated test-data sets and
# the SME case verdict (beans vm6m and vljz, issue #363), told apart by their
# content, never their path, and reviewed by an attributable human SME.
Feature: Fixed and generated test data, and the SME verdicts that review them

  @test:schemas/sdlc/test-data.test.ts::graph_typologies_&_node_kinds_—_separate_declared_directories_(`vm6m`,_`vljz`)::`test-data-fixed`,_`test-data-generated`,_and_`sme-case-verdict`_are_registered_as_distinct_content_typologies
  Scenario: The three test-data typologies are registered, distinct content
    When the "test-data-fixed", "test-data-generated" and "sme-case-verdict" graph typologies are looked up
    Then each is registered, not renderable, in the "content" layer, and not writable by a process
    And their IRIs and those of "test-plan" and "test-report" are five distinct IRIs

  @test:schemas/sdlc/test-data.test.ts::graph_typologies_&_node_kinds_—_separate_declared_directories_(`vm6m`,_`vljz`)::fixed_and_generated_node_kinds_share_`TestDataSetBaseKind`_and_resolve_through_`validators/*.json`
  Scenario: Fixed and generated kinds share a base kind and resolve their validators
    Then the fixed and the generated test-data kinds each have exactly the parent TestDataSetBaseKind
    And the SME case verdict kind's tag is the SME case verdict schema id
    And the validator of each of the three typologies resolves from the harness root

  @test:schemas/sdlc/test-data.test.ts::fixed_vs_generated_discrimination_from_file_content,_never_from_path_(`vm6m`)::`discriminateTestDataSet`_identifies_fixed_vs_generated_from_`$schema`_and_`kind`_inside_the_document
  Scenario: A set is identified as fixed or generated from its content
    Given a reviewed fixed set "anc-danger-signs-cases" and a generated recipe "measles-dropout-synthetic-cohort"
    When each is discriminated
    Then the first is "fixed" with its id
    And the second is "generated" with its id

  @test:schemas/sdlc/test-data.test.ts::fixed_vs_generated_discrimination_from_file_content,_never_from_path_(`vm6m`)::refuses_a_fixed_set_that_carries_generation_recipe_fields_(`template`,_`params`,_`seed`)_or_empty_records
  Scenario: A fixed set with recipe fields or no records is refused
    Given the reviewed fixed set
    When it carries a template, or a seed, or an empty records list
    Then the fixed set schema refuses each

  @test:schemas/sdlc/test-data.test.ts::fixed_vs_generated_discrimination_from_file_content,_never_from_path_(`vm6m`)::refuses_a_generated_set_that_stores_materialised_`records`,_`cases`,_`path`,_or_`review`
  Scenario: A generated set storing materialised data is refused
    Given the generated recipe
    When it carries records, cases, a path, or a review
    Then the generated set schema refuses each

  @test:schemas/sdlc/test-data.test.ts::fixed_vs_generated_discrimination_from_file_content,_never_from_path_(`vm6m`)::refuses_a_document_where_`$schema`_and_`kind`_disagree
  Scenario: A document whose $schema and kind disagree is refused
    When the fixed set declares the generated $schema
    Then discrimination throws
    And the generated recipe declaring the fixed $schema also throws

  @test:schemas/sdlc/test-data.test.ts::fixed_vs_generated_discrimination_from_file_content,_never_from_path_(`vm6m`)::deterministic_recipe_digest_(`computeGeneratedSetDigest`)_is_key-order_independent_and_catches_recipe_drift
  Scenario: The recipe digest ignores key order and catches drift
    Given two recipes equal except for the key order of their nested params
    When their digests are computed
    Then they are equal
    And a recipe with a different seed has a different digest
    And the sample generated recipe's digest verifies
    And the recipe with a wrong sha256 is refused

  @test:schemas/sdlc/test-data.test.ts::fixed_vs_generated_discrimination_from_file_content,_never_from_path_(`vm6m`)::FHIR_templating_is_one_named_specialisation_alongside_other_content_types_(`vm6m`)
  Scenario: FHIR templating is one specialisation among others
    Then the FHIR templating specialisation is "fhir-templating"
    And the specialisation examples include fhir-templating, markdown-fixture and lean-counterexample
    And a generated document recipe with specialisation "markdown-fixture" and a correct digest parses with that specialisation

  @test:schemas/sdlc/test-data.test.ts::fixed_vs_generated_discrimination_from_file_content,_never_from_path_(`vm6m`)::bridges_fixed_and_generated_sets_into_`test-plan/v1`_`TestDataRef`_and_preserves_`isEvidence`
  Scenario: Sets bridge into test-plan TestDataRefs, keeping isEvidence
    When the reviewed fixed set is converted to a TestDataRef with a path
    Then the ref parses and is evidence
    And the same set without its review converts to a ref that is not evidence
    And the generated recipe converts to a ref that parses and is not evidence

  @test:schemas/sdlc/test-data.test.ts::SME_review_of_decision_support_and_indicator_definitions_(`vljz`)::accepts_a_decision-support_worked_case_verdict_and_an_indicator_cohort_verdict
  Scenario: Decision-support case verdicts and indicator cohort verdicts parse
    Given a decision-support verdict on a worked case and an indicator-definition verdict on a cohort, both by a human clinical SME
    When each is parsed with the SME case verdict schema
    Then their subject kinds are "decision-support" and "indicator-definition"

  @test:schemas/sdlc/test-data.test.ts::SME_review_of_decision_support_and_indicator_definitions_(`vljz`)::refuses_collapsing_the_two_units:_decision-support_requires_`case`_and_forbids_`cohort`;_indicator-definition_requires_`cohort`_and_forbids_`case`
  Scenario: Case and cohort verdicts cannot be collapsed
    Then a decision-support verdict without a case is refused
    And a decision-support verdict that also carries a cohort is refused
    And an indicator-definition verdict without a cohort is refused
    And an indicator-definition verdict that also carries a case is refused

  @test:schemas/sdlc/test-data.test.ts::SME_review_of_decision_support_and_indicator_definitions_(`vljz`)::requires_attributable_human_SME_identity_and_review_date_(`bean_vljz`)
  Scenario: An SME verdict needs an attributable human reviewer and a review date
    Given the decision-support verdict
    Then it is refused without a reviewer
    And it is refused with an agent reviewer
    And it is refused with an empty reviewer handle
    And it is refused without reviewedAt
    And it is refused with reviewedAt "last-tuesday"

  @test:schemas/sdlc/test-data.test.ts::BPMN_processes_and_`judgementOnly`_SME_role_(`vm6m`,_`vljz`)::`clinical-sme`_role_is_`judgementOnly:_true`_with_`skills:_[]`,_and_`tester`_+_`authoring-agent`_carry_`test-data-sets`
  Scenario: The clinical SME role is judgement-only; tester and authoring agent carry test-data-sets
    Given the role graph under the harness's scenarios/
    Then the "clinical-sme" role is judgementOnly, has no skills and is held only by persons
    And the "tester" and "authoring-agent" roles each have the skill "test-data-sets"

  @test:schemas/sdlc/test-data.test.ts::BPMN_processes_and_`judgementOnly`_SME_role_(`vm6m`,_`vljz`)::`test-data-curation.bpmn`_calls_content-type_specialisation_and_SME_review_subprocesses,_and_`sme-test-data-review.bpmn`_puts_`Task_SmeJudge`_in_the_`judgementOnly`_`clinical-sme`_lane
  Scenario: The curation and SME review diagrams wire in the SME judge
    Given the harness's sdlc/processes/test-data-curation.bpmn
    Then it declares Process_TestDataCuration, the call activity Call_ContentTypeSpecialisation, a call to Process_SmeTestDataReview, and mentions fhir-templating
    Given the harness's sdlc/processes/sme-test-data-review.bpmn
    Then it declares Process_SmeTestDataReview and the lane Lane_SME bound to clinical-sme
    And Task_SmeJudge is a user task in that lane that names no skill
