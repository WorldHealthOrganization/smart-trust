Feature: the document content adapter is declared by this layer

  @test:adapters/document/declared-adapter.test.ts::document_adapter_declaration::discoveredFromInstanceDeclaration
  Scenario: is discovered from this layer's declaration
    When the built-in adapters are listed
    Then the "document" adapter belongs to layer folio-assistant-core with class DocumentContentAdapter
    And it extends nothing

  @test:adapters/document/declared-adapter.test.ts::document_adapter_declaration::resolvesToExportedClass
  Scenario: resolves to the class this directory exports
    When the built-in adapter "document" is resolved
    Then there is no fallback reason
    And the constructor is the DocumentContentAdapter class this directory exports
