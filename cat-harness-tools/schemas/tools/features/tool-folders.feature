# schemas/tools/tool-folders.ts: a Tool's own IRI sits in a tools/ folder beside its instance
# document. Each Scenario names the test that executes it.
Feature: A Tool's IRI sits beside its instance document

  @test:schemas/tools/tool-folders.test.ts::toolIri::the_host's_document:_tools/_at_the_base
  Scenario: The host's tools sit in tools/ at the base
    Given the document IRI "https://x.test/fa/cat-harness.jsonld"
    When the IRI of tool "beans-cli" is made
    Then it is "https://x.test/fa/tools/beans-cli.jsonld"

  @test:schemas/tools/tool-folders.test.ts::toolIri::a_foreign_instance's_document:_tools/_inside_its_own_segment
  Scenario: A foreign instance's tools sit in tools/ inside its own segment
    Given the document IRI "https://x.test/fa/smart-base/smart-base.jsonld"
    When the IRI of tool "extract-dak" is made
    Then it is "https://x.test/fa/smart-base/tools/extract-dak.jsonld"

  @test:schemas/tools/tool-folders.test.ts::toolIri::a_fragment_on_the_document_IRI_is_not_part_of_the_directory
  Scenario: A fragment on the document IRI is not part of the directory
    Given the document IRI "https://x.test/fa/cat-harness.jsonld#tool/old"
    When the IRI of tool "a" is made
    Then it is "https://x.test/fa/tools/a.jsonld"

  @test:schemas/tools/tool-folders.test.ts::toolIri::no_base:_document-relative,_never_rooted_at_/
  Scenario: With no base, a tool IRI is document-relative, never rooted at /
    Given the bare document name "cat-harness.jsonld"
    When the IRI of tool "a" is made
    Then it is "tools/a.jsonld"
    And the tool's document path is "tools/a.jsonld"
