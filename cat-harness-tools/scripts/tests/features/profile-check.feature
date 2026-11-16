# content_profile_check enforces a folio's content profile: a document folio
# holds no math kinds and no Lean. Each Scenario names the test that executes it.
Feature: Checking a folio's blocks against its content profile

  @test:scripts/tests/profile-check.test.ts::readFolioProfile::reads_the_declared_type_and_records_where_it_came_from
  Scenario: The declared profile is read with where it came from
    Given a folio declaring contentType document
    Then its profile is document, declared by contentType: "document"

  @test:scripts/tests/profile-check.test.ts::readFolioProfile::no_config_falls_back_to_paper,_and_says_it_is_a_fallback
  Scenario: No config falls back to paper and says so
    Given a folio with no config
    Then its profile is paper, declared by the default

  @test:scripts/tests/profile-check.test.ts::readFolioProfile::an_unparseable_config_is_reported,_not_silently_defaulted
  Scenario: An unparseable config is reported
    Given a folio whose config is not JSON
    Then its profile is paper and the source says the config is unreadable

  @test:scripts/tests/profile-check.test.ts::a_conforming_document_folio::passes_with_every_document_kind_present
  Scenario: A conforming document folio passes
    Given a document folio with a prose, a remark and a table block
    When its profile is checked
    Then three blocks are checked, there are no violations, and the report shows a tick

  @test:scripts/tests/profile-check.test.ts::violations::a_math_kind_in_a_document_folio
  Scenario: A math kind in a document folio is a violation naming the remedy
    Given a document folio holding a theorem
    When its profile is checked
    Then there is one kind-outside-profile violation for theorem, naming contentType: "paper"

  @test:scripts/tests/profile-check.test.ts::violations::a_`lean`_field_on_a_kind_the_document_profile_otherwise_allows
  Scenario: A lean field on an allowed kind in a document folio is a violation
    Given a document folio's remark carrying a lean ref
    When its profile is checked
    Then there is one lean-in-document violation saying the manifest declares it

  @test:scripts/tests/profile-check.test.ts::violations::a_`.lean`_sibling_with_nothing_in_the_manifest
  Scenario: A .lean sibling with nothing in the manifest is a violation
    Given a document folio's example block with a .lean file beside it
    When its profile is checked
    Then there is one lean-in-document violation naming the sibling

  @test:scripts/tests/profile-check.test.ts::violations::the_report_names_the_file,_so_the_finding_is_actionable
  Scenario: The report names the block and its file
    Given a document folio holding a lemma
    When the profile check is formatted
    Then it names lem:t and t.ts, with a cross

  @test:scripts/tests/profile-check.test.ts::the_paper_profile_admits_what_the_document_profile_forbids::the_same_corpus_passes_as_a_paper_and_fails_as_a_document
  Scenario: The same corpus passes as a paper and fails as a document
    Given a theorem and a prose block
    Then a paper folio holding them has no violations
    And a document folio holding them has one

  @test:scripts/tests/profile-check.test.ts::an_absent_corpus::no_folio/_is_zero_blocks,_not_an_error
  Scenario: No folio/ is zero blocks, not an error
    Given a document instance with no folio directory
    Then zero blocks are checked and there are no violations
