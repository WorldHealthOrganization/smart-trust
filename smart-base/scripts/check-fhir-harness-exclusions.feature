Feature: The fhir-harness exclusion gate
  fhir-harness stays WHO-free: WHO and DAK names in its code are graded hits,
  mentions in prose are not, and graded hits are held to a baseline ratchet.

  @test:smart-base/scripts/check-fhir-harness-exclusions.test.ts::a_mention_is_not_a_dependency::docblockMentionNotGraded
  Scenario: a docblock naming smart.who.int is a mention, not a graded hit
    Given a fhir-harness TypeScript file whose docblock names smart.who.int
    When it is scanned
    Then it has no graded hits and one mention

  @test:smart-base/scripts/check-fhir-harness-exclusions.test.ts::a_mention_is_not_a_dependency::regexQuotesDoNotOpenString
  Scenario: quotes inside a regex literal do not open a string, so a later comment stays prose (izx8)
    Given a fhir-harness TypeScript file with a regex literal holding quotes, followed by a comment naming smart-base/
    When it is scanned
    Then it has no graded hits
    And its code keeps the regex literal

  @test:smart-base/scripts/check-fhir-harness-exclusions.test.ts::a_mention_is_not_a_dependency::markdownPageIsProse
  Scenario: a markdown page is all prose
    Given a fhir-harness markdown page naming dak.config.json
    When it is scanned
    Then it has no graded hits

  @test:smart-base/scripts/check-fhir-harness-exclusions.test.ts::a_mention_is_not_a_dependency::jsonCommentProseOtherValuesGraded
  Scenario: a JSON _comment or description is prose; any other value is graded
    Given a fhir-harness JSON file with smart.who.int in _comment, description and canonical
    When it is scanned
    Then its one graded hit is "who-canonical" with count 1, and it has two mentions

  @test:smart-base/scripts/check-fhir-harness-exclusions.test.ts::a_mention_is_not_a_dependency::bpmnDocsProseImportLocationGraded
  Scenario: BPMN documentation and XML comments are prose; an import location is not
    Given a fhir-harness BPMN file naming smart-base/ in an XML comment, in documentation and in an import location
    When it is scanned
    Then its graded hits are one "who-layer-path"

  @test:smart-base/scripts/check-fhir-harness-exclusions.test.ts::planted_dependencies_are_graded::templateLiteralDakLabelGraded
  Scenario: a template literal survives comment stripping, so a DAK label inside a string is graded
    Then the code of a line with a "DAK API" template literal keeps "DAK API"
    And scanning a template literal holding "DAK API" grades a "dak-naming" hit

  @test:smart-base/scripts/check-fhir-harness-exclusions.test.ts::planted_dependencies_are_graded::igApiSidecarsNotAHit
  Scenario: the IG API sidecars themselves are the generic FHIR IG API, NOT a hit (owner, 2026-10-03)
    Given code naming the .schema.json, .displays.json and .openapi.json sidecars
    When it is scanned
    Then it has no graded hits

  @test:smart-base/scripts/check-fhir-harness-exclusions.test.ts::planted_dependencies_are_graded::dakNamesAreHits
  Scenario: DAK names are hits: dak-api.html, dakViews, dak-views
    Then code naming "dak-api.html", a function dakViews, or an import of "./dak-views.ts" each grades a "dak-naming" hit

  @test:smart-base/scripts/check-fhir-harness-exclusions.test.ts::planted_dependencies_are_graded::dakFileNameIsHit
  Scenario: a file whose NAME carries a DAK name is a hit, whatever it contains
    Then the paths dak-api.liquid and dak-views.ts are two path hits
    And the paths ig-api-views.ts and gen-ig-pages.ts are none

  @test:smart-base/scripts/check-fhir-harness-exclusions.test.ts::planted_dependencies_are_graded::readingDakConfigJsonGraded
  Scenario: reading dak.config.json
    Then code reading "dak.config.json" grades a "dak-config" hit

  @test:smart-base/scripts/check-fhir-harness-exclusions.test.ts::planted_dependencies_are_graded::readingIndexDakSectionGraded
  Scenario: reading the DAK section of the index
    Then reading contentTypes.dak, by dot or by bracket, grades a "dak-config" hit
    And a shell line running input/scripts/dak_index.py grades a "dak-config" hit
    And reading contentTypes.paper grades nothing

  @test:smart-base/scripts/check-fhir-harness-exclusions.test.ts::planted_dependencies_are_graded::dakStepInvocationGraded
  Scenario: a DAK step invoked from Python or shell; a # comment is not
    Given the first DAK step name
    Then a shell line running it with python3 grades a "dak-step" hit
    And a "#" comment naming it grades nothing

  @test:smart-base/scripts/check-fhir-harness-exclusions.test.ts::planted_dependencies_are_graded::importingWhoPackageGraded
  Scenario: importing from the WHO package
    Given an import from ../../smart-base/skills/content/authoring-who-smart-guidelines/
    Then its graded rules are "who-layer-path" and "who-package"

  @test:smart-base/scripts/check-fhir-harness-exclusions.test.ts::planted_dependencies_are_graded::bareSchemaJsonNotGraded
  Scenario: a bare .schema.json is NOT graded — JSON Schema is not WHO's
    Then code naming "ig-ast.schema.json" grades nothing

  @test:smart-base/scripts/check-fhir-harness-exclusions.test.ts::the_DAK_step_names_come_from_smart-base's_own_tables::dakStepNamesFromBothTables
  Scenario: reads both tables and leaves out the five steps that came down
    Given the DAK step names read from smart-base's tables
    Then they include "generate_dak_from_sushi.py" and "generate_dak_api_hub.py"
    And they include none of the steps that moved down

  @test:smart-base/scripts/check-fhir-harness-exclusions.test.ts::the_ratchet::unbaselinedHitIsRegression
  Scenario: a hit with no baseline entry is a regression
    Given a "who-canonical" hit of count 2 and no baseline
    Then it is judged one regression

  @test:smart-base/scripts/check-fhir-harness-exclusions.test.ts::the_ratchet::hitAboveBaselineIsRegression
  Scenario: a hit above its baseline count is a regression
    Given a baseline entry of count 2 and a hit of count 3
    Then it is judged one regression

  @test:smart-base/scripts/check-fhir-harness-exclusions.test.ts::the_ratchet::hitAtBaselinePasses
  Scenario: a hit at its baseline count passes
    Given a baseline entry of count 2 and a hit of count 2
    Then there are no regressions and nothing stale

  @test:smart-base/scripts/check-fhir-harness-exclusions.test.ts::the_ratchet::clearedHitLeavesBaselineStale
  Scenario: a cleared hit leaves the baseline STALE, so the head-room cannot be reused
    Given a baseline entry of count 2
    Then with no hit, one entry is stale
    And with a hit of count 1, one entry is stale

  @test:smart-base/scripts/check-fhir-harness-exclusions.test.ts::the_ratchet::baselineEntriesNameRuleReasonBean
  Scenario: every baseline entry names a rule that exists and carries a reason and a bean
    Then every entry of the committed baseline names an existing rule
    And has a reason longer than 20 characters
    And names a bean "folio-assistant-" followed by four lowercase letters or digits
