Feature: ig-site:sidecars, smart-base's step in an IG repository's site
  The descriptor smart-base hands fhir-harness for an IG's sidecars: a DAK
  label where the IG is a DAK, and the hub's marker.

  @test:smart-base/scripts/ig-site-sidecars.test.ts::ig-site:sidecars,_smart-base's_step_in_an_IG_repository's_site::dakLabelsSidecarsDakApi
  Scenario: a DAK (contentTypes.dak in its index.config.json) labels its sidecars DAK API
    Given an IG whose index.config.json declares contentTypes.dak
    Then its descriptor has the DAK API label and the hub marker placeholder

  @test:smart-base/scripts/ig-site-sidecars.test.ts::ig-site:sidecars,_smart-base's_step_in_an_IG_repository's_site::legacyDakJsonStillLabelled
  Scenario: a DAK not yet migrated (a legacy dak.json at the IG root) is still labelled
    Given an IG with only a dak.json at its root
    Then its descriptor has the DAK API label and the hub marker placeholder

  @test:smart-base/scripts/ig-site-sidecars.test.ts::ig-site:sidecars,_smart-base's_step_in_an_IG_repository's_site::noDakGetsNoLabel
  Scenario: an IG that declares no DAK gets no label, so fhir-harness's IG API default stands
    Given an empty IG directory
    Then its descriptor has only the hub marker placeholder

  @test:smart-base/scripts/ig-site-sidecars.test.ts::ig-site:sidecars,_smart-base's_step_in_an_IG_repository's_site::noAstRefusedNamingRestoreStep
  Scenario: no AST: refused, naming the step that restores it
    Given an IG directory with no AST
    When the IG site sidecars are built
    Then it throws an error saying "no AST" and naming "ig-site:ast"

  @test:smart-base/scripts/ig-site-sidecars.test.ts::ig-site:sidecars,_smart-base's_step_in_an_IG_repository's_site::handshakeNamesMatchFhirHarness
  Scenario: the handshake names are fhir-harness's (ig-repo-site.ts)
    Given fhir-harness's ig-repo-site.ts is mounted beside this layer (otherwise the test is skipped)
    Then its source declares IG_API_WORK, IG_API_DESCRIPTOR and IG_API_SITE with the same values as smart-base's

  @test:smart-base/scripts/ig-site-sidecars.test.ts::the_hub_is_fhir-harness's_(bean_h7ap)::descriptorNamesHubMarker
  Scenario: the descriptor names the hub's marker, so fhir-harness draws the hub at the IG's page holding it
    Given an empty IG directory
    Then its descriptor is exactly the hub marker placeholder
