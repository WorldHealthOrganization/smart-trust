# Specifies scripts/fhir-core.ts and schemas/fhir-core.ts: the stable FHIR
# releases' core definitions, with HL7's published packages as the authority,
# and the UML class model derived from them.
Feature: The FHIR core definitions of each stable release, referred to at HL7 and derived from HL7's package

  @test:scripts/fhir-core.test.ts::fhir-core::selection::keeps_types,_resources_and_root_types,_and_leaves_out_profiles,_extensions_and_logical_models
  Scenario: The graph holds the types and resources, not the profiles
    Given core StructureDefinitions of every kind
    Then a root type, a resource specialisation and a primitive type are kept
    And a constraint profile, a logical model and a definition outside the core canonical base are left out

  @test:scripts/fhir-core.test.ts::fhir-core::index::reads_HL7's_package_and_writes_a_manifest_keyed_by_canonical_URL,_naming_HL7's_published_URL_for_each
  Scenario: Indexing a release reads HL7's own package
    Given HL7's core package holding types, resources, a profile, an extension and a logical model
    When the release is indexed
    Then only HL7's hl7.org URL is fetched
    And the manifest lists the types and resources by canonical URL in order, each with HL7's published JSON for it
    And it counts the three left out as excluded, and a root type carries no base

  @test:scripts/fhir-core.test.ts::fhir-core::index::an_unreachable_HL7_package_is_recorded_as_unread_with_the_reason,_and_a_mirror_is_never_read_for_it
  Scenario: HL7 unreachable is unread, and a mirror does not stand in
    Given hl7.org cannot be reached and a mirror can
    When the release is indexed
    Then the mirror is not fetched
    And the manifest says "unread" with the reason and has no definitions field

  @test:scripts/fhir-core.test.ts::fhir-core::index::bytes_that_differ_from_HL7's_are_refused_and_the_release_is_unread
  Scenario: Bytes that are not HL7's are refused
    Given the fetched tarball's hash is not HL7's
    When the release is indexed
    Then the release is unread and the reason names the sha1 mismatch

  @test:scripts/fhir-core.test.ts::fhir-core::index::a_copy_of_HL7's_package_in_--tgz-dir_is_used,_and_still_checked_against_HL7's_hashes
  Scenario: A local copy of HL7's package is used and still checked
    Given a copy of HL7's package in a local directory
    When the release is indexed with --tgz-dir and no network
    Then it is read
    And a tampered copy is refused

  @test:scripts/fhir-core.test.ts::fhir-core::uml::derives_a_class_per_type_and_backbone_element,_each_citing_HL7's_definition_and_element
  Scenario: The UML class model is derived from HL7's package and cites it
    Given HL7's package
    When the class model is derived
    Then each type and each backbone element is a class, with its generalization and owner
    And each class names HL7's definition and published JSON, and each attribute its element id
    And Reference targets, contentReference and a prohibited inherited element are kept as HL7 states them
    And a Mermaid diagram of a type shows its backbone classes by composition

  @test:scripts/fhir-core.test.ts::fhir-core::uml::a_class_model_needs_HL7's_own_bytes:_without_them_it_is_not_derived
  Scenario: No class model without HL7's bytes
    Given hl7.org cannot be reached
    Then no class model is written

  @test:scripts/fhir-core.test.ts::fhir-core::cache,_check_and_resolve::the_cache_is_labelled,_holds_HL7's_bytes,_and_resolve_answers_with_HL7's_URL
  Scenario: The local cache is labelled and resolve points at HL7
    Given an indexed release
    Then a canonical resolves to HL7's published URL before anything is cached
    When the cache is filled
    Then it carries a label saying it is not the authority, and each body is HL7's bytes
    And a versioned canonical also names its cached file, a type the release lacks is absent, and a profile is never cached

  @test:scripts/fhir-core.test.ts::fhir-core::cache,_check_and_resolve::a_pinned_mirror_may_fill_the_cache_when_HL7_cannot_be_reached,_file_by_file_against_HL7's_sha256
  Scenario: A pinned mirror may fill the cache only
    Given hl7.org cannot be reached and a pinned mirror can
    Then the cache is filled from the mirror and its label names the mirror
    And without the mirror pinned it cannot be filled

  @test:scripts/fhir-core.test.ts::fhir-core::cache,_check_and_resolve::an_edited_body,_a_stray_file_or_an_unlabelled_cache_fails_check
  Scenario: Check refuses an edited, stray or unlabelled cache
    Given a cache with one body edited, one file no entry names and no label, and a body outside the cache
    When it is checked
    Then each is an error

  @test:scripts/fhir-core.test.ts::fhir-core::cache,_check_and_resolve::an_unread_release_cannot_be_materialised_and_resolves_as_undetermined
  Scenario: An unread release stays undetermined
    Given an unread release
    Then filling its cache fails and a canonical URL resolves as undetermined

  @test:scripts/fhir-core.test.ts::fhir-core::cache,_check_and_resolve::a_manifest_or_class_model_from_a_package_other_than_the_pin,_or_a_missing_class_model,_fails_check
  Scenario: A re-pin without a re-index or re-derivation is caught
    Given a release with no class model
    Then check names it missing
    Given a manifest and class model from one package and a pin naming another
    Then check names both

  @test:scripts/fhir-core.test.ts::fhir-core::node_kinds::the_kinds_the_validators_name_judge_the_files_as_the_schemas_do
  Scenario: The node kinds judge as the schemas do
    Given an indexed release, its class model and its pins
    Then the release kind accepts the manifest and refuses an extra key or a specification other than HL7's
    And it refuses an unread release that still lists definitions, and accepts one that lists none
    And the pins kind refuses a release pinned twice or a package URL that is not HL7's
    And the class model kind refuses counts that are not true

  @test:scripts/fhir-core.test.ts::fhir-core::the_committed_graph::the_committed_pins,_manifests_and_class_models_check_clean,_one_stable_release_each,_all_pointing_at_HL7
  Scenario: The committed graph is R4, R4B and R5, pointing at HL7
    Given this layer's fhir-core directory
    Then its pins, manifests and class models check clean
    And each release's package and every definition's published URL are on hl7.org
    And each release holds Element, BackboneElement, DomainResource, Resource, Coding, Reference, Patient and string, and only R5 holds Base
    And Patient specialises DomainResource and owns Patient.contact in the class model
