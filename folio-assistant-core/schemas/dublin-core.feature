Feature: a Dublin Core record projected to JSON-LD

  @test:schemas/dublin-core.test.ts::the_duplicated_DCTERMS_namespace_stays_in_step_with_the_platform's::dctermsNsMatchesPlatform
  Scenario: is byte-identical to `cat-harness-tools/schemas/kg/jsonld.ts`
    When cat-harness-tools/schemas/kg/jsonld.ts is read
    Then it exports a DCTERMS_NS equal to this module's

  @test:schemas/dublin-core.test.ts::dcPredicate_keeps_the_three_identifier_systems_apart::identifierUriGovdocApart
  Scenario: does NOT collapse `identifier.uri` and `identifier.govdoc` onto one predicate
    When predicates are made for dc.identifier.uri and dc.identifier.govdoc
    Then they differ, each minted in the DSpace namespace

  @test:schemas/dublin-core.test.ts::dcPredicate_keeps_the_three_identifier_systems_apart::bareElementToDcElements
  Scenario: maps a BARE simple element onto the DCMI elements namespace, where the mapping is exact
    When predicates are made for bare dc title and description
    Then they are in the DCMI elements namespace

  @test:schemas/dublin-core.test.ts::dcPredicate_keeps_the_three_identifier_systems_apart::qualifierIsMintedRefinement
  Scenario: a qualifier on a simple element is a refinement, so it is minted rather than flattened
    When a predicate is made for dc.description.abstract
    Then it is minted as dspace dc.description.abstract

  @test:schemas/dublin-core.test.ts::dcPredicate_keeps_the_three_identifier_systems_apart::mintsForNonDcSchema
  Scenario: mints for a schema prefix that is not `dc`
    When a predicate is made for local.title
    Then it is minted as dspace local.title

  @test:schemas/dublin-core.test.ts::dcPredicate_keeps_the_three_identifier_systems_apart::mintsForElementOutsideFifteen
  Scenario: mints for an element outside the fifteen
    When a predicate is made for dc.provenance
    Then it is minted as dspace dc.provenance

  @test:schemas/dublin-core.test.ts::the_projection_round-trips_the_record's_repetition::keepsBothIdentifierUris
  Scenario: keeps BOTH `dc.identifier.uri` values — the legacy host is not deduplicated
    When the projected record's dc.identifier.uri values are listed
    Then both the legacy and the current Handle URI are kept

  @test:schemas/dublin-core.test.ts::the_projection_round-trips_the_record's_repetition::preservesSourceOrder
  Scenario: preserves SOURCE ORDER, which a plain array would discard
    When the projected record's dc.identifier.uri values are listed
    Then the iris.wpro.who.int value comes first and the iris.who.int value second

  @test:schemas/dublin-core.test.ts::the_projection_round-trips_the_record's_repetition::keepsBothMeshSubjects
  Scenario: keeps BOTH `dc.subject.mesh` values, with their language tags and authority
    When the projected record's dc.subject.mesh values are listed
    Then both are controlled values with English language tags and the MeSH authority

  @test:schemas/dublin-core.test.ts::the_projection_round-trips_the_record's_repetition::keepsRepeatedDates
  Scenario: keeps both repeated dates
    When the projected record's accessioned and available dates are listed
    Then each has two values

  @test:schemas/dublin-core.test.ts::an_absent_language_tag_stays_absent::emitsLanguageWhereAsserted
  Scenario: emits `@language` where the record asserts one
    When the projected title is read
    Then it carries @language "en"

  @test:schemas/dublin-core.test.ts::an_absent_language_tag_stays_absent::noDefaultLanguage
  Scenario: emits NO `@language` where the record asserts none — never defaulting to `en` (R4)
    When the projected author is read
    Then it has only @value and no @language

  @test:schemas/dublin-core.test.ts::an_absent_language_tag_stays_absent::bothLanguageStatesInOneRecord
  Scenario: both states occur in the ONE record, which is why the distinction is load-bearing
    When the title and the issued date of one record are read
    Then the title has @language and the date does not

  @test:schemas/dublin-core.test.ts::two_`DcField`_entries_with_one_qualified_name_merge_rather_than_colliding::sameNameFieldsMerge
  Scenario: joins their values in source order under a single predicate
    Given a record with two dc.identifier.uri fields, "first" and "second"
    When it is projected
    Then both values appear in source order under one predicate

  @test:schemas/dublin-core.test.ts::`@id`_is_the_repository's_own_key,_and_the_Handle_judgement_stays_in_the_skill::idMintedFromRecordId
  Scenario: mints from `rec.id` by default
    When the record is projected with no id option
    Then its @id is minted from the record's id under dspace item/

  @test:schemas/dublin-core.test.ts::`@id`_is_the_repository's_own_key,_and_the_Handle_judgement_stays_in_the_skill::callerMaySetHandleId
  Scenario: lets a caller that wants Handle-keyed nodes say so, and own it
    When the record is projected with a Handle as id
    Then its @id is that Handle

  @test:schemas/dublin-core.test.ts::`@id`_is_the_repository's_own_key,_and_the_Handle_judgement_stays_in_the_skill::carriesTypeAndProvenance
  Scenario: carries the item type and its provenance
    When the record is projected
    Then its @type is dspace Item
    And its provenance carries the record's source, retrievedAt and method

  @test:schemas/dublin-core.test.ts::the_context_defines_every_prefix_the_projection_actually_emits::contextBindsPrefixes
  Scenario: binds dc, dcterms, dspace and rdf
    When the context is read
    Then dc, dcterms, dspace and rdf are bound to their namespaces

  @test:schemas/dublin-core.test.ts::the_context_defines_every_prefix_the_projection_actually_emits::everyPredicateUnderBoundPrefix
  Scenario: every predicate of every real record expands under a bound prefix
    Given three real records
    When each field's predicate is made
    Then every predicate starts with a namespace bound in the context

  @test:schemas/dublin-core.test.ts::a_DSpace_locale_becomes_a_BCP_47_tag::dspaceLocaleToBcp47
  Scenario: renders `en_US` as `en-US`, which N-Quads and xml:lang accept
    When bcp47 is applied
    Then "en_US" becomes "en-US" and "en" stays "en"
