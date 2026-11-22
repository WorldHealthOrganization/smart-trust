Feature: DAK block authoring
  The DAK block kinds' builders, builder names, label prefixes, JSON-LD types,
  discovery and adapter ownership, their coverage of WHO's DAK components, and
  how they reach a folio through the registry smart-base's contribution fills.

  @test:smart-base/schemas/dak-blocks.test.ts::builders::decisionTableBuilderDerivesL2
  Scenario: construct a valid decision table and derive its layer
    When a decision table "dt:anc-danger-signs" is built
    Then its kind is "decision-table" and its layer "L2"

  @test:smart-base/schemas/dak-blocks.test.ts::builders::l3KindsDeriveL3
  Scenario: L3 kinds derive L3
    Then a value set and a plan definition are built with layer "L3"

  @test:smart-base/schemas/dak-blocks.test.ts::builders::layerForKindPartitionsKinds
  Scenario: layerForKind partitions every DAK kind
    Then every DAK kind's layer is "L2" or "L3"

  @test:smart-base/schemas/dak-blocks.test.ts::builders::rejectsWrongLabelPrefix
  Scenario: a wrong label prefix is rejected at construction
    Then building a decision table labelled "def:not-a-decision-table" throws
    And building a value set labelled "dt:wrong-prefix" throws

  @test:smart-base/schemas/dak-blocks.test.ts::builders::keepsEditorialFields
  Scenario: editorial fields are the same fields a paper block uses
    When a business process is built with uses, tags and realises
    Then it keeps uses ["de:patient-id"] and realises "dt:anc-danger-signs"

  @test:smart-base/schemas/dak-blocks.test.ts::builders::keepsAuthorStatedLayer
  Scenario: an author-stated layer is not overwritten
    When a decision table is built with layer "L3"
    Then its layer is "L3"

  @test:smart-base/schemas/dak-blocks.test.ts::builder_↔_kind_mapping::builderNamesAreIdentifiers
  Scenario: every DAK kind has a builder name that is a valid identifier
    Then every DAK kind has a builder name of letters and digits starting with a letter

  @test:smart-base/schemas/dak-blocks.test.ts::builder_↔_kind_mapping::builderNamesRoundTripToKind
  Scenario: builder names round-trip back to their kind, through the contribution
    Then every DAK builder name maps back to its kind through the contributed builders

  @test:smart-base/schemas/dak-blocks.test.ts::builder_↔_kind_mapping::coreUnawareOfDakBuilders
  Scenario: core does not know a DAK builder without the contribution
    Then without the contributed builders, no DAK builder name that is not a paper kind maps to a kind

  @test:smart-base/schemas/dak-blocks.test.ts::builder_↔_kind_mapping::paperBuildersMapToThemselves
  Scenario: paper builders still map to themselves
    Then every paper block kind maps to itself through the contributed builders

  @test:smart-base/schemas/dak-blocks.test.ts::builder_↔_kind_mapping::builderNamesUnique
  Scenario: builder names are unique across both adapters
    Then the paper kinds and the DAK builder names hold no duplicate

  @test:smart-base/schemas/dak-blocks.test.ts::builder_↔_kind_mapping::unknownBuilderMapsToUndefined
  Scenario: an unknown builder maps to undefined
    Then "notABuilder" maps to no kind

  @test:smart-base/schemas/dak-blocks.test.ts::label_prefixes::dakPrefixesAvoidPaperPrefixes
  Scenario: DAK prefixes do not collide with paper or structural prefixes
    Then no DAK label prefix is a paper or structural prefix such as "def", "thm" or "sec"

  @test:smart-base/schemas/dak-blocks.test.ts::label_prefixes::dakPrefixesUnique
  Scenario: DAK prefixes are unique among themselves
    Then the DAK label prefixes hold no duplicate

  @test:smart-base/schemas/dak-blocks.test.ts::label_prefixes::corePrefixListsInSync
  Scenario: core's two built-in prefix lists stay in sync
    Then asserting the known label prefixes in sync does not throw

  @test:smart-base/schemas/dak-blocks.test.ts::label_prefixes::dakPrefixesOnlyContributed
  Scenario: every DAK prefix reaches core through the contribution, and none is built in
    Then every DAK label prefix is among the contributed label prefixes
    And none is among core's known label prefixes

  @test:smart-base/schemas/dak-blocks.test.ts::JSON-LD_typing::dakKindsTypedThroughContribution
  Scenario: every DAK kind has a folio type, which core reads from the contribution
    Then every DAK kind has a folio type
    And it has at least one type through the registry, and none without it

  @test:smart-base/schemas/dak-blocks.test.ts::JSON-LD_typing::valueSetTypedNotFhir
  Scenario: a value-set block is typed folio:, not fhir:
    Then the types of "value-set" through the registry are exactly "smart-base:ValueSet"

  @test:smart-base/schemas/dak-blocks.test.ts::JSON-LD_typing::docoCoTypingSparing
  Scenario: DoCO co-typing stays sparing
    Then "decision-table" is typed "smart-base:DecisionTable" and "doco:Table"
    And "persona" is typed only "smart-base:Persona"

  @test:smart-base/schemas/dak-blocks.test.ts::JSON-LD_typing::paperTypingUnchanged
  Scenario: paper typing is unchanged, with or without the registry
    Then "theorem" is typed "folio-assistant-sci:Theorem" and "doco:Section", with or without the registry

  @test:smart-base/schemas/dak-blocks.test.ts::discovery::discoversDakManifestByKind
  Scenario: a DAK manifest is discovered under its KIND, not its builder name
    Given a manifest exporting decisionTable "dt:anc-danger-signs"
    When it is read with the contributed builders
    Then it is kind "decision-table" with that label

  @test:smart-base/schemas/dak-blocks.test.ts::discovery::discoversMultiWordL3Kind
  Scenario: a multi-word L3 kind too
    Given a manifest exporting valueSet "vs:danger-signs"
    When it is read with the contributed builders
    Then its kind is "value-set"

  @test:smart-base/schemas/dak-blocks.test.ts::discovery::noDiscoveryWithoutContribution
  Scenario: without the contribution, core does not discover a DAK manifest
    When the decision-table manifest is read without the contributed builders
    Then nothing is read

  @test:smart-base/schemas/dak-blocks.test.ts::discovery::paperManifestsUnaffected
  Scenario: paper manifests are unaffected, with or without the contribution
    Given a manifest exporting theorem "thm:main"
    Then it is read as kind "theorem" with that label, with or without the contributed builders

  @test:smart-base/schemas/dak-blocks.test.ts::discovery::discoveredKindResolvesToDakAdapter
  Scenario: a discovered DAK kind resolves to the dak adapter, through the registry
    Given the discovered decision-table manifest
    Then core alone gives its kind no adapter
    And its composed owner through the registry is "dak"

  @test:smart-base/schemas/dak-blocks.test.ts::discovery::everyDakKindOwnedByDakAdapter
  Scenario: every DAK kind is owned by the dak adapter once registered
    Then every DAK kind's composed owner through the registry is "dak"

  @test:smart-base/schemas/dak-blocks.test.ts::the_union_stays_partitioned::dakBlockKindNotPaperKind
  Scenario: a DakBlock kind is never a paper BLOCK_KINDS member
    Then a built decision table's kind is not a paper block kind

  @test:smart-base/schemas/dak-blocks.test.ts::WHO_DAK_component_coverage::componentCountEndsWithTestScenarios
  Scenario: there are nine components, ending with the one added later
    Then there are 10 DAK components
    And the first is "health-interventions-and-recommendations" and the last "test-scenarios"

  @test:smart-base/schemas/dak-blocks.test.ts::WHO_DAK_component_coverage::everyComponentDescribed
  Scenario: every component is described
    Then every component's description is longer than 20 characters

  @test:smart-base/schemas/dak-blocks.test.ts::WHO_DAK_component_coverage::everyKindInExactlyOneComponent
  Scenario: every DAK kind belongs to exactly one component
    Then no DAK kind is in no component
    And no DAK kind is in two components

  @test:smart-base/schemas/dak-blocks.test.ts::WHO_DAK_component_coverage::everyComponentNamesAKind
  Scenario: every component now names at least one kind
    Then no component has an empty kind list

  @test:smart-base/schemas/dak-blocks.test.ts::WHO_DAK_component_coverage::noComponentWithoutL2Kind
  Scenario: no component is left without an L2 kind
    Then the components without an L2 kind are none

  @test:smart-base/schemas/dak-blocks.test.ts::WHO_DAK_component_coverage::testScenariosAtBothLayers
  Scenario: test-scenarios is represented at both layers, and they are distinct
    Then the test-scenarios component's kinds are "test-scenario" and "test-case"
    And "test-scenario" is L2 and "test-case" is L3

  @test:smart-base/schemas/dak-blocks.test.ts::WHO_DAK_component_coverage::requirementsComponentHasTwoKinds
  Scenario: the requirements component is one component and two kinds
    Then the functional-and-non-functional-requirements component's kinds are "functional-requirement" and "non-functional-requirement"

  @test:smart-base/schemas/dak-blocks.test.ts::the_component_list_against_WHO's_own_logical_model::reportsDakFshAvailability
  Scenario: smart-base availability is reported, not assumed
    Given WHO's DAK.fsh is looked for under SMART_BASE_HOME
    Then whether it is available is a boolean, and a warning is printed when it is not

  @test:smart-base/schemas/dak-blocks.test.ts::the_component_list_against_WHO's_own_logical_model::componentFieldsExistInDakFsh
  Scenario: every component field exists in WHO's DAK.fsh
    Given WHO's DAK.fsh is available (otherwise the test is skipped)
    Then it declares 9 component Source fields
    And every formalized component's field is among them

  @test:smart-base/schemas/dak-blocks.test.ts::the_component_list_against_WHO's_own_logical_model::noUnlistedWhoComponent
  Scenario: WHO declares no component this repo has not listed
    Given WHO's DAK.fsh is available (otherwise the test is skipped)
    Then every component Source field it declares is a known component field

  @test:smart-base/schemas/dak-blocks.test.ts::the_component_list_against_WHO's_own_logical_model::componentSourcesAreWrappers
  Scenario: every component's Source is the url / canonical / instance wrapper
    Given WHO's DAK.fsh is available (otherwise the test is skipped)
    Then DAKComponentSources.fsh exists
    And every component Source logical model has exactly the source keys as 0..1 fields and says "exactly one of"

  @test:smart-base/schemas/dak-blocks.test.ts::the_component_list_against_WHO's_own_logical_model::schedulingLogicNotYetWhoField
  Scenario: scheduling logic is not YET a field of WHO's model
    Given WHO's DAK.fsh is available (otherwise the test is skipped)
    Then it declares no field starting "schedul"

  @test:smart-base/schemas/dak-blocks.test.ts::scheduling_logic_is_its_own_component,_and_says_it_is_unformalized::schedulingLogicOwnsItsKind
  Scenario: it owns the scheduling-logic kind, and decision support no longer does
    Then the scheduling-logic component's kinds are exactly "scheduling-logic"
    And decision-support-logic's kinds do not include it

  @test:smart-base/schemas/dak-blocks.test.ts::scheduling_logic_is_its_own_component,_and_says_it_is_unformalized::schedulingLogicUnformalizedSeventh
  Scenario: it is the one component named unformalized, and it sits seventh
    Then the unformalized components are exactly "scheduling-logic"
    And it is at index 6 of the components

  @test:smart-base/schemas/dak-blocks.test.ts::the_two_kinds_added_from_WHO's_own_logical_models::healthInterventionNeedsReference
  Scenario: a health intervention requires at least one reference
    Then building a health intervention with no references throws

  @test:smart-base/schemas/dak-blocks.test.ts::the_two_kinds_added_from_WHO's_own_logical_models::referencesCarryDublinCore
  Scenario: references carry Dublin Core, not bare strings
    When a health intervention is built with a reference having a title, an IRIS source and a publisher
    Then its layer is "L2" and its first reference's source contains "iris.who.int"

  @test:smart-base/schemas/dak-blocks.test.ts::the_two_kinds_added_from_WHO's_own_logical_models::dublinCoreReferenceNeedsTitle
  Scenario: a Dublin Core reference must at least be nameable
    Then building a health intervention whose reference has an empty title throws

  @test:smart-base/schemas/dak-blocks.test.ts::the_two_kinds_added_from_WHO's_own_logical_models::newKindsAreL2WithPrefixes
  Scenario: both new kinds are L2 and carry their label prefix
    Then "health-intervention" is L2 with prefix "hi"
    And "test-scenario" has prefix "tscen"
    And building a test scenario labelled "wrong:x" throws, while "tscen:immz-full-course" builds at L2

  @test:smart-base/schemas/dak-blocks.test.ts::the_two_kinds_added_from_WHO's_own_logical_models::newKindsMapToWhoModels
  Scenario: each new kind maps to the WHO logical model it came from
    Then "health-intervention" maps to WHO's StructureDefinition/HealthInterventions
    And "test-scenario" maps to WHO's StructureDefinition/TestScenario

  @test:smart-base/schemas/dak-blocks.test.ts::the_two_kinds_added_from_WHO's_own_logical_models::noInventedWhoModelIri
  Scenario: no WHO model IRI is invented for a kind WHO does not model
    Then "scheduling-logic" and "measure" map to no WHO model
    And every mapped IRI starts with "http://smart.who.int/base/StructureDefinition/"

  @test:smart-base/schemas/dak-blocks.test.ts::DAK_vocabulary_tracks_the_repo's_own_L2/L3_schemas::carriesL2Kinds
  Scenario: carries the L2 DAK components
    Then the DAK kinds include persona, user-scenario, business-process, data-element, decision-table, scheduling-logic, indicator and both requirement kinds

  @test:smart-base/schemas/dak-blocks.test.ts::DAK_vocabulary_tracks_the_repo's_own_L2/L3_schemas::carriesL3Kinds
  Scenario: carries the L3 FHIR artefact types
    Then the DAK kinds include logical-model, profile, value-set, questionnaire, cql-library, structure-map, plan-definition, measure, test-case and actor-definition

  @test:smart-base/schemas/dak-blocks.test.ts::DAK_vocabulary_tracks_the_repo's_own_L2/L3_schemas::dakKindsOutOfPaperUnion
  Scenario: DAK kinds stay out of the paper union
    Then no DAK kind is a paper block kind

  @test:smart-base/schemas/dak-blocks.test.ts::profiles_do_not_reach_a_DAK_kind::dakKindInNoProfile
  Scenario: a DAK kind is in no profile — a different adapter, not a narrower paper
    Then no content profile accepts any DAK kind

  @test:smart-base/schemas/dak-blocks.test.ts::DAK_kinds_reach_a_folio_only_through_its_dependency_tree_(bean_riit,_step_3)::smartBaseTreeRegistersDakKinds
  Scenario: a folio whose tree includes smart-base registers every DAK kind
    Then the registry of a folio depending on smart-base has one dak-adapter kind per DAK kind

  @test:smart-base/schemas/dak-blocks.test.ts::DAK_kinds_reach_a_folio_only_through_its_dependency_tree_(bean_riit,_step_3)::otherTreeRegistersNoDakKinds
  Scenario: a folio whose tree does not include smart-base registers none
    When the contributions of folio-assistant-core are loaded
    Then it registers no dak-adapter kind
