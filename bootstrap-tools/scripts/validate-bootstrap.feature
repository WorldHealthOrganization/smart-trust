Feature: bootstrap:validate — bootstrap's documents, parsed against their Zod

  Background:
    Given the real bootstrap checked out beside the tools
    And throwaway bootstrap-shaped trees holding the real declaration, the published discussion schemas and a model registry each scenario chooses

  @test:scripts/validate-bootstrap.test.ts::the_committed_corpus::committedCorpusParses
  Scenario: every document bootstrap carries parses
    When the validator runs over the real bootstrap
    Then at least 2 documents are valid
    And none fails

  @test:scripts/validate-bootstrap.test.ts::a_valid_and_an_invalid_fixture::validRegistryPasses
  Scenario: valid: a well-formed model registry passes
    Given a tree whose model registry holds one well-formed model
    When the validator runs over it
    Then nothing fails

  @test:scripts/validate-bootstrap.test.ts::a_valid_and_an_invalid_fixture::invalidRegistryNamesWhere
  Scenario: invalid: a registry entry with a wrong-typed field fails, and names where
    Given a tree whose one model has a number as its validation
    When the validator runs over it
    Then the only failure is the model registry
    And its issues mention validation

  @test:scripts/validate-bootstrap.test.ts::a_valid_and_an_invalid_fixture::unreadableJsonFails
  Scenario: unreadable JSON is a failure, never a skip
    Given a tree whose models.json is not valid JSON
    When the validator runs over it
    Then the only failure is unreadable

  @test:scripts/validate-bootstrap.test.ts::a_valid_and_an_invalid_fixture::missingDocumentFails
  Scenario: a missing required document is a failure
    Given a tree with models.json removed
    When the validator runs over it
    Then the only failure is absent

  @test:scripts/validate-bootstrap.test.ts::a_valid_and_an_invalid_fixture::discussionFoundBySchema
  Scenario: a discussion document is found by its `$schema`, and judged
    Given a tree holding good.json, a well-formed discussion input, and bad.json, whose open is not a list, both carrying the discussion input schema's $id as $schema
    Then 2 discussion documents are found
    When the validator runs over it
    Then the only failure is bad.json

  @test:scripts/validate-bootstrap.test.ts::a_valid_and_an_invalid_fixture::missingSchemaIdUnrunnable
  Scenario: a published discussion schema with no `$id` makes the run unrunnable, not clean
    Given a tree whose discussion input schema is an empty object
    When the discussion schema ids are read
    Then it throws

  @test:scripts/validate-bootstrap.test.ts::a_valid_and_an_invalid_fixture::builtGraphJudged
  Scenario: the built graph is judged too — and a build that throws is a failure, not a skip
    When the validator runs over the real bootstrap
    Then the built Knowledge Graph is valid
    When a required built graph whose build throws is validated
    Then it is a failure
    When a required built graph whose build returns an empty object is validated
    Then it is invalid
