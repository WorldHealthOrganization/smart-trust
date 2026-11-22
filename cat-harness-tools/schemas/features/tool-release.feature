# The tool release schema (schemas/tools/tool-release.ts): one pinned, digest-identified release of a
# tool or runtime, its release refs, its SPDX licence check, the seeded records and its graph typology.
# Each Scenario names the test that executes it.
Feature: Tool release records

  @test:schemas/tool-release.test.ts::folio-tool-release/v1::a_valid_release_parses
  Scenario: A valid release record parses
    Given the PlantUML jar release fixture with a sha256 digest, an https source and a JRE runtime
    When ToolReleaseSchema parses it
    Then the parse succeeds

  @test:schemas/tool-release.test.ts::folio-tool-release/v1::the_digest_is_REQUIRED_—_the_resolver's_one_refusal_compares_against_it
  Scenario: A release without a digest is refused
    Given the release fixture with its digest removed
    When ToolReleaseSchema parses it
    Then the parse fails

  @test:schemas/tool-release.test.ts::folio-tool-release/v1::the_digest_is_`binary-release`'s_ReleaseDigestSchema:_an_uppercase_or_short_hash_is_refused
  Scenario: A malformed digest is refused
    Given the release fixture
    When its digest is an uppercase 64-character hash
    Then the parse fails
    And a 63-character hash fails
    And the algorithm "md5" fails

  @test:schemas/tool-release.test.ts::folio-tool-release/v1::strict:_a_field_carrying_the_bytes_is_refused
  Scenario: A release carrying a content field is refused
    Given the release fixture with an extra "content" field
    When ToolReleaseSchema parses it
    Then the parse fails

  @test:schemas/tool-release.test.ts::folio-tool-release/v1::an_unknown_kind_is_refused
  Scenario: An unknown release kind is refused
    Given the release fixture with kind "snap"
    When ToolReleaseSchema parses it
    Then the parse fails

  @test:schemas/tool-release.test.ts::folio-tool-release/v1::a_plain-http_source_is_refused
  Scenario: A plain-http source URL is refused
    Given the release fixture with source URL "http://example.org/x.jar"
    When ToolReleaseSchema parses it
    Then the parse fails

  @test:schemas/tool-release.test.ts::folio-tool-release/v1::an_OCI_image_is_identified_by_digest,_never_by_tag::by_digest:_accepted
  Scenario: An OCI image referenced by its digest is accepted
    Given an oci-image release whose reference is "ghcr.io/example/latex@sha256:" plus its digest
    When ToolReleaseSchema parses it
    Then the parse succeeds

  @test:schemas/tool-release.test.ts::folio-tool-release/v1::an_OCI_image_is_identified_by_digest,_never_by_tag::by_TAG:_refused
  Scenario: An OCI image referenced by tag is refused
    Given oci-image releases referenced as "ghcr.io/example/latex:2026.10" and "ghcr.io/example/latex:latest"
    When ToolReleaseSchema parses them
    Then both parses fail

  @test:schemas/tool-release.test.ts::folio-tool-release/v1::an_OCI_image_is_identified_by_digest,_never_by_tag::by_tag_AND_digest:_refused_—_the_tag_is_a_second,_moving_answer
  Scenario: An OCI image referenced by tag and digest together is refused
    Given an oci-image release referenced as "ghcr.io/example/latex:2026.10@sha256:" plus its digest
    When ToolReleaseSchema parses it
    Then the parse fails

  @test:schemas/tool-release.test.ts::folio-tool-release/v1::an_OCI_image_is_identified_by_digest,_never_by_tag::a_reference_naming_a_different_digest_from_`digest`_is_refused
  Scenario: An OCI reference whose digest differs from the release digest is refused
    Given an oci-image release whose reference names a digest of all "b" while its digest is all "a"
    When ToolReleaseSchema parses it
    Then the parse fails

  @test:schemas/tool-release.test.ts::folio-tool-release/v1::an_OCI_image_is_identified_by_digest,_never_by_tag::an_`oci-image`_fetched_by_URL,_or_a_jar_fetched_by_OCI_reference,_is_refused
  Scenario: The release kind and source type must agree
    Given an oci-image release with a URL source
    When ToolReleaseSchema parses it
    Then the parse fails
    And a jar release with an OCI source also fails

  @test:schemas/tool-release.test.ts::folio-tool-release/v1::runtimes_are_per_release::`runtimes`_is_required,_so_'needs_none'_is_stated_rather_than_omitted
  Scenario: The runtimes field is required but may be empty
    Given the release fixture with runtimes removed
    When ToolReleaseSchema parses it
    Then the parse fails
    And the fixture with an empty runtimes list parses

  @test:schemas/tool-release.test.ts::folio-tool-release/v1::runtimes_are_per_release::a_runtime_ref_must_be_`name@version`
  Scenario: A runtime ref without a version is refused
    Given the release fixture with runtime release "temurin-jre"
    When ToolReleaseSchema parses it
    Then the parse fails

  @test:schemas/tool-release.test.ts::folio-tool-release/v1::runtimes_are_per_release::injection_is_JAVA_HOME_or_PATH_—_never_'inherit'
  Scenario: Runtime injection must be JAVA_HOME or PATH
    Given the release fixture with a runtime injected as "inherit"
    When ToolReleaseSchema parses it
    Then the parse fails
    And the same runtime injected as "PATH" parses

  @test:schemas/tool-release.test.ts::folio-tool-release/v1::runtimes_are_per_release::a_release_cannot_be_its_own_runtime
  Scenario: A release naming itself as a runtime is refused
    Given the plantuml 1.2026.9 release fixture with runtime "plantuml@1.2026.9"
    When ToolReleaseSchema parses it
    Then the parse fails

  @test:schemas/tool-release.test.ts::folio-tool-release/v1::runtimes_are_per_release::one_runtime_named_twice_is_refused
  Scenario: A runtime listed twice is refused
    Given the release fixture with the same JRE runtime listed twice
    When ToolReleaseSchema parses it
    Then the parse fails

  @test:schemas/tool-release.test.ts::folio-tool-release/v1::the_entry_template_runs_THIS_release::a_template_that_never_names_{path}_or_{home}_is_refused
  Scenario: An entry template naming neither path nor home is refused
    Given the release fixture with entry template "java -version"
    When ToolReleaseSchema parses it
    Then the parse fails

  @test:schemas/tool-release.test.ts::folio-tool-release/v1::the_entry_template_runs_THIS_release::an_unknown_placeholder_is_refused
  Scenario: An entry template with an unknown placeholder is refused
    Given the release fixture with entry template "java -jar {jar}"
    When ToolReleaseSchema parses it
    Then the parse fails

  @test:schemas/tool-release.test.ts::folio-tool-release/v1::the_entry_template_runs_THIS_release::{home}_needs_`home`,_and_`home`_may_not_climb_out_of_the_archive
  Scenario: A home placeholder needs a relative home inside the archive
    Given the release fixture with entry template "{home}/bin/java"
    When no home is declared
    Then the parse fails
    And home "jdk" parses
    And home "../etc" fails
    And home "/usr" fails

  @test:schemas/tool-release.test.ts::folio-tool-release/v1::a_multi-line_licence_is_refused_by_the_schema
  Scenario: A licence spanning two lines is refused
    Given the release fixture with licence "MIT" and "OR Apache-2.0" on separate lines
    When ToolReleaseSchema parses it
    Then the parse fails

  @test:schemas/tool-release.test.ts::release_refs::round-trip,_splitting_at_the_one_`@`
  Scenario: Release refs split at the @ and are rebuilt from name and version
    When "temurin-jre@21.0.4+7" is parsed
    Then it gives name "temurin-jre" and version "21.0.4+7"
    And name "graphviz" with version "16.1.0" formats as "graphviz@16.1.0"

  @test:schemas/tool-release.test.ts::release_refs::two_`@`,_a_missing_version_or_an_uppercase_name_is_refused
  Scenario: Malformed release refs are refused
    When ToolReleaseRefSchema parses "a@b@c", "plantuml@" and "PlantUML@1"
    Then each parse fails

  @test:schemas/tool-release.test.ts::licences,_against_the_pinned_SPDX_License_List::the_list_loads_(could-not-determine_would_fail_here,_not_pass)
  Scenario: The pinned SPDX License List loads
    Given the repository root
    When loadSpdxLicenseList reads it
    Then the result is not an error string

  @test:schemas/tool-release.test.ts::licences,_against_the_pinned_SPDX_License_List::a_real_expression_passes_and_a_mistyped_id_does_not
  Scenario: A valid SPDX expression passes and a mistyped licence id is a problem
    Given the loaded SPDX License List
    When the licence "GPL-2.0-only WITH Classpath-exception-2.0" is checked
    Then there is no problem
    And the licence "GPL-3.O-or-later" has a problem

  @test:schemas/tool-release.test.ts::the_seeded_records::T4:_PlantUML,_its_JRE_and_graphviz_are_all_present,_and_each_parses
  Scenario: The seeded release records parse and include PlantUML, its JRE and graphviz
    Given the tool-release JSON files in the harness "tool-releases" directory
    When each is parsed with ToolReleaseSchema
    Then every parse succeeds
    And the names include "graphviz", "plantuml" and "temurin-jre"

  @test:schemas/tool-release.test.ts::the_seeded_records::PlantUML's_digest_is_the_one_`scripts/plantuml-render.ts`_already_pins_—_one_fact,_two_places,_checked
  Scenario: The seeded PlantUML record matches the pin in scripts/plantuml-render.ts
    Given the seeded plantuml release record
    And the PLANTUML pin exported by scripts/plantuml-render.ts
    Then the record's version equals the pin's version
    And its digest equals the pin's sha256
    And its source is the URL source with the pin's url

  @test:schemas/tool-release.test.ts::the_graph_typology_it_is_held_under::registered,_not_renderable,_`content`_—_a_pin_is_a_decision_the_resolver_reads
  Scenario: The tool-release typology is registered, not renderable, and in the content layer
    When the "tool-release" graph typology is looked up
    Then it is registered in defaultGraphTypologies
    And it is not renderable
    And its graph layer is "content"

  @test:schemas/tool-release.test.ts::the_graph_typology_it_is_held_under::both_families_are_listed,_so_`check:kind-validators`_can_route_every_file
  Scenario: The tool-release typology lists both node schema families
    When the node schema families of the "tool-release" typology are listed
    Then they are exactly "folio-tool-profile/v1" and "folio-tool-release/v1"

  @test:schemas/tool-release.test.ts::the_graph_typology_it_is_held_under::a_running_step_never_WRITES_a_pin_—_the_resolver_reads_it;_what_a_run_resolved_is_a_run_context
  Scenario: A process may not write the tool-release graph
    When processMayWrite is asked about "tool-release"
    Then it returns false
