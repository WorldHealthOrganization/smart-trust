# Specifies schemas/kg/jsonld-prefixes.ts (bean folio-assistant-63q4): the
# prefix table schema, mergePrefixTables over needs, and this instance's table
# against the hand-kept published contexts.
Feature: A JSON-LD prefix table binds each prefix to one namespace, merged over needs

  @test:schemas/kg/jsonld-prefixes.test.ts::the_shape::a_prefix_→_namespace_table_is_valid
  Scenario: A prefix table parses
    Given a table binding bibo and fhir to absolute namespaces ending in "/"
    When it is parsed with the prefix table schema
    Then it parses

  @test:schemas/kg/jsonld-prefixes.test.ts::the_shape::a_namespace_IRI_ends_in_/_or_#
  Scenario: A namespace must end in / or #
    Given a table binding bibo to "http://purl.org/ontology/bibo"
    When it is parsed
    Then it is refused

  @test:schemas/kg/jsonld-prefixes.test.ts::the_shape::a_relative_IRI_is_refused
  Scenario: A relative namespace is refused
    Given a table binding x to "ns/x/"
    When it is parsed
    Then it is refused

  @test:schemas/kg/jsonld-prefixes.test.ts::the_shape::a_keyword,_a_URI_scheme_or_the_blank-node_prefix_is_not_a_prefix
  Scenario: Keywords, URI schemes and the blank-node prefix are not prefixes
    Given tables using "@vocab", "http", "_", "urn" and "a:b" as the prefix
    When each is parsed
    Then each is refused

  @test:schemas/kg/jsonld-prefixes.test.ts::the_shape::two_prefixes_for_one_namespace_are_refused
  Scenario: Two prefixes for one namespace are refused
    Given a table binding both dc and dcterms to "http://purl.org/dc/terms/"
    When it is parsed
    Then it is refused

  @test:schemas/kg/jsonld-prefixes.test.ts::flattening_over_needs::dependencies_first,_the_instance's_own_prefixes_added
  Scenario: Tables are merged dependencies first
    Given cat-harness binding dcterms, and folio-assistant-core binding bibo and the same dcterms
    When the tables are merged in that order
    Then the merged table is dcterms then bibo
    And there are no conflicts

  @test:schemas/kg/jsonld-prefixes.test.ts::flattening_over_needs::one_prefix,_two_namespaces:_reported,_not_resolved_by_order
  Scenario: One prefix bound to two namespaces is a conflict
    Given instance a binding fhir to one namespace and instance b binding it to another
    When the tables are merged
    Then the only conflict is for "fhir"
    And it lists the bindings of a and b

  @test:schemas/kg/jsonld-prefixes.test.ts::this_instance::cat-harness.json_still_validates_with_its_table
  Scenario: This instance's declaration validates
    Given this instance's cat-harness.json
    When it is parsed with the declaration schema
    Then it parses

  @test:schemas/kg/jsonld-prefixes.test.ts::this_instance::every_declared_prefix_binds_the_namespace_a_hand-kept_published_context_binds_it_to
  Scenario: Every declared prefix agrees with the published contexts
    Given this instance's jsonldPrefixes table
    And the @context of ns/subgraph/v1.jsonld overlaid with CONTENT_CONTEXT
    When each declared prefix is looked up in that context
    Then it binds the same namespace
