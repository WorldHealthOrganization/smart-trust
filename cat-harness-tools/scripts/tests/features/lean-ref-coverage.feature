# Import and single-source-of-truth hygiene guards over the harness's
# TypeScript. Each Scenario names the test that executes it.
Feature: Import hygiene guards

  @test:scripts/tests/lean-ref-coverage.test.ts::import_+_SSOT_hygiene_guards::no_imports_reference_the_non-existent_folio-assistant/schemas_path
  Scenario: No import names the non-existent folio-assistant/schemas path
    When the .ts files under the harness's content, adapters, schemas, src and scripts are read
    Then no import or export-from statement names a folio-assistant/schemas path
