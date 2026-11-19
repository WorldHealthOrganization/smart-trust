Feature: Generating the IG API sidecars from an AST

  @test:scripts/ig-api-gen.test.ts::pyJson::pyJsonLayoutAndOrder
  Scenario: writes Python's indent=2 layout and keeps a code-keyed map's order, numeric keys included
    Then JSON is written in Python's indent-2 layout, with empty lists and objects inline
    And a code-keyed map keeps insertion order, numeric keys included, and a re-set key keeps its place
    And an ordered map converts to a plain object

  @test:scripts/ig-api-gen.test.ts::ValueSets::valueSetSinglesSystem
  Scenario: pins a single system, falls back to the code for an empty display, and names files by the entry's id
    Given a ValueSet expansion of one system with codes "red" and "1"
    When its schema is written
    Then its id is the ValueSet's schema URL, its system is fixed and its codes enum is "red" then "1"
    And it records the expansion timestamp
    And the displays keep the code order
    And a file id is taken from the entry's full URL

  @test:scripts/ig-api-gen.test.ts::ValueSets::multiSystemOneOf
  Scenario: splits a multi-system ValueSet into oneOf, and aliases each system in the vocabulary
    Given codes from two code systems
    Then the schema splits into two oneOf branches
    And the vocabulary aliases each system, names each code with its system alias and uses the given FHIR vocabulary base
    And a code system's IRI joins its type and id with a dash

  @test:scripts/ig-api-gen.test.ts::logical_models::logicalModelBindsValueSet
  Scenario: derives from the base schema, binds a ValueSet by reference and records it in the JSON-LD context
    Given a logical model with a required name and a coded element bound to a ValueSet
    When its schema is written
    Then its id is the model's schema URL and it requires resourceType and name
    And the coded element refers to the ValueSet's schema and the context records the ValueSet's JSON-LD
    And it has no extension property
    And a resource profile is not a logical model

  @test:scripts/ig-api-gen.test.ts::logical_models::localModelBySiblingFile
  Scenario: refers to a model of this IG by sibling file, and to one from another package by that package's absolute schema URL
    Given a logical model with an element typed by a model of this IG and one typed by a model of another package
    Then the local model is referred to by its sibling schema file
    And the other package's model is referred to by its absolute schema URL with a description
    And without the list of local models the canonical base decides, and an overridden base still keeps listed models local

  @test:scripts/ig-api-gen.test.ts::logical_models::schemaKindsAndEnumeration
  Scenario: files every non-ValueSet, non-CodeSystem schema as a logical model, and lists them in its enumeration
    Then a ValueSet schema is "valueset" and a StructureDefinition schema is "logical_model"
    And a CodeSystem schema and an enumeration file have no kind
    And a logical model enumeration lists each schema with its file name, title and url

  @test:scripts/ig-api-gen.test.ts::generateIgApi::readsAstIntoSidecarsAndSite
  Scenario: reads the AST: ValueSet files from its expansions, schemas, their wrappers, the enumerations and the Swagger page
    Given an AST with an ImplementationGuide and a ValueSet expansion
    When the IG API is generated with the label "Example API"
    Then the ValueSet's displays, JSON-LD, OpenAPI and schema sidecars are written
    And the site files are the ValueSets enumeration, its schema and the OpenAPI page
    And the OpenAPI page is titled with the label and points at the ValueSet's OpenAPI file

  @test:scripts/ig-api-gen.test.ts::generatedAtOf_(cat-harness-tools#1230)::stampsAstCompileTime
  Scenario: stamps the vocabularies with when the AST was compiled, so two runs write the same bytes
    Given an AST whose manifest records when it was generated
    Then that time is read and stamped into the ValueSet's JSON-LD
    And a second run writes the same bytes
    And a manifest with no time gives none
