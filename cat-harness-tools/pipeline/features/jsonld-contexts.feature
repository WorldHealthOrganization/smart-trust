# pipeline/jsonld-contexts.ts decides which prefixes and remote-context terms a JSON-LD
# document uses, and builds an instance context that binds only those.
# Each Scenario names the test that executes it.
Feature: JSON-LD prefix use and instance contexts

  @test:pipeline/jsonld-contexts.test.ts::curiePrefix::a_CURIE_has_a_prefix
  Scenario: A CURIE yields its prefix
    Given the CURIEs "doco:Section" and "folio-assistant-core:Definition"
    When the prefix of each is read
    Then the prefixes are "doco" and "folio-assistant-core"

  @test:pipeline/jsonld-contexts.test.ts::curiePrefix::an_IRI,_a_blank_node,_a_keyword,_a_scheme_or_prose_is_not_a_CURIE
  Scenario: An IRI, a blank node, a keyword, a scheme or prose has no CURIE prefix
    Given strings such as "http://x.org/a", "urn:isbn:123", "_:b0", "@id", "mailto:a@b.org", "data:text/plain,x", "Note: something" and "no colon"
    When the prefix of each is read
    Then none of them has a prefix

  @test:pipeline/jsonld-contexts.test.ts::usedPrefixes::strings_inside_ARRAYS_count_—_the_case_check-context-emission's_walk_missed
  Scenario: Strings inside arrays count as prefix uses
    Given a document whose "@type" is an array of "doco:Section" and "deo:Introduction" and whose tags array holds "skos:x"
    When its used prefixes are collected
    Then the used prefixes are deo, doco and skos
    And doco is used in an IRI position
    And skos is used only as a literal

  @test:pipeline/jsonld-contexts.test.ts::usedPrefixes::every_@context_subtree_is_skipped:_a_binding_is_not_a_use
  Scenario: A prefix bound inside any @context subtree is not a use
    Given a document whose top-level and nested @context bind oa, rdfs and fhir, and which has a "prov:wasDerivedFrom" key
    When its used prefixes are collected
    Then prov is the only used prefix

  @test:pipeline/jsonld-contexts.test.ts::usedPrefixes::absolute_IRIs_and_schemes_are_not_CURIEs,_in_any_position
  Scenario: Absolute IRIs, schemes and blank nodes are not CURIEs in any position
    Given a document with http and https IRIs as @id and @type, urn and mailto values, and a blank-node key
    When its used prefixes are collected
    Then no prefix is used

  @test:pipeline/jsonld-contexts.test.ts::usedPrefixes::keys_and_@type_are_IRI_positions;_plain_values_are_literals
  Scenario: Keys and @type are IRI positions while plain values are literals
    Given a document with key "cito:cites" whose value is "qou:QOU.Torsion.x", and a "label" of "def:foo"
    When its used prefixes are collected
    Then cito is used as an IRI
    And qou and def are used as literals

  @test:pipeline/jsonld-contexts.test.ts::usedPrefixes::a_remote_context's_aliases_count_when_the_document_names_it
  Scenario: A named remote context's aliases count as uses
    Given a remote content context aliasing title to "dcterms:title" and cites to an @id-typed "cito:cites"
    And a document naming that context and using title and cites with value "skos:z"
    When its used prefixes are collected
    Then the used prefixes are cito, dcterms and skos
    And skos is used as an IRI because cites is @id-typed

  @test:pipeline/jsonld-contexts.test.ts::usedPrefixes::an_alias_does_NOT_count_when_the_document_does_not_name_that_context
  Scenario: An alias does not count when the document does not name its context
    Given the remote content context is known but the document has no @context
    When the used prefixes of a document using title are collected
    Then no prefix is used

  @test:pipeline/jsonld-contexts.test.ts::usedPrefixes::a_@json_value_is_data:_its_keys_and_strings_are_literals
  Scenario: A @json value is data whose keys and strings are literals
    Given a document naming the content context with a @json-typed meta value of key "fhir:x" and value "oa:y"
    When its used prefixes are collected
    Then fhir and oa are used only as literals

  @test:pipeline/jsonld-contexts.test.ts::usedPrefixes::a_full-IRI_term_counts_the_prefix_whose_namespace_it_is_in,_when_given_the_namespaces
  Scenario: A full-IRI term counts the prefix of its namespace only when namespaces are given
    Given a remote context defining alternateOf as "http://www.w3.org/ns/prov#alternateOf"
    When a document using alternateOf is read with the prov namespace map
    Then prov is the used prefix
    And without the namespace map no prefix is used

  @test:pipeline/jsonld-contexts.test.ts::ownBindings_/_isContextDocument::a_document's_inline_context_binds_a_prefix;_a_CURIE-valued_term_does_not
  Scenario: An inline context binds a prefix but a CURIE-valued term does not
    Given a document whose @context lists the content context and an object binding fhir to an IRI and name to "rdfs:label"
    When its own bindings are read
    Then fhir is the only binding

  @test:pipeline/jsonld-contexts.test.ts::ownBindings_/_isContextDocument::a_context-only_file_is_a_context_document;_a_node_is_not
  Scenario: A context-only file is a context document and a node is not
    Given a file holding only a @context
    Then it is a context document
    And a file with a @context and an @id is not

  @test:pipeline/jsonld-contexts.test.ts::buildInstanceContext::flattens_over_needs,_and_binds_ONLY_what_is_used
  Scenario: The instance context flattens over needs and binds only used prefixes
    Given base binds dcterms and skos, top binds bibo and fabio
    And two documents use dcterms and one uses bibo
    When the instance context for top is built
    Then the context holds "@version" 1.1, "@protected" true, bibo and dcterms only
    And dcterms is recorded as bound by 2 documents
    And there are no unresolved prefixes and no conflicts
    And the unused skos and fabio are absent

  @test:pipeline/jsonld-contexts.test.ts::buildInstanceContext::an_unresolved_prefix_is_reported,_never_dropped_silently;_a_literal-only_one_is_reported_apart
  Scenario: An unresolved prefix is reported, and a literal-only one is reported apart
    Given documents using oa as an IRI and as a literal, and qou only as a literal, with neither bound by any table
    When the instance context is built
    Then oa is unresolved with positions iri and literal across a.jsonld and b.jsonld
    And qou is reported as literal-only in a.jsonld
    And the context holds only "@version" and "@protected"

  @test:pipeline/jsonld-contexts.test.ts::buildInstanceContext::a_prefix_the_document_binds_itself_is_resolved_and_not_put_in_the_instance_context
  Scenario: A prefix the document binds itself is resolved and left out of the instance context
    Given a document using fhir that binds fhir in its own context
    When the instance context is built
    Then nothing is unresolved
    And fhir is not in the context

  @test:pipeline/jsonld-contexts.test.ts::buildInstanceContext::a_conflict_is_reported_and_the_prefix_is_left_OUT,_not_resolved_by_order
  Scenario: A conflicting prefix is reported and left out
    Given two tables bind dcterms to different IRIs and a document uses dcterms
    When the instance context is built
    Then dcterms is reported as a conflict
    And dcterms is not in the context

  @test:pipeline/jsonld-contexts.test.ts::usedPrefixes_—_inline_full-IRI_terms::an_INLINE_full-IRI_term_speaks_no_prefix_(a_SMART_IG's_generatedAt)
  Scenario: An inline full-IRI term speaks no prefix
    Given a document whose inline context defines generatedAt as a full prov IRI
    When its used prefixes are collected with the prov namespace map
    Then no prefix is used

  @test:pipeline/jsonld-contexts.test.ts::documentUses_—_remote-context_terms::a_key_or_@type_value_that_is_a_remote_term_is_recorded_with_its_context_and_definition,_verbatim
  Scenario: Remote terms used as keys or @type values are recorded with their context and definition verbatim
    Given a document naming the content context with "@type" Section, title, cites and a "dcterms:x" key
    When its uses are read
    Then the recorded terms are Section, cites and title
    And cites is recorded with the content context URL and its definition unchanged

  @test:pipeline/jsonld-contexts.test.ts::documentUses_—_remote-context_terms::a_term_the_document_redefines_inline_is_its_own,_not_the_remote_one
  Scenario: A term the document redefines inline is not recorded as the remote one
    Given a document naming the content context and redefining title inline
    When its uses are read
    Then no term is recorded

  @test:pipeline/jsonld-contexts.test.ts::documentUses_—_remote-context_terms::no_context_named,_no_terms;_a_third-party_context's_terms_are_recorded_with_THAT_context
  Scenario: Terms are recorded only with a named context, and with the context that defines them
    Given a document using title with no @context
    Then no term is recorded
    And a document naming a third-party context and using activity records activity with that third-party context

  @test:pipeline/jsonld-contexts.test.ts::documentUses_—_remote-context_terms::usedPrefixes_is_unchanged_by_the_term_record
  Scenario: The used prefixes match whether or not terms are recorded
    Given a document naming the content context with title and cites "skos:z"
    When its used prefixes and its documented uses are read
    Then both give the same set of prefixes

  @test:pipeline/jsonld-contexts.test.ts::definitionPrefixes::@id,_@type,_@reverse_and_a_scoped_context's_terms;_never_@container_or_a_full_IRI
  Scenario: A definition's prefixes come from @id, @type, @reverse and scoped contexts only
    Given term definitions of several shapes
    Then "dcterms:title" gives dcterms
    And an @id "cito:cites" with "@container" gives only cito
    And @id "x:a" with @type "xsd:integer" gives x and xsd
    And @reverse "prov:used" gives prov
    And a full-IRI @id with a scoped context defining "ch:after" gives ch
    And a full-IRI @id with @type @id gives no prefix

  @test:pipeline/jsonld-contexts.test.ts::buildInstanceContext_—_terms::a_used_term_is_defined_verbatim,_after_the_prefixes,_and_its_definition's_prefixes_are_bound
  Scenario: A used term is defined verbatim after the prefixes, with its definition's prefix bound
    Given the harness table binds dcterms and cito and owns the content context
    And a document uses the cites term
    When the instance context for top is built
    Then the context holds "@version", "@protected", cito and cites in that order, with cites defined verbatim
    And the term cites is recorded for 1 document
    And cito is bound for 1 document
    And the unused title term is absent

  @test:pipeline/jsonld-contexts.test.ts::buildInstanceContext_—_terms::the_copy_is_a_copy:_mutating_the_context_does_not_touch_the_source_definition
  Scenario: The term definition in the context is a copy of the source
    Given an instance context carrying the cites term
    When its cites "@id" is changed
    Then the content context's cites "@id" is still "cito:cites"

  @test:pipeline/jsonld-contexts.test.ts::buildInstanceContext_—_terms::a_term_from_a_context_whose_owner_the_instance_does_not_need_is_reported,_not_carried
  Scenario: A term from a context owned by an instance not needed is reported, not carried
    Given top's tables do not include harness, which owns the content context
    When a document using title is built into top's context
    Then title is not in the context
    And it is reported unresolved because "its context belongs to `harness`, which top does not need"

  @test:pipeline/jsonld-contexts.test.ts::buildInstanceContext_—_terms::a_term_from_a_context_it_does_not_stand_in_for_(third-party)_is_neither_carried_nor_reported
  Scenario: A term from a third-party context is neither carried nor reported
    Given a document using activity from a third-party context with no term source
    When the instance context is built
    Then no term is carried
    And no term is reported unresolved

  @test:pipeline/jsonld-contexts.test.ts::buildInstanceContext_—_terms::a_term_whose_prefix_the_table_binds_to_a_DIFFERENT_IRI_than_its_context_is_reported,_not_silently_re-meant
  Scenario: A term whose prefix the table binds to a different IRI is reported
    Given the harness table binds dcterms to "http://example.org/not-dcterms/"
    When a document using title "dcterms:title" is built
    Then title is not in the context
    And the reason says it means http://purl.org/dc/terms/ in its context but http://example.org/not-dcterms/ in the table

  @test:pipeline/jsonld-contexts.test.ts::buildInstanceContext_—_terms::a_term_whose_prefix_no_table_binds_is_reported
  Scenario: A term whose prefix no table binds is reported
    Given no table binds dcterms
    When a document using title "dcterms:title" is built
    Then the only reason is "its prefix `dcterms` is bound by no instance in the flattened table"

  @test:pipeline/jsonld-contexts.test.ts::buildInstanceContext_—_terms::a_term_defined_two_ways_is_a_conflict,_left_out,_both_definitions_named
  Scenario: A term defined two ways is a conflict, left out, with both definitions named
    Given a.jsonld defines title as "dcterms:title" and b.jsonld as an @id with "@language" "en"
    When the instance context is built
    Then title is not in the context
    And title is a term conflict naming a.jsonld and b.jsonld separately

  @test:pipeline/jsonld-contexts.test.ts::buildInstanceContext_—_terms::the_same_definition_with_keys_in_another_order_is_ONE_definition
  Scenario: The same definition with keys in another order is one definition
    Given two documents define cites with the same keys in different orders
    When the instance context is built
    Then there is no term conflict
    And cites is recorded for 2 documents

  @test:pipeline/jsonld-contexts.test.ts::buildInstanceContext_—_terms::the_same_IRI_spelled_as_a_CURIE_in_one_context_and_in_full_in_another_is_ONE_definition
  Scenario: The same IRI as a CURIE in one context and in full in another is one definition
    Given the content context writes title and cites with CURIEs and a subgraph context writes them as full IRIs, both owned by harness
    When documents using each are built
    Then there is no term conflict
    And cites and title are each recorded for 2 documents

  @test:pipeline/jsonld-contexts.test.ts::buildInstanceContext_—_terms::a_CURIE_whose_prefix_means_another_IRI_is_still_a_conflict
  Scenario: A CURIE whose prefix means another IRI is still a conflict
    Given a.jsonld defines title as "dcterms:title" and b.jsonld, from a subgraph context, as "http://other.example/title"
    When the instance context is built
    Then title is a term conflict

  @test:pipeline/jsonld-contexts.test.ts::buildInstanceContext_—_terms::a_term_sharing_its_name_with_a_bound_prefix_is_a_conflict,_never_resolved_by_order
  Scenario: A term sharing its name with a bound prefix is a conflict
    Given a document that uses the prefix dcterms and also a term named dcterms
    When the instance context is built
    Then the context binds dcterms to its prefix IRI
    And dcterms is reported as a term conflict

  @test:pipeline/jsonld-contexts.test.ts::the_generated_context_stands_in_for_the_remote_one_with_no_triple_lost::same_quads,_and_fewer_without_the_term_definitions
  Scenario: The generated context gives the same quads as the remote one, and fewer without term definitions
    Given a content context with prefixes and title, cites, meta and tags terms, and a document naming it
    When an instance context is built from that document and both versions are expanded to N-Quads
    Then no term is unresolved
    And the original gives 5 quads and the generated context gives the same quads
    And a context of the prefixes alone gives fewer quads
