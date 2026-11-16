# The Requirements Standards Assessment methodology (bean
# folio-assistant-1gf7): its conformance to folio-methodology/v1, the
# bootstrap requirement schema's freedom from outside concepts, and mapping
# rules between bootstrap fields and ReqIF, EARS, ISO 29148 and ISO 25010.
# The mapping Scenarios exercise adapters and tables written inside the test
# file itself. Each Scenario names the test that executes it.
Feature: The requirements standards assessment and its mapping rules

  @test:scripts/tests/requirements-standards-assessment.test.ts::requirements-standards-assessment_methodology_conformance::exists_on_disk_and_has_valid_folio-methodology/v1_front_matter
  Scenario: The methodology exists with valid front matter
    Given methodologies/requirements-standards-assessment.md
    Then its front matter parses as folio-methodology/v1 named "requirements-standards-assessment"
    And its title mentions "bootstrap Requirement", its origin ReqIF, EARS and 29148, its applies-when "higher harness layers"
    And it cites at least one piece of evidence

  @test:scripts/tests/requirements-standards-assessment.test.ts::requirements-standards-assessment_methodology_conformance::resolves_all_cited_evidence_in_library
  Scenario: Every cited piece of evidence resolves in the library
    Then every evidence reference in the methodology's front matter resolves

  @test:scripts/tests/requirements-standards-assessment.test.ts::requirements-standards-assessment_methodology_conformance::contains_all_required_survey_sections_in_its_body
  Scenario: The methodology body holds every survey section
    Then its body names ReqIF, OSLC-RM, EARS, ISO/IEC/IEEE 29148:2018, IEEE Std 830-1998, ISO/IEC 25010 and the INCOSE guide
    And it states the no-outside-concept rule, the native-format recommendation, and layers 0, 1 and 2

  @test:scripts/tests/requirements-standards-assessment.test.ts::bootstrap_requirement_schema_decoupling::remains_free_of_external_dependencies_and_outside_concepts
  Scenario: The bootstrap requirement schema is free of outside concepts
    # Gap: when bootstrap/schemas/requirement.schema.json is not found the test returns early and passes without asserting anything.
    Given the bootstrap requirement JSON schema
    Then it is draft-07 and mentions none of "reqif", "oslc", "oasis-open.org" and "omg.org"
    And it defines id, title, description and statements natively
    And a statement's conformance is SHALL, SHOULD, MAY or SHALL NOT, its kind functional or non-functional
    And a success criterion's verification is test, inspection, review or analysis

  @test:scripts/tests/requirements-standards-assessment.test.ts::standards_translation_rules_and_mappings::ReqIF_SpecObject_mapping::maps_a_bootstrap_statement_to_a_valid_ReqIF_SpecObject_structure
  Scenario: A bootstrap statement maps to a ReqIF SpecObject
    # Gap: the mapping adapter is defined inside the test file; no repository code is exercised.
    When the sample statement of "req:plan-request" is mapped to ReqIF
    Then its identifier is "req:plan-request#detect-plan-request" of type "SpecObjectType_RequirementStatement"
    And its ForeignID, Name, Text and ConformanceLevel carry the statement's id, label, text and "SHALL"

  @test:scripts/tests/requirements-standards-assessment.test.ts::standards_translation_rules_and_mappings::ReqIF_SpecObject_mapping::supports_round-trip_fidelity_between_bootstrap_statement_and_ReqIF_SpecObject_attributes
  Scenario: A statement round-trips through ReqIF
    # Gap: both mapping adapters are defined inside the test file; no repository code is exercised.
    When the sample statement is mapped to ReqIF and back
    Then its key, label, requirement, conformance, kind and benefit are unchanged

  @test:scripts/tests/requirements-standards-assessment.test.ts::standards_translation_rules_and_mappings::EARS_pattern_syntax_classification::correctly_identifies_all_5_canonical_EARS_syntax_patterns
  Scenario: The five EARS patterns are told apart
    # Gap: the EARS classifier is defined inside the test file; no repository code is exercised.
    Then ubiquitous, event-driven, state-driven, unwanted-behaviour and optional-feature sentences are each classified as such
    And a sentence of none of these shapes is "non-ears"

  @test:scripts/tests/requirements-standards-assessment.test.ts::standards_translation_rules_and_mappings::EARS_pattern_syntax_classification::classifies_the_sample_statement_as_event-driven_EARS
  Scenario: The sample statement is event-driven EARS
    # Gap: the EARS classifier is defined inside the test file; no repository code is exercised.
    Then the sample statement's requirement is classified "event-driven"

  @test:scripts/tests/requirements-standards-assessment.test.ts::standards_translation_rules_and_mappings::ISO/IEC/IEEE_29148:2018_verification_method_alignment::maps_all_bootstrap_verification_methods_1:1_to_ISO_29148_Clause_6.4_methods
  Scenario: Bootstrap verification methods map one to one onto ISO 29148
    # Gap: CAN NEVER FAIL against repository code. Both mapping tables are literals in the test file, so it checks only that the test's own two tables are inverses.
    Then each of test, inspection, review and analysis maps to an ISO 29148 method that maps back to it

  @test:scripts/tests/requirements-standards-assessment.test.ts::standards_translation_rules_and_mappings::ISO/IEC_25010_quality_model_category_validation::recognizes_standard_ISO_25010_product_quality_characteristics_as_valid_NFR_categories
  Scenario: ISO 25010 characteristics are valid quality categories
    # Gap: the category set and its check are defined inside the test file; no repository code is exercised.
    Then security, performance-efficiency, maintainability, reliability and safety are valid categories
    And "random-non-standard-category" is not
