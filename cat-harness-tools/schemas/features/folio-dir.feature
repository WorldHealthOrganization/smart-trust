# folioDir in schemas/kg/cat-harness.ts: a folio says where its content is in its
# declaration, the platform asks, and folio/ is only the fallback when nothing is declared.
# Each Scenario names the test that executes it.
Feature: folioDir resolves a folio's declared content root

  @test:schemas/folio-dir.test.ts::folioDir::a_folio_DECLARING_content/_resolves_to_content/_—_the_qou_case
  Scenario: A folio declaring content/ resolves to content/
    Given a repository whose declaration has a "folio" directory at "content/"
    When folioDir is asked for its root
    Then it is the repository's content directory

  @test:schemas/folio-dir.test.ts::folioDir::a_folio_declaring_some_OTHER_path_resolves_there_too
  Scenario: A folio declaring another path resolves to that path
    Given a repository whose declaration has a "folio" directory at "paper/"
    When folioDir is asked for its root
    Then it is the repository's paper directory

  @test:schemas/folio-dir.test.ts::folioDir::no_declaration_falls_back_to_the_CONVENTION,_which_is_folio/
  Scenario: With no declaration folioDir falls back to folio/
    Given a repository with no declaration
    When folioDir is asked for its root
    Then the path ends in "folio"

  @test:schemas/folio-dir.test.ts::folioDir::the_fallback_is_never_`content/`_—_that_root_is_excised
  Scenario: The fallback is never content/
    Given a repository with no declaration
    When folioDir is asked for its root
    Then the path does not end in "content"

  @test:schemas/folio-dir.test.ts::folioDir::a_declaration_that_does_NOT_name_a_folio_graph_falls_back
  Scenario: A declaration with no folio graph falls back to folio/
    Given a repository whose declaration names only a "beans" directory
    When folioDir is asked for its root
    Then it is the repository's folio directory

  @test:schemas/folio-dir.test.ts::folioDir::a_MALFORMED_declaration_throws_rather_than_guessing
  Scenario: A malformed declaration makes folioDir throw
    Given a repository whose declaration, named after its directory, is not valid JSON
    When folioDir is asked for its root
    Then it throws

  @test:schemas/folio-dir.test.ts::end_to_end_—_a_consumer_finds_a_folio_that_declares_content/::findPapers_reads_a_folio_whose_declaration_names_content/
  Scenario: findPapers finds a paper in a folio that declares content/
    Given a repository declaring its folio at "content/" with content/demo-paper/demo-paper.ts
    When findPapers reads the repository
    Then it finds exactly "demo-paper"
