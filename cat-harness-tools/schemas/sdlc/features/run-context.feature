# Specifies schemas/sdlc/run-context.ts: folio-run-context/v1, the record of
# what a run ran on (platform commit, mounts, profile, tool releases, invoker,
# inputs), and the { sha256 } reference reports carry to it.
Feature: A run context records what a run ran on, and reports reference it by hash

  Background:
    Given a valid run context: a full platform commit, locked mounts with one instance pinned by SHA, a profile, two provisioned releases with digests, a system invoker with a script hash, one hashed input basis and a PROV activity

  @test:schemas/sdlc/run-context.test.ts::folio-run-context/v1::a_valid_context_parses
  Scenario: A valid run context parses
    When it is parsed with the run context schema
    Then it parses

  @test:schemas/sdlc/run-context.test.ts::folio-run-context/v1::strict:_an_unknown_top-level_field_is_refused
  Scenario: An unknown top-level field is refused
    When the context carries an engine_version field
    Then it is refused

  @test:schemas/sdlc/run-context.test.ts::folio-run-context/v1::the_platform_commit_is_a_full_SHA_—_an_abbreviated_one_is_ambiguous
  Scenario: An abbreviated platform commit is refused
    When the platform commit is "1234567"
    Then the context is refused

  @test:schemas/sdlc/run-context.test.ts::folio-run-context/v1::releases_—_`could-not-provision`_is_a_state_with_a_reason::could-not-provision_WITH_a_reason_parses,_and_is_reported
  Scenario: A release that could not be provisioned, with a reason, parses and is reported
    When the only release is "temurin-jre@21.0.4+7" in state could-not-provision with a reason
    Then the context parses
    And unprovisioned lists exactly that release

  @test:schemas/sdlc/run-context.test.ts::folio-run-context/v1::releases_—_`could-not-provision`_is_a_state_with_a_reason::could-not-provision_WITHOUT_a_reason_is_refused
  Scenario: could-not-provision without a reason is refused
    When a could-not-provision release has no reason, or an empty reason
    Then the context is refused

  @test:schemas/sdlc/run-context.test.ts::folio-run-context/v1::releases_—_`could-not-provision`_is_a_state_with_a_reason::provisioned_WITHOUT_a_digest_is_refused
  Scenario: A provisioned release without a digest is refused
    When a provisioned release has no digest
    Then the context is refused

  @test:schemas/sdlc/run-context.test.ts::folio-run-context/v1::releases_—_`could-not-provision`_is_a_state_with_a_reason::one_release_listed_twice_is_refused
  Scenario: A release listed twice is refused
    When the same provisioned release is listed twice
    Then the context is refused

  @test:schemas/sdlc/run-context.test.ts::folio-run-context/v1::mounts_—_none,_locked,_or_could-not-determine::`none`_parses;_`locked`_with_no_instances_does_not
  Scenario: Mounts of none parse; locked mounts need instances
    When the mounts state is "none"
    Then the context parses
    And locked mounts with an empty instance list are refused

  @test:schemas/sdlc/run-context.test.ts::folio-run-context/v1::mounts_—_none,_locked,_or_could-not-determine::`could-not-determine`_needs_its_reason
  Scenario: Mounts that could not be determined need a reason
    When the mounts state is "could-not-determine" without a reason
    Then the context is refused
    And with the reason "the lock did not parse" it parses

  @test:schemas/sdlc/run-context.test.ts::folio-run-context/v1::mounts_—_none,_locked,_or_could-not-determine::a_mounted_instance_pinned_by_branch_name_is_refused
  Scenario: A mounted instance pinned by branch name is refused
    When a locked mount instance's sha is "main"
    Then the context is refused

  @test:schemas/sdlc/run-context.test.ts::folio-run-context/v1::invoker::a_`system`_invoker_must_give_its_script_hash_—_`unknown`_is_allowed_and_is_not_a_hash
  Scenario: A system invoker must give its script hash or "unknown"
    When a system invoker has no script_hash
    Then the context is refused
    And a script_hash of "unknown" parses
    And a script_hash of "not-a-hash" is refused

  @test:schemas/sdlc/run-context.test.ts::folio-run-context/v1::invoker::a_person_needs_no_script_hash;_an_unknown_actor_kind_is_refused
  Scenario: A person invoker needs no script hash; an unknown kind is refused
    When the invoker is a person with no script hash
    Then the context parses
    And an invoker of kind "robot" is refused

  @test:schemas/sdlc/run-context.test.ts::folio-run-context/v1::inputs_reuse_HashBasisSchema:_a_basis_over_nothing_is_refused
  Scenario: An input hash basis over nothing is refused
    When an input basis lists no inputs
    Then the context is refused

  @test:schemas/sdlc/run-context.test.ts::folio-run-context/v1::profile_and_prov_are_optional_—_a_run_may_select_no_profile_and_record_no_PROV_activity_yet
  Scenario: Profile and PROV are optional
    When the context has neither profile nor prov
    Then it parses

  @test:schemas/sdlc/run-context.test.ts::the_reference_a_report_carries_(C1:_by_sha256)::RunContextRefSchema_is_`{_sha256_}`_and_nothing_else
  Scenario: A run context reference is a sha256 and nothing else
    When a reference { sha256 } with a 64-hex digest is parsed
    Then it parses
    And a reference that also carries a context is refused
    And a reference whose sha256 is "abc" is refused

  @test:schemas/sdlc/run-context.test.ts::the_reference_a_report_carries_(C1:_by_sha256)::the_reference_does_not_depend_on_the_order_a_writer_set_fields_in
  Scenario: The reference does not depend on field order
    When the reference is computed for the context and for the same context with its fields in reverse order
    Then both references are equal
    And the reference parses as a run context reference

  @test:schemas/sdlc/run-context.test.ts::the_reference_a_report_carries_(C1:_by_sha256)::a_different_context_has_a_different_reference
  Scenario: A different context has a different reference
    When the platform commit is changed
    Then the reference's sha256 changes

  @test:schemas/sdlc/run-context.test.ts::the_reference_a_report_carries_(C1:_by_sha256)::toolchainFromRunContext_projects_provisioned_publisher_and_sushi_releases_and_ignores_could-not-provision
  Scenario: The toolchain projection keeps only provisioned sushi and publisher releases
    Given a provisioned "fsh-sushi@3.21.0" and a could-not-provision "fhir-ig-publisher@1.6.20"
    When the toolchain is projected with FHIR version "4.0.1"
    Then it is { sushi: "3.21.0", fhirVersion: "4.0.1" } with no publisher

  @test:schemas/sdlc/run-context.test.ts::the_reference_a_report_carries_(C1:_by_sha256)::run_and_report_schemas_accept_optional_`runContext:_{_sha256_}`_and_reject_inline_context_objects_(C1_=_a)
  Scenario: Run and report schemas accept a runContext reference and refuse an inline context
    Given a valid tool run record, test run, test report, QA report, KG QA manifest and health report, each without a runContext
    Then each parses under its own schema
    And each still parses when it carries the runContext reference { sha256 }
    And each is refused when its runContext is the whole run context object inline
    And each is refused when its runContext is the reference with the context object beside the sha256

  @test:schemas/sdlc/run-context.test.ts::the_reference_a_report_carries_(C1:_by_sha256)::addressBook_resolves_tool-release_refs_(`<name>@<version>`)_as_`prov:Entity`_IRIs_for_`prov:used`_(Step_3)
  Scenario: The address book resolves tool-release refs as entity IRIs
    Given the address book of the repository three levels above this schema directory
    When "plantuml@1.2026.9" and "temurin-jre@17.0.12+7" are resolved as entities
    Then each resolves to its tool-releases IRI under litlfred.github.io/cat-harness/v0
    And a PROV activity that used "plantuml@1.2026.9" and "temurin-jre@21.0.4+7" leaves nothing unaddressed in its JSON-LD document
