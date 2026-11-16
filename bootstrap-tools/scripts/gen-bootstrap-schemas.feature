# gen-bootstrap-schemas: the generator mints every $id from the bootstrap
# checkout it is handed. Each Scenario names the test that executes it, in the
# grammar @test:<file>::<scope>::<name> (skill test-engineer, "Every test has a
# Gherkin").
Feature: gen-bootstrap-schemas mints from the bootstrap checkout it is handed

  @test:scripts/gen-bootstrap-schemas.test.ts::the_generator_mints_from_the_bootstrap_checkout_it_is_handed::rootNamesTheRelease
  Scenario: a fork's iriBase names the generated schemas
    Given a copy of bootstrap whose bootstrap.json sets iriBase to "https://example.org/fork/"
    When gen-bootstrap-schemas runs with --root at that copy
    Then it exits 0
    And the copy's schemas/graph.schema.json has $id "https://example.org/fork/v<major>/schemas/graph.schema.json", where <major> is the declared version's major
