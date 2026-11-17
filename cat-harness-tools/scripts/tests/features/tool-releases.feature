# Tool releases: resolver and content-addressed cache, RunContext and PROV-O,
# SPDX export, upstream pins and the GITB projection. Each Scenario names the
# test that executes it.
Feature: Tool releases

  Background:
    Given a synthetic catalogue of seven releases (two Temurin JREs, node, PlantUML, IG Publisher, SUSHI, Lean) with fake artefacts, and a "dual-java" profile

  @test:scripts/tests/tool-releases.test.ts::Step_2_—_resolver,_content-addressed_cache_&_per-tool_runtime_injection::provisions_two_tools_on_different_Java_runtimes_(17_vs_21)_in_the_same_cache_and_injects_each_tool's_own_JAVA_HOME_and_PATH
  Scenario: Two Java runtimes coexist and each tool gets its own
    When the "dual-java" profile is provisioned into an empty cache
    Then the profile has a 64-hex sha256 and all seven releases are provisioned
    And the cache holds Temurin 17 and 21 under version-and-digest-prefix directories
    And PlantUML gets JAVA_HOME of Temurin 21 and its jar as the entry command
    And IG Publisher gets JAVA_HOME of Temurin 17 and SUSHI on its PATH
    And SUSHI gets node 22's bin directory on its PATH

  @test:scripts/tests/tool-releases.test.ts::Step_2_—_resolver,_content-addressed_cache_&_per-tool_runtime_injection::refuses_a_sha256_mismatch_with_state_`could-not-provision`_and_writes_nothing_to_the_cache
  Scenario: A digest mismatch is refused and not cached
    When PlantUML is provisioned with tampered bytes
    Then its state is "could-not-provision" with "sha256 mismatch"
    And its artefact path in the cache does not exist

  @test:scripts/tests/tool-releases.test.ts::Step_2_—_resolver,_content-addressed_cache_&_per-tool_runtime_injection::re-uses_an_already_verified_cache_entry_without_re-fetching,_and_rejects_a_corrupted_cache_file
  Scenario: A valid cache entry is reused and a corrupt one rejected
    Given the cache already holds valid Temurin 21 bytes and corrupt PlantUML bytes
    When PlantUML is provisioned with no fetcher
    Then Temurin 21 is "provisioned"
    And PlantUML is "could-not-provision" with "sha256 mismatch"

  @test:scripts/tests/tool-releases.test.ts::Step_2_—_resolver,_content-addressed_cache_&_per-tool_runtime_injection::plantuml-render_resolves_PlantUML's_release_from_the_declared_tool-release_directory
  Scenario: plantuml-render resolves its release from the harness
    When PlantUML's release is resolved from the harness
    Then its version, sha256 and URL equal the PLANTUML constant's

  @test:scripts/tests/tool-releases.test.ts::Step_3_—_RunContext_&_PROV-O_`prov:used`_emission_(`C1_=_a`)::buildRunContext_produces_a_valid_folio-run-context/v1,_content-addressed_ref,_and_omits_unprovisioned_releases_from_prov:used
  Scenario: The RunContext is valid and prov:used omits unprovisioned releases
    Given the "dual-java" profile is provisioned while SUSHI's registry is unreachable
    When a RunContext is built
    Then the context and its ref validate, and the ref's sha256 is that of the canonical bytes
    And SUSHI and IG Publisher are unprovisioned
    And prov:used names PlantUML, both JREs and node, but not SUSHI or IG Publisher
    And attaching to an activity appends them after its existing prov:used entity
    When every release resolves
    Then the QA toolchain projects publisher "1.6.20", sushi "3.21.0" and the given FHIR version

  @test:scripts/tests/tool-releases.test.ts::Step_4_—_`tools:sbom`_SPDX_3.0.1_JSON-LD_export::exports_a_self-contained_SPDX_3.0.1_JSON-LD_graph_with_packages,_hashes,_declared_licences,_dependsOn_and_usesTool_relationships
  Scenario: The SPDX 3.0.1 SBOM graph
    Given the "dual-java" profile is provisioned and its RunContext built
    When the SBOM is exported
    Then its context is SPDX 3.0.1 and its creation info names spec 3.0.1 and the created time
    And there is one package per release, PlantUML's with its id and sha256 hash
    And at least four licence expressions and one hasDeclaredLicense per release
    And IG Publisher depends on Temurin 17 and SUSHI
    And a build named by the RunContext sha256 usesTool every release in scope "build"
    And the SBOM is of type "build" and the document's root is the SBOM

  @test:scripts/tests/tool-releases.test.ts::Step_4_—_`tools:sbom`_SPDX_3.0.1_JSON-LD_export::exports_SPDX_3.0.1_over_the_real_seeded_tool-releases/_directory
  Scenario: The real seeded releases export to SPDX
    When the harness's tool-releases directory is loaded
    Then there are no problems
    And the exported SBOM has one package per loaded release

  @test:scripts/tests/tool-releases.test.ts::Step_6_—_`upstream-pins`_assessment_for_tool-release_pins::assesses_tool-release_pins_in_upstream-pins.json_with_three-state_semantics
  Scenario: The PlantUML pin is assessed in three states
    Given the harness's "plantuml" pin and the version its pattern reads from the release file
    Then the version looks like "1.YYYY.N" and its tag matches the pin's tag pattern
    And with tags up to it the pin is "current"
    And with a newer tag it is "behind" by that tag
    And with no tags it is "unknown"

  @test:scripts/tests/tool-releases.test.ts::Step_8_—_`test:itb-export`_GITB_TAR_projection::exports_a_GITB_Test_Assertion_Report_carrying_the_RunContext_sha256_reference_and_per-case_results
  Scenario: The GITB TAR carries the RunContext and per-case results
    Given PlantUML is provisioned, a RunContext built, and a test report with a pass, a warn and a fail
    When the GITB TAR is exported
    Then it is "gitb-tar/v1" with result "FAILURE" and counters 3 assertions, 1 error, 1 warning
    And its context carries the RunContext ref, the platform commit and two releases
    And the case reports are pass SUCCESS, warn SUCCESS and fail FAILURE
