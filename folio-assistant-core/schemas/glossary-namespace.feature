Feature: a layer's namespace document carries its glossary concepts

  @test:schemas/glossary-namespace.test.ts::glossaryConceptNodes::one_entry_per_scheme_and_per_concept_minted_in_the_namespace
  Scenario: one entry per scheme and per concept minted in the namespace
    Given a scheme with two terms minted in the namespace
    When its concept entries are built
    Then there is one entry for the scheme and one for each term, linking its SKOS and term page

  @test:schemas/glossary-namespace.test.ts::glossaryConceptNodes::a_term_naming_its_own_IRI_elsewhere_is_not_this_namespace's_to_serve
  Scenario: a term naming its own IRI elsewhere is not this namespace's to serve
    Given a term whose concept IRI is another namespace's
    When the concept entries are built
    Then it has no entry

  @test:schemas/glossary-namespace.test.ts::namespaceDocument::the_concepts_alone,_as_a_document_whose_@id_is_the_namespace
  Scenario: the concepts alone make a document whose @id is the namespace
    Given no vocabulary for the layer
    When the namespace document is built
    Then its @id is the namespace and its graph is the concepts

  @test:schemas/glossary-namespace.test.ts::namespaceDocument::added_to_the_layer's_vocabulary,_keeping_its_entries_and_its_own_spelling_of_one_already_held
  Scenario: the concepts are added to the layer's vocabulary
    Given the layer's vocabulary, which already holds one of the concepts
    When the namespace document is built
    Then the vocabulary's entries are kept as they are and the other concepts are added

  @test:schemas/glossary-namespace.test.ts::namespaceDocument::a_vocabulary_for_another_namespace_is_refused
  Scenario: a vocabulary for another namespace is refused
    Given a vocabulary whose @id is another namespace
    When the namespace document is built
    Then it throws

  @test:schemas/glossary-namespace.test.ts::namespaceHtml::one_anchor_per_concept:_its_IRI_with_the_namespace_taken_off
  Scenario: one anchor per concept
    Given a namespace document
    When its page is rendered
    Then each entry's anchor is its IRI with the namespace taken off

  @test:schemas/glossary-namespace.test.ts::namespaceHtml::escapes_what_it_prints,_links_a_term_page,_and_embeds_the_document
  Scenario: the page escapes its text, links term pages and embeds the document
    Given a definition holding markup and a term with a page
    When the page is rendered
    Then the markup is escaped, the term page is linked and the JSON-LD is embedded

  @test:schemas/glossary-namespace.test.ts::namespaceHtml::anchorIn:_only_an_IRI_inside_the_namespace_has_one
  Scenario: only an IRI inside the namespace has an anchor
    Given IRIs inside, equal to and outside the namespace
    When each one's anchor is taken
    Then only the one inside has one

  @test:schemas/glossary-namespace.test.ts::namespacePaths::a_slash_namespace_under_the_site_is_its_directory's_index
  Scenario: a slash namespace is served as its directory's index
    Given a namespace under the site's iriBase
    When its paths are computed
    Then they are index.html, index.jsonld and index.json in its directory

  @test:schemas/glossary-namespace.test.ts::namespacePaths::a_hash_namespace_is_served_from_the_same_directory
  Scenario: a hash namespace is served from the same directory
    Given a hash namespace under the site's iriBase
    When its paths are computed
    Then the page is the same directory's index.html

  @test:schemas/glossary-namespace.test.ts::namespacePaths::a_namespace_another_site_serves_is_not_this_site's
  Scenario: a namespace another site serves is not this site's
    Given a namespace under another iriBase, and the site root itself
    When their paths are computed
    Then there are none

  @test:schemas/glossary-namespace.test.ts::resourcePages::a_page_at_<path>/index.html_for_every_IRI_minted_in_the_namespace,_and_none_outside_it
  Scenario: a page at every IRI minted in the namespace
    Given a SKOS document minting a scheme, a concept and their fragments, and naming an outside concept
    When the resource pages are built
    Then there is a <path>/index.html for the scheme and the concept, and none for the outside concept

  @test:schemas/glossary-namespace.test.ts::resourcePages::a_fragment_IRI_is_a_section_of_its_document's_page,_with_the_fragment_as_its_id
  Scenario: a fragment IRI is a section of its document's page
    Given a label IRI and an order IRI with fragments
    When the resource pages are built
    Then each is a section whose id is its fragment

  @test:schemas/glossary-namespace.test.ts::resourcePages::a_concept's_page_shows_each_language's_label,_its_definition,_scope_note_and_matches,_and_links_back_to_the_glossary
  Scenario: a concept's page is a real term page
    Given a concept with labels in two languages, a definition, a scope note and matches
    When its page is rendered
    Then it shows each of them, links matches, links inside the site relatively and links back to the glossary

  @test:schemas/glossary-namespace.test.ts::resourcePages::servedPath:_the_directory_and_fragment_a_static_host_serves_an_IRI_from
  Scenario: where a static host serves an IRI from
    Given IRIs with and without a fragment, outside the site and equal to it
    When each one's served path is taken
    Then it is the directory and fragment inside the site, and none otherwise
