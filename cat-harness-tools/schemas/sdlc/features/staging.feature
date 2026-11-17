# Specifies schemas/sdlc/staging.ts: staging links are defined once in
# staging-comparison.schema.json, mirrored by StagingComparisonSchema and
# copied inline into every skill contract.
Feature: Staging links travel with every skill contract

  @test:schemas/sdlc/staging.test.ts::staging_links::the_JSON_definition_and_the_zod_schema_name_the_same_fields
  Scenario: The JSON definition and the zod schema name the same fields
    Given the harness's staging-comparison.schema.json
    When its properties are compared with the fields of StagingComparisonSchema
    Then they are the same set

  @test:schemas/sdlc/staging.test.ts::staging_links::every_skill_output_contract_carries_stagingLinks
  Scenario: Every skill output contract carries stagingLinks
    Given every output.schema.json under the harness's schemas/skills/
    When its properties are read
    Then each has a stagingLinks property

  @test:schemas/sdlc/staging.test.ts::staging_links::every_inline_copy_is_the_canonical_definition
  Scenario: Every inline copy is the canonical definition
    Given every skill contract with definitions.stagingLinks
    When the copy, less its $comment, is compared with the canonical definition less $schema and $id
    Then none differs

  @test:schemas/sdlc/staging.test.ts::staging_links::every_contract_carrying_stagingLinks_points_at_its_own_inline_copy
  Scenario: Every stagingLinks property points at its own inline copy
    Given every skill contract with a stagingLinks property
    When its $ref is read
    Then it is "#/definitions/stagingLinks"
    And the contract has definitions.stagingLinks

  @test:schemas/sdlc/staging.test.ts::staging_links::every_skill_contract_reads_as_JSON_Schema_under_the_draft_it_declares
  Scenario: Every skill contract reads as JSON Schema
    Given every skill input and output contract
    When zod's fromJSONSchema reads it
    Then none throws
