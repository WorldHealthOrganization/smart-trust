Feature: the folio glossary: its schema, its SKOS, its pages and its extracted terms

  @test:schemas/glossary.test.ts::the_glossary's_route::englishUnderEnTranslationsUnderLocale
  Scenario: the English pages are under `en/`, the translations under their own locale
    When the glossary's routes and page paths are computed
    Then the route is en/folio-assistant-core/glossary and the legacy route folio-assistant-core/glossary
    And the index and layer pages have permalinks and paths under en/
    And the French page is under fr/

  @test:schemas/glossary.test.ts::folio-glossary/v1::authoredTermNeedsDefinition
  Scenario: an authored term needs a definition; without one it is a candidate
    When terms are validated with status authored, with and without a definition, and as candidates
    Then an authored term without a definition is refused
    And an authored term with a definition and a candidate are accepted

  @test:schemas/glossary.test.ts::folio-glossary/v1::couldNotExtractSaysWhy
  Scenario: could-not-extract says why
    When a could-not-extract term is validated with and without a reason
    Then without a reason it is refused, with one it is accepted

  @test:schemas/glossary.test.ts::folio-glossary/v1::matchIriBroaderLocalOrIri
  Scenario: a match is an absolute IRI, and a broader/related reference is a local term or an IRI
    When terms with various exactMatch and broader values are validated
    Then a prefixed exactMatch is refused and an absolute IRI accepted
    And a broader naming an unknown term is refused and a local term accepted

  @test:schemas/glossary.test.ts::folio-glossary/v1::uniqueIdsUnknownKeyRefused
  Scenario: ids are unique, and an unknown key is refused rather than dropped
    When a glossary with two equal terms, and a term with a misspelt key, are validated
    Then both are refused

  @test:schemas/glossary.test.ts::folio-glossary/v1::labelsPerLanguage
  Scenario: labels may be per language
    When a term with English and French labels is validated
    Then it is accepted

  @test:schemas/glossary.test.ts::SKOS::skosSchemeAndConceptIris
  Scenario: the scheme, each concept in it, and the IRIs follow the layer namespace
    When a glossary is rendered as SKOS
    Then the scheme is a skos:ConceptScheme at the layer namespace
    And each concept is inScheme of it

  @test:schemas/glossary.test.ts::SKOS::externalConceptLinkedNotCopied
  Scenario: an external concept is linked, never copied
    When the SKOS is read
    Then the concept's exactMatch links the external IRI
    And no node for the external concept is in the graph

  @test:schemas/glossary.test.ts::SKOS::membersBecomeCollection
  Scenario: members become a skos:Collection of external IRIs
    When the SKOS is read
    Then the scheme's #members node lists the external IRI as skos:member

  @test:schemas/glossary.test.ts::SKOS::localBroaderCandidateNote
  Scenario: a local broader resolves to the local IRI; a candidate says so in skos:note
    When the SKOS is read
    Then term b's broader is the local IRI of a
    And b carries skos:note "candidate"
    And a carries notation "A1"

  @test:schemas/glossary.test.ts::this_repository::everyGlossaryValidates
  Scenario: every glossary document validates, and there is at least one (vacuity guard)
    When every glossary of the repository is collected
    Then none is invalid
    And there is at least one

  @test:schemas/glossary.test.ts::this_repository::swimlaneLedgersAreSource
  Scenario: the harness's swimlane ledgers are a source, read under their new kind
    When the glossaries are collected
    Then the ledgers come from bootstrap and cat-harness

  @test:schemas/glossary.test.ts::this_repository::coreTermsInCoreNamespace
  Scenario: core's terms live in core's namespace
    When core's glossary is found
    Then its namespace is the layer namespace of its declaration
    And that is https://litlfred.github.io/folio-assistant-core/v0/ns/

  @test:schemas/glossary.test.ts::this_repository::everyTermOnceSkosPerScheme
  Scenario: the page lists every term once, and SKOS is published for every scheme
    When the pages are rendered
    Then there is one entry per term with no duplicate ids
    And one SKOS file is written per scheme

  @test:schemas/glossary.test.ts::the_glossary_pages::indexInstanceAndTypePages
  Scenario: there is an index, one page per layer that owns an authored scheme, and one per asset type, and each is an output
    When the glossary pages are rendered
    Then the pages are the index, one per layer with an authored scheme, and one per asset type and letter part
    And each page is also an output at its path

  @test:schemas/glossary.test.ts::the_glossary_pages::everyTermOnceOnItsPage
  Scenario: every term appears exactly once across all the pages, and on the page its scheme belongs to
    When the term ids on every page are collected
    Then no term appears on two pages
    And every term appears, on the page its scheme belongs to
    And there are more terms than asset types

  @test:schemas/glossary.test.ts::the_glossary_pages::pagesHoldOnlyTheirTerms
  Scenario: the index holds no term; each layer's page holds its authored terms only; each type's page holds that type's extracted terms only
    When each page's terms are counted
    Then the index holds no term
    And each layer page holds its authored terms only, with permalink and a link from the index
    And each type's pages hold that type's extracted terms, marked extracted and candidate
    And there is at least one authored term

  @test:schemas/glossary.test.ts::the_glossary_pages::pagesWithinSizeBudget
  Scenario: each page is under its stated size budget, and says so
    When each page's size is measured
    Then every page is within its budget
    And each unsplit page states its size and budget
    And the index budget is at most 64 KB and each type's below 1.4 MB

  @test:schemas/glossary.test.ts::the_glossary_pages::indexAndTypePagesLinked
  Scenario: the index links every per-type page, and each per-type page links back
    When the index and each type page are read
    Then the index links each type page and has children
    And each type page has its permalink, parent Glossary and a link back to the index

  @test:schemas/glossary.test.ts::the_glossary_pages::splitTypeLinksResolve
  Scenario: a split type's term links name the part the target is on, and every one resolves
    When the term links across the parts of each split type are followed
    Then each lands on an entry of the part it names
    And no in-page link points at a term of another part

  @test:schemas/glossary.test.ts::the_glossary_pages::splitTypeCodeLinksToPart
  Scenario: on a split type, a term code links to the PART its target's label falls in
    Given a split type's scheme with terms alpha and zeta
    When a code naming z is linked
    Then the link goes to the t-z part with the term's anchor

  @test:schemas/glossary.test.ts::the_glossary_pages::pagesKeepFilterAndLetters
  Scenario: every page keeps the text filter, and the A–Z bar wherever it lists terms A–Z
    When every page that lists terms is read
    Then it has the text filter
    And where it lists terms A to Z it has the letters bar

  @test:schemas/glossary.test.ts::extracted_KG_terms::eachTypeAboveFloor
  Scenario: each asset type contributes terms, above a floor (a vacuity guard, not an exact count)
    When the extracted terms are counted per asset type
    Then each type reaches its floor

  @test:schemas/glossary.test.ts::extracted_KG_terms::extractedTermsAreSourcedCandidates
  Scenario: every extracted term is a candidate whose source resolves to a file in the repository
    When the extracted terms are read
    Then there are some
    And each is a candidate whose source file exists

  @test:schemas/glossary.test.ts::extracted_KG_terms::anchorNamesElementInFile
  Scenario: an anchored source names an element that is really in that file
    When the extracted terms with an anchored source are checked
    Then there are some
    And each anchor is found in its source file

  @test:schemas/glossary.test.ts::extracted_KG_terms::definitionsVerbatimInAsset
  Scenario: no definition appears that is not verbatim in its asset
    When the definitions of extracted terms are compared with their assets
    Then more than 1000 terms have a definition
    And every definition is verbatim in its asset

  @test:schemas/glossary.test.ts::extracted_KG_terms::dmnNotDefinedByRule
  Scenario: a DMN decision is never defined by one of its rules' descriptions
    When each DMN decision term's definition is compared with its rules' descriptions
    Then there are DMN terms
    And no definition is a rule description

  @test:schemas/glossary.test.ts::extracted_KG_terms::noTwoTermsMintOneIri
  Scenario: no two terms, authored or extracted, mint one IRI
    When every term's IRI is minted
    Then there are more than 2000 IRIs, all distinct
    And no glossary is invalid

  @test:schemas/glossary.test.ts::extracted_KG_terms::extractedIriInHoldersNamespace
  Scenario: an extracted term's IRI is in the namespace of the layer that holds the asset
    When each extracted scheme is compared with the layer holding its assets
    Then its namespace is that layer's namespace
    And each term's source is under that layer's root

  @test:schemas/glossary.test.ts::extracted_KG_terms::rolesAndLanesNotReextracted
  Scenario: roles and lanes are not re-extracted: the swimlane ledger carries them and is linked
    When the extracted terms are compared with the swimlane ledgers
    Then the ledgers carry terms
    And the extracted types are exactly the asset types
    And no term comes from roles.json or from a BPMN lane
    And the index links the swimlane glossary

  @test:schemas/glossary.test.ts::extracted_KG_terms::pagesTellExtractedFromAuthored
  Scenario: the pages tell extracted from authored, and only authored terms reach schema.org
    When all pages are read
    Then the extracted and authored marks count the extracted and authored terms
    And only authored pages carry schema.org JSON-LD, one per page, with the authored terms
    And each page states how many terms it holds

  @test:schemas/glossary.test.ts::extracted_KG_terms::extractedWrittenUnderGenerated
  Scenario: extracted schemes are written under a declared glossary directory's generated/, never over an authored file
    When the output files are listed
    Then there is one generated glossary per extracted scheme, under a declared glossary directory's generated/
    And none overwrites an authored file

  @test:schemas/glossary.test.ts::extracted_KG_terms::authoredNotExtractedPrefix
  Scenario: an authored scheme may not take the extracted prefix
    When the authored schemes are read
    Then none has an id starting with the extracted prefix

  @test:schemas/glossary.test.ts::extraction_helpers::localIdKeepsAtIdApart
  Scenario: a local id keeps `@id` and `id` apart, and always satisfies the schema
    When local ids are made from keys
    Then "@id" and "id" give different local ids
    And every local id satisfies the schema

  @test:schemas/glossary.test.ts::extraction_helpers::xmlDecodingOnce
  Scenario: XML decoding covers the predefined entities and numeric references, once
    When "a &amp;lt; b &#183; &#x41; <![CDATA[c]]>" is decoded
    Then it gives "a &lt; b · A c"

  @test:schemas/glossary.test.ts::every_term_in_the_namespace_of_the_instance_that_owns_its_source::noTwoSchemesOneIri
  Scenario: (a) no two schemes, in any layer, mint one scheme IRI
    When every scheme IRI is minted
    Then there is no collision finding and no duplicate IRI
    And there are more schemes than asset types

  @test:schemas/glossary.test.ts::every_term_in_the_namespace_of_the_instance_that_owns_its_source::noTwoInstancesOneNamespace
  Scenario: (b) no two layers resolve to one namespace
    When each layer's namespace is resolved
    Then there is more than one and none repeats

  @test:schemas/glossary.test.ts::every_term_in_the_namespace_of_the_instance_that_owns_its_source::termMintedInOwnersNamespace
  Scenario: (c) every term with a repository source is minted in the namespace of the layer whose root holds it, authored and extracted alike
    When every term with a repository source is checked against the layer holding it
    Then more than 1000 terms and at least one authored term are checked
    And every IRI is in its owner's namespace

  @test:schemas/glossary.test.ts::every_term_in_the_namespace_of_the_instance_that_owns_its_source::multiInstanceSchemeRefused
  Scenario: an authored scheme sourced in several layers with no defining source is refused, not guessed
    Given an authored scheme whose terms are sourced in two layers
    When its owner is resolved
    Then with no defining source it is an error
    And with a defining source, or one term, the owner is cat-harness-tools
    And with no terms the owner is folio-assistant-core
    And paths and IRIs are resolved to owners and repository paths as expected

  @test:schemas/glossary.test.ts::an_ordered_glossary_(owner,_2026-09-29:_logical,_not_alphabetical)::requiresOnlyEarlierTerms
  Scenario: a term may require only earlier terms of its own glossary, never itself
    When ordered glossaries with various requires are validated
    Then a term requiring an earlier term is accepted
    And a forward, self or missing requirement is refused
    And an unordered glossary allows a forward requirement

  @test:schemas/glossary.test.ts::an_ordered_glossary_(owner,_2026-09-29:_logical,_not_alphabetical)::skosOrderedCollection
  Scenario: the SKOS carries the order as an OrderedCollection, and each requires as dcterms:requires
    Given an ordered glossary where b requires a
    When it is rendered as SKOS
    Then an OrderedCollection lists a then b
    And b has dcterms:requires a

  @test:schemas/glossary.test.ts::an_ordered_glossary_(owner,_2026-09-29:_logical,_not_alphabetical)::bootstrapTermsOrderedFromSchema
  Scenario: bootstrap's terms are one ordered, authored scheme, read from its schema in the schema's order
    When bootstrap's ordered scheme is found
    Then it is read from bootstrap/schemas/graph.schema.json
    And every term is authored
    And the labels follow the schema's $defs order

  @test:schemas/glossary.test.ts::a_description_naming_another_term_links_to_it_(bean_qgjh)::inPageLinksLand
  Scenario: every in-page term link lands on an entry of the same page
    When every in-page term link is followed
    Then each lands on an entry of the same page

  @test:schemas/glossary.test.ts::a_description_naming_another_term_links_to_it_(bean_qgjh)::onlySameSchemeIdLinks
  Scenario: only an exact id of the SAME scheme links, and never the term itself
    Given a scheme with terms a and b
    When the codes a, b and c in a's description are linked
    Then only b is linked

  @test:schemas/glossary.test.ts::D4:_a_glossary's_licence_comes_from_the_licence-naming_row_(bean_gzkt)::licenceAsDctermsLicense
  Scenario: written as dcterms:license, the row a library item's licence uses too
    When the licence terms for CC0-1.0 are made
    Then they are dcterms:license "CC0-1.0"

  @test:schemas/glossary.test.ts::D4:_a_glossary's_licence_comes_from_the_licence-naming_row_(bean_gzkt)::noLicenceNothingWritten
  Scenario: no licence: nothing written
    When the licence terms for no licence are made
    Then nothing is written

  @test:schemas/glossary.test.ts::scoped_fixed_terms:_subject_area_and_translation_status_(owner,_2026-11-07)::subjectOverridesScheme
  Scenario: A scheme and a term may name a subject area; a term's overrides its scheme's
    Given a glossary scheme with subject "harness-vocabulary" and a term with subject "process-modelling"
    Then a term without a subject takes the scheme's
    And a term with one keeps its own
    And with neither, there is no subject

  @test:schemas/glossary.test.ts::scoped_fixed_terms:_subject_area_and_translation_status_(owner,_2026-11-07)::subjectIsLocalId
  Scenario: A subject area is a local id, not prose
    Given a glossary whose subject is "Harness vocabulary"
    Then it does not parse

  @test:schemas/glossary.test.ts::scoped_fixed_terms:_subject_area_and_translation_status_(owner,_2026-11-07)::translationStatusPerLocale
  Scenario: Translation status is official or unofficial per locale, and unofficial when absent
    Given a term whose translation status for fr is official
    Then its status for fr is official and for zh unofficial
    And a status of "signed" does not parse

  @test:schemas/glossary.test.ts::scoped_fixed_terms:_subject_area_and_translation_status_(owner,_2026-11-07)::fixedTranslationFromCatalogue
  Scenario: A fixed translation is derived from the catalogue: authored, non-empty, not fuzzy
    Given an authored term and a candidate term
    Then a non-empty, non-fuzzy translation of the authored term is fixed
    And an empty, missing or fuzzy translation is not
    And no translation of a candidate term is fixed

  @test:schemas/glossary.test.ts::scoped_fixed_terms:_subject_area_and_translation_status_(owner,_2026-11-07)::subjectPublishedAsDctermsSubject
  Scenario: The subject is published as dcterms:subject on the scheme and on an overriding term
    When the glossary is rendered as SKOS
    Then the ConceptScheme carries dcterms:subject "harness-vocabulary"
    And the term that overrides it carries "process-modelling"
    And a term that does not override it carries none

  @test:schemas/glossary.test.ts::a_schema's_terms_take_the_subject_area_the_schema_publishes_(owner,_2026-11-07:_"do_it_in_the_schema")::subjectReadFromSchema
  Scenario: A schema's terms take the subject the schema publishes
    Given a graph schema that publishes subject "harness-vocabulary"
    When its terms are read
    Then the scheme's subject is "harness-vocabulary"
    And the scheme is a valid glossary

  @test:schemas/glossary.test.ts::a_schema's_terms_take_the_subject_area_the_schema_publishes_(owner,_2026-11-07:_"do_it_in_the_schema")::noSchemaSubjectNoSchemeSubject
  Scenario: A schema that publishes no subject leaves the scheme without one
    Given a graph schema with no subject
    When its terms are read
    Then the scheme has no subject
