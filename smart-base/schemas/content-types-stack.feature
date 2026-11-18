Feature: A repository is described as a set of content types
  describeRepository reports every content-type marker a repository carries,
  with its facts and any disagreement between markers; the registry refuses a
  conflicting redefinition; and the set is closed under the dependency tree.

  @test:smart-base/schemas/content-types-stack.test.ts::a_repository_is_a_SET_of_types,_not_a_boolean::noMarkerIsEmptySet
  Scenario: no known marker → empty, and that is not 'it is nothing'
    Given a repository holding only a README.md
    When it is described
    Then it has no types and no disagreements

  @test:smart-base/schemas/content-types-stack.test.ts::a_repository_is_a_SET_of_types,_not_a_boolean::oneMarkerOneMembership
  Scenario: one marker → one membership, with a dereferenceable type
    Given a repository holding a declaration x.json named "x"
    When it is described
    Then its only type is "harness", with an http(s) type IRI and marker "x.json"

  @test:smart-base/schemas/content-types-stack.test.ts::a_repository_is_a_SET_of_types,_not_a_boolean::twoMarkersTwoMemberships
  Scenario: TWO markers → two memberships — the case the boolean got wrong
    Given a repository with an index.config.json declaring a DAK and a sushi-config.yaml
    When it is described
    Then its types are "dak" and "sushi"

  @test:smart-base/schemas/content-types-stack.test.ts::a_repository_is_a_SET_of_types,_not_a_boolean::threeMarkersAtOnce
  Scenario: three at once, including ours
    Given a repository with a declaration, a DAK index and a sushi-config.yaml
    When it is described
    Then it has 3 types

  @test:smart-base/schemas/content-types-stack.test.ts::a_marker_that_is_present_and_unreadable_is_its_OWN_state::unparseableMarkerParsedFalse
  Scenario: unparseable → membership reported, `parsed: false`, no facts
    Given a repository whose x.config.json is not JSON
    When it is described
    Then it has one type, not parsed, with no facts

  @test:smart-base/schemas/content-types-stack.test.ts::a_marker_that_is_present_and_unreadable_is_its_OWN_state::yamlMarkerParsedFalse
  Scenario: YAML marker → membership reported, parsed false, and that is deliberate
    Given a repository with only a sushi-config.yaml
    When it is described
    Then its types are "sushi", not parsed

  @test:smart-base/schemas/content-types-stack.test.ts::a_marker_that_is_present_and_unreadable_is_its_OWN_state::markerWithoutFactsContributesNone
  Scenario: a marker with no facts contributes none — absent is not 'agrees'
    Given a repository whose x.config.json is "{}"
    When it is described
    Then its type has no facts and there are no disagreements

  @test:smart-base/schemas/content-types-stack.test.ts::two_markers_stating_one_fact_differently_are_REPORTED,_not_resolved::disagreementFoundBothClaimsKept
  Scenario: a disagreement is found and both claims are kept
    Given a declaration with canonicalUrl "http://one.example/" and a DAK index with canonicalUrl "http://two.example/"
    When the repository is described
    Then there is one disagreement, about "canonicalUrl"
    And its claims are harness "http://one.example/" and dak "http://two.example/"

  @test:smart-base/schemas/content-types-stack.test.ts::two_markers_stating_one_fact_differently_are_REPORTED,_not_resolved::nothingResolvedNeitherClaimDropped
  Scenario: NOTHING is resolved — neither claim is dropped or preferred
    Given the same two disagreeing markers
    When the repository is described
    Then the harness type's canonicalUrl fact is "http://one.example/" and the dak type's is "http://two.example/"

  @test:smart-base/schemas/content-types-stack.test.ts::two_markers_stating_one_fact_differently_are_REPORTED,_not_resolved::agreementIsSilence
  Scenario: agreement is silence, not a finding
    Given a declaration and a DAK index with the same canonicalUrl
    Then there are no disagreements

  @test:smart-base/schemas/content-types-stack.test.ts::two_markers_stating_one_fact_differently_are_REPORTED,_not_resolved::comparesCanonicalWithCanonicalUrl
  Scenario: the DAK section spelling `canonical` is compared against `canonicalUrl`
    Given a declaration with canonicalUrl "http://ours.example/" and a DAK index with canonical "http://theirs.example/"
    Then the disagreements are about "canonicalUrl"

  @test:smart-base/schemas/content-types-stack.test.ts::the_registry_refuses_a_conflicting_redefinition_and_tolerates_a_diamond::reRegisteringSameIsNoOp
  Scenario: re-registering the SAME definition is a no-op
    Given a registry with the base and DAK content types
    Then registering them again does not throw
    And the registered ids are unchanged, and there is at least one

  @test:smart-base/schemas/content-types-stack.test.ts::the_registry_refuses_a_conflicting_redefinition_and_tolerates_a_diamond::reRegisteringDifferentThrows
  Scenario: re-registering a DIFFERENT definition throws, naming the id
    Given a registry with the base and DAK content types
    Then registering "dak" with a different definition throws a content type conflict error

  @test:smart-base/schemas/content-types-stack.test.ts::the_set_is_closed_under_the_dependency_tree::closureAttributesDependencyTypes
  Scenario: a dependency's types are in the closure, ATTRIBUTED to it
    Given a root declaration "mine" depending on "who-adapter", a repository declaring a DAK
    When the closure is described
    Then its types are dak by "who-adapter" (not own), then harness and folio by the root (own)

  @test:smart-base/schemas/content-types-stack.test.ts::the_set_is_closed_under_the_dependency_tree::ownSeparatesRootFromDependency
  Scenario: `own` separates 'this repo IS a DAK' from 'something it depends on is'
    Given the same root and DAK dependency
    When the closure is described
    Then its own types are "folio" and "harness"
    And no own type is "dak"

  @test:smart-base/schemas/content-types-stack.test.ts::the_set_is_closed_under_the_dependency_tree::typeAssertedByBothAppearsTwice
  Scenario: a type asserted by BOTH appears twice — not a duplicate to collapse
    Given a root declaring a DAK that depends on another repository declaring a DAK
    When the closure is described
    Then "dak" appears twice, by "who-adapter" and by the root

  @test:smart-base/schemas/content-types-stack.test.ts::the_set_is_closed_under_the_dependency_tree::noDependenciesClosureIsRoot
  Scenario: no dependencies → the closure is just the root
    Given a root declaration with no dependencies
    When the closure is described
    Then its only type is harness by the root

  @test:smart-base/schemas/content-types-stack.test.ts::the_set_is_closed_under_the_dependency_tree::differentReposCanonicalsNotDisagreement
  Scenario: two repos naming different canonicalUrls is NOT a disagreement
    Given a root and its dependency naming different canonicalUrls
    When the closure is described
    Then there are no disagreements

  @test:smart-base/schemas/content-types-stack.test.ts::the_set_is_closed_under_the_dependency_tree::disagreementWithinInstanceReported
  Scenario: ...but a disagreement WITHIN one instance is reported, tagged with it
    Given a dependency "who-adapter" whose config and DAK index name different canonicalUrls
    When the root's closure is described
    Then the only disagreement is about "canonicalUrl", in instance "who-adapter"
