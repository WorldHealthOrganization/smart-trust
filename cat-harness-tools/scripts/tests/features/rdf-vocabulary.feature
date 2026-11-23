# RDF vocabularies and OMG metamodels in the one class model (bean cat-tools-xfd4):
# scripts/rdf-vocabulary.ts reads the @vocabulary/* N-Quads, scripts/moddle-metamodel.ts the
# bpmn-moddle and dmn-moddle descriptors, and scripts/class-diagram.ts draws them like every source.
# Each Scenario names the test that executes it.
Feature: Published vocabularies and metamodels drawn as classes

  @test:scripts/tests/rdf-vocabulary.test.ts::RDF_vocabulary_reader::draws_each_class_its_own_vocabulary_defines,_as_«owl»_or_«rdfs»,_and_not_one_it_only_mentions
  Scenario: Only the classes a vocabulary defines are drawn
    Given a vocabulary that defines ex:Thing, ex:Place, ex:Region and ex:Colour and mentions foaf:Agent
    When it is read
    Then four boxes are drawn, «owl» for an owl:Class and «rdfs» for an rdfs:Class, and ex:Colour lists its individuals as values

  @test:scripts/tests/rdf-vocabulary.test.ts::RDF_vocabulary_reader::draws_rdfs:subClassOf_as_generalisation,_and_a_restriction_as_the_field's_bounds,_not_as_a_superclass
  Scenario: Subclassing is generalisation and a restriction bounds a field
    Given ex:Place is a subclass of ex:Thing and of a restriction of ex:code to exactly 1
    When it is read
    Then ex:Place extends ex:Thing only, and its field ex:code reads "1..1"

  @test:scripts/tests/rdf-vocabulary.test.ts::RDF_vocabulary_reader::puts_a_property_on_its_domain,_typed_by_its_range:_functional_is_0..1,_unrestricted_is_0..*
  Scenario: A property is a field of its domain, typed by its range
    Given a functional ex:name on ex:Thing, an unrestricted ex:relation on ex:Place, and ex:colour on a union of two classes
    When it is read
    Then ex:name reads "xsd:string [0..1]", ex:relation reads "ex:Place [0..*]", and ex:colour is a field of each member

  @test:scripts/tests/rdf-vocabulary.test.ts::RDF_vocabulary_reader::entails_a_domain_and_range_through_rdfs:subPropertyOf,_and_says_where_they_came_from
  Scenario: Domain and range are entailed through rdfs:subPropertyOf
    Given ex:neighbour, a sub-property of ex:relation, with no domain or range of its own
    When it is read
    Then it is a field of ex:Place typed ex:Place, noted "domain via ex:relation, range via ex:relation"

  @test:scripts/tests/rdf-vocabulary.test.ts::RDF_vocabulary_reader::states_a_property_with_no_domain_in_its_vocabulary's_own_box,_and_a_missing_range_as_such
  Scenario: A property with no domain or range is stated, not invented
    Given ex:tag with neither a domain nor a range
    When it is read
    Then it is a field of the «rdf» box ex, typed "(no range)"

  @test:scripts/tests/rdf-vocabulary.test.ts::RDF_vocabulary_reader::links_an_XSD_range_to_the_XML_Schema_spec,_and_reports_a_class_from_a_vocabulary_not_read_as_unresolved
  Scenario: Datatypes are linked and unread classes are unresolved
    Given ex:name ranging over xsd:string and ex:knows ranging over foaf:Person, whose vocabulary is not read
    When it is read and resolved
    Then xsd:string links to XML Schema 1.1 Part 2 and foaf:Person is an unresolved reference of ex:Thing

  @test:scripts/tests/rdf-vocabulary.test.ts::RDF_vocabulary_reader::draws_in_the_one_look,_labelled_«owl»_/_«rdfs»_upper_right
  Scenario: Vocabulary classes are drawn by the shared renderer
    Given the read vocabulary
    When it is drawn
    Then the boxes are labelled «owl» and «rdfs» and the row reads "ex:name : xsd:string [0..1]"

  @test:scripts/tests/rdf-vocabulary.test.ts::a_vocabulary_read_only_where_the_corpus_names_it_(schema.org,_owner_option_C)::finds_a_class_named_by_CURIE_or_by_IRI_in_either_scheme,_and_not_a_property
  Scenario: The corpus's mentions of a vocabulary's classes are found
    Given text naming schema:MediaObject by CURIE, https://schema.org/DefinedTerm by IRI, and the property schema:name
    When the class mentions are read
    Then the two classes are found, under the package's own http namespace, and the property is not

  @test:scripts/tests/rdf-vocabulary.test.ts::a_vocabulary_read_only_where_the_corpus_names_it_(schema.org,_owner_option_C)::draws_only_the_named_class,_with_its_domainIncludes_properties,_and_leaves_its_superclass_an_external_name
  Scenario: A referenced-only vocabulary draws just the classes the corpus names
    Given a schema.org fixture where only schema:MediaObject is named
    When it is read
    Then only schema:MediaObject is drawn, its fields come from domainIncludes and say so, two rangeIncludes read as one union type, and schema:CreativeWork stays an external name, not unresolved

  @test:scripts/tests/rdf-vocabulary.test.ts::installed_vocabularies::reads_SKOS_from_its_installed_package:_skos:broader_lands_on_skos:Concept_by_entailment
  Scenario: Installed vocabularies are read, and ODRL is reported as not read
    Given this layer depends on @vocabulary/skos, @vocabulary/csvw and @vocabulary/prov and names ODRL as unread
    When they are read
    Then skos:broader is a field of skos:Concept through skos:semanticRelation, csvw:Table and prov:Activity are drawn, schema.org is not parsed until a class is named and then only that class is drawn, and ODRL is reported and not drawn

  @test:scripts/tests/rdf-vocabulary.test.ts::installed_vocabularies::reports_a_declared_package_that_is_not_installed,_and_stands_nothing_in_for_it
  Scenario: A declared vocabulary that is not installed is reported
    Given a package.json depending on a @vocabulary package that is not installed
    When it is read
    Then nothing is drawn and both it and the named unread vocabulary are reported

  @test:scripts/tests/rdf-vocabulary.test.ts::installed_vocabularies::reads_the_BPMN_metamodel_from_bpmn-moddle:_generalisation,_containment,_references_by_id,_and_an_upper_bound_only
  Scenario: BPMN and DMN are read from their moddle metamodels
    Given this layer depends on bpmn-moddle and dmn-moddle
    When their descriptors are read
    Then bpmn:Process extends its two superclasses, reads "?..*" for a list and "?..1" otherwise, references by id are id-refs, and DMN and DC classes are drawn

  @test:scripts/tests/rdf-vocabulary.test.ts::class_model_QA_over_vocabularies::QA:_a_vocabulary_no_external-schema_record_names_is_a_finding
  Scenario: A vocabulary with no external-schema record is a QA finding
    Given SKOS, which a record names, and DCAT, which none does
    When the class model QA runs
    Then DCAT is a finding; with no registry the result is unknown, and with no vocabulary it is n/a
