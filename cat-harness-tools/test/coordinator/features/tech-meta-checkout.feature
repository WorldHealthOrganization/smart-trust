# Specifies scripts/_tech_meta.py's tech_meta against the digest
# pdf-structure recorded for a real who-iris library entry.
Feature: tech_meta's digest of a real source agrees with pdf-structure's

  @test:test/coordinator/tech-meta-checkout.test.ts::the_mechanical_facts::the_real_corpus_agrees_with_what_pdf-structure_recorded_independently
  Scenario: The SHA-256 of who-pub-tps-931's source matches its structure.json
    Given the library entry who-pub-tps-931, found through the declarations
    And the source file its structure.json names, under its instance's uploads/<slug>/
    When tech_meta is run on that file with python3
    Then the entry exists and the source file exists
    And its sha256 equals the one structure.json records
