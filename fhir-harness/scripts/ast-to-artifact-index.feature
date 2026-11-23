Feature: Building the FHIR artifact index from an IG AST

  @test:scripts/ast-to-artifact-index.test.ts::astToArtifactIndex::validatesWithTypeIdKeys
  Scenario: validates, and every key is Type/id even where the manifest keyed url|version
    Given the artifact index built from a synthetic AST
    Then it validates and nothing is unreadable
    And its keys are "CodeSystem/Colours", "Endpoint/ep-1", "ImplementationGuide/example.ig" and "StructureDefinition/Cat"

  @test:scripts/ast-to-artifact-index.test.ts::astToArtifactIndex::identityFromIgSourceFromBuild
  Scenario: takes identity from the IG resource, and the source from the build
    Given the artifact index built from a synthetic AST
    Then its package id is "example.ig" at version "1.0.0" with the IG's canonical base
    And its source is the output AST at the build's revision, read on 2026-10-01

  @test:scripts/ast-to-artifact-index.test.ts::astToArtifactIndex::artefactsAreCompiledCopies
  Scenario: every artefact is a compiled copy carrying the manifest's inputs
    Given the artifact index built from a synthetic AST
    Then every artefact is materialized, compiled, and carries the build's source revision

  @test:scripts/ast-to-artifact-index.test.ts::astToArtifactIndex::endpointTitledById
  Scenario: an Endpoint is titled by its id, and its free-text name becomes the description
    Given the artifact index built from a synthetic AST
    Then the Endpoint "ep-1" is titled "ep-1", its free-text name is its description, and it has no name

  @test:scripts/ast-to-artifact-index.test.ts::astToArtifactIndex::publishedUrlsFromPublishedBase
  Scenario: published URLs come from --published-base, never from the canonical
    Given the artifact index built with a published base
    Then the code system's published page is under the published base
    And the ImplementationGuide has no published page and no category

  @test:scripts/ast-to-artifact-index.test.ts::astToArtifactIndex::ownSiteLinksTheArtefactPage
  Scenario: on the harness's own site, the page is under artifact/ and the root holds only the JSON
    Given the artifact index built with a published base whose layout is the harness's own site
    Then the code system's JSON is at the root of the base and its page is artifact/CodeSystem-Colours.html
    And the ImplementationGuide also gets a page under artifact/

  @test:scripts/ast-to-artifact-index.test.ts::astToArtifactIndex::unpublishedArtefactGetsNoLink
  Scenario: an artefact the published IG does not have yet gets no published link
    Given a published IG that has only the code system
    When the index is built with that published base
    Then the code system links to its published page
    And the Endpoint has no published representation and no upstream provenance

  @test:scripts/ast-to-artifact-index.test.ts::astToArtifactIndex::noPublishedBaseNoClaim
  Scenario: no published base → no published representation claimed
    When the index is built with no published base
    Then no artefact claims a published representation

  @test:scripts/ast-to-artifact-index.test.ts::astToArtifactIndex::noRevisionNotMaterialized
  Scenario: an AST that records no source revision is not claimed as materialized
    Given an AST that records no source revision
    When the index is built
    Then every artefact's materialization is "unknown" with a note

  @test:scripts/ast-to-artifact-index.test.ts::withCrossVersionFields::basicReadsCrossVersionFields
  Scenario: an R5 type written as an R4 Basic reads its fields back from its own extensions
    Given an R5 ActorDefinition written as an R4 Basic with cross-version extensions
    When its fields are read back as an ActorDefinition
    Then it has the ActorDefinition type, url, title and description
    And its Publisher category is "Requirements: Actor Definitions"

  @test:scripts/ast-to-artifact-index.test.ts::withCrossVersionFields::sameTypeReturnedAsIs
  Scenario: a resource already of the manifest's type is returned as is
    Given a CodeSystem
    When its cross-version fields are read as a CodeSystem
    Then the same object is returned

  @test:scripts/ast-to-artifact-index.test.ts::publisherCategory::publisherDefaultGrouping
  Scenario: the Publisher's default grouping
    Then a logical model is "Structures: Logical Models"
    And an extension definition is "Structures: Extension Definitions"
    And a resource profile is "Structures: Resource Profiles"
    And an ActorDefinition is "Requirements: Actor Definitions" and an Endpoint is "Other"
    And an ImplementationGuide has no category

  @test:scripts/ast-to-artifact-index.test.ts::compareIndexes::whitespaceAndLinksEquivalent
  Scenario: whitespace and Markdown links are equivalent, not different
    Then reader text drops a Markdown link's target and collapses double spaces
    Given a published index whose description differs from the AST only by a link and spacing
    When the indexes are compared
    Then nothing differs and one description is equivalent

  @test:scripts/ast-to-artifact-index.test.ts::compareIndexes::missingFieldIsAstRicher
  Scenario: a field the published index lacks is the AST being richer
    Given a published index whose Endpoint has no description
    When the indexes are compared
    Then one description is counted as the AST being richer and nothing differs

  @test:scripts/ast-to-artifact-index.test.ts::compareIndexes::reportsChangeAdditionRemoval
  Scenario: a real change, an addition and a removal are all reported
    Given a published index that retitles Cat as "Dog", lacks the Endpoint and adds "CodeSystem/Gone"
    When the indexes are compared
    Then the title of Cat is reported as differing from "Cat" to "Dog"
    And the Endpoint is only in the AST and "CodeSystem/Gone" only in the published index

  @test:scripts/ast-to-artifact-index.test.ts::a_resource_whose_`name`_is_not_a_string_(bean_c65n)::patientIndexedUnderId
  Scenario: an example Patient (name is HumanName[]) is indexed under its id, not a crash
    Given an AST holding an example Patient whose name is a list of HumanNames
    When the index is built
    Then nothing is unreadable
    And the Patient is titled "child-1" with no description and no name

  @test:scripts/ast-to-artifact-index.test.ts::attachSidecars::attachSidecarsBindsByTypeId
  Scenario: binds by <Type>-<id>, serves from the local prefix, and records what binds to nothing
    Given the index and a directory of sidecars
    When the sidecars are attached with a local prefix
    Then the index still validates and 3 sidecars are attached
    And the code system's JSON-LD and displays are served from the local prefix
    And the Cat structure has a schema sidecar with bytes
    And the sidecar API is "present" and "LogicalModels.schema.json" is recorded as unbound

  @test:scripts/ast-to-artifact-index.test.ts::attachSidecars::titleStemBindsWithPublishedUrl
  Scenario: a title stem binds where neither the id nor the name does, and a published base becomes the url
    Given the Cat structure renamed "C4" and titled "Cat: the record", and a schema sidecar named by the title stem
    When the sidecars are attached with a published base
    Then 1 sidecar is attached
    And the schema sidecar has the published url, the local path and 2 bytes

  @test:scripts/ast-to-artifact-index.test.ts::attachSidecars::noSidecarsCannotTell
  Scenario: no sidecars leaves the index saying it cannot tell
    Given an empty sidecar directory
    When the sidecars are attached
    Then nothing is attached or unbound
    And the sidecar API is "unknown" and no unbound list is recorded

  @test:scripts/ast-to-artifact-index.test.ts::keepPublishedGrouping::publishedGroupingWins
  Scenario: the published grouping wins where the published index holds the key; the default stays elsewhere
    Given a published index that groups the code system as "Terminology: Colour schemes" at position 3 and lacks the Cat structure
    When the published grouping is kept
    Then 2 artefacts take the published grouping
    And the code system has the published category and position
    And the Cat structure keeps the default "Structures: Logical Models"
    And the index validates

  @test:scripts/ast-to-artifact-index.test.ts::what_an_instance_states:_profilesOf_and_conceptOf_(owner,_2026-10-12)::profilesOfAsWritten
  Scenario: meta.profile as written, or nothing
    Then meta.profile is returned without empty entries
    And a resource with no meta, or a profile that is not a list, has no profiles

  @test:scripts/ast-to-artifact-index.test.ts::what_an_instance_states:_profilesOf_and_conceptOf_(owner,_2026-10-12)::conceptKeepsTextAndCodings
  Scenario: a CodeableConcept keeps its text and codings, and invents no display
    Then a CodeableConcept with codings is returned with those codings
    And a CodeableConcept with only text is returned with that text

  @test:scripts/ast-to-artifact-index.test.ts::what_an_instance_states:_profilesOf_and_conceptOf_(owner,_2026-10-12)::codingListIsConcept
  Scenario: a Coding list (Questionnaire.code) is its codings; a string code (SearchParameter's) is no concept
    Then a list of Codings becomes a concept with those codings
    And a string code or an empty object is no concept

  @test:scripts/ast-to-artifact-index.test.ts::what_an_instance_states:_profilesOf_and_conceptOf_(owner,_2026-10-12)::indexCarriesProfilesAndCode
  Scenario: the index carries them for the artefact that states them
    Given an AST holding a Basic resource with a profile and a code
    When the index is built
    Then the artefact carries that profile and that code

  @test:scripts/ast-to-artifact-index.test.ts::attachSidecars::servedBaseRecordedAsSidecarBase
  Scenario: a served base is recorded as the index's sidecarBase when something binds
    Given the index and a directory of sidecars
    When the sidecars are attached with a served base under the AST cache commit
    Then the index records the base without its trailing slash, and each sidecar keeps its local path
    And an index to which nothing binds records no base

  @test:scripts/ast-to-artifact-index.test.ts::attachSidecars::emptyAstPathRecordsTreePaths
  Scenario: an empty AST path records each resource at its path in the AST's own tree
    Given the synthetic AST
    When it is indexed with the AST path ""
    Then the index validates, its source is ".", and every local path starts with resources/
