Feature: this layer's own namespaces

  @test:schemas/own-namespace.test.ts::own_namespaces,_derived_from_the_declaration_(folio-assistant#2598)::vocabularyNamespaceUnchanged
  Scenario: the vocabulary namespace is unchanged
    When the core namespace is read
    Then it is https://litlfred.github.io/folio-assistant-core/v0/ns/

  @test:schemas/own-namespace.test.ts::own_namespaces,_derived_from_the_declaration_(folio-assistant#2598)::dspaceNamespaceUnchanged
  Scenario: the DSpace field namespace is unchanged, and is what dublin-core mints under
    When the DSpace namespace is read
    Then it is the core namespace followed by dspace/
    And it is the namespace dublin-core mints under
