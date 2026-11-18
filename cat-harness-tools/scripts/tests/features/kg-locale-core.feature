# `scripts/kg-locale-export.ts --core` reads the core document kg-export just wrote
# rather than building it again, and refuses a file that is not this run's core.
# Each Scenario names the test that executes it.
Feature: Locale export reads only this run's core document

  @test:scripts/tests/kg-locale-core.test.ts::--core::a_core_document_with_another_@id_is_refused_before_anything_is_translated
  Scenario: A core document with a foreign @id is refused before anything is translated
    Given a core document whose @id is "https://example.org/not-this.jsonld" and whose graph is empty
    When the locale exports are built from it
    Then the build rejects with "not this run's core document"
