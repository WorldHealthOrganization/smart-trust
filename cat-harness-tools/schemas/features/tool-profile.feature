# The tool profile schema (schemas/tools/tool-profile.ts): a profile maps tool names to pinned releases,
# and toolReleaseGraphProblems checks profiles and release records against each other.
# Each Scenario names the test that executes it.
Feature: Tool profiles and the tool release graph

  @test:schemas/tool-profile.test.ts::folio-tool-profile/v1::a_valid_profile_parses
  Scenario: A profile mapping a tool to its pinned release parses
    Given a profile mapping "plantuml" to "plantuml@1.2026.9"
    When ToolProfileSchema parses it
    Then the parse succeeds

  @test:schemas/tool-profile.test.ts::folio-tool-profile/v1::an_empty_profile_is_refused
  Scenario: A profile with no tools is refused
    Given a profile with an empty tools map
    When ToolProfileSchema parses it
    Then the parse fails

  @test:schemas/tool-profile.test.ts::folio-tool-profile/v1::a_key_that_is_not_the_name_of_the_release_it_maps_to_is_refused_—_the_runtime_cannot_hide_under_a_tool's_name
  Scenario: A tool key must match the name of the release it maps to
    Given a profile mapping "plantuml" to "temurin-jre@21.0.4+7"
    When ToolProfileSchema parses it
    Then the parse fails

  @test:schemas/tool-profile.test.ts::folio-tool-profile/v1::a_bare_tool_name_with_no_version_is_refused
  Scenario: A release ref without a version is refused
    Given a profile mapping "plantuml" to "plantuml"
    When ToolProfileSchema parses it
    Then the parse fails

  @test:schemas/tool-profile.test.ts::folio-tool-profile/v1::strict:_an_unknown_field_is_refused
  Scenario: A profile with an unknown field is refused
    Given a valid profile with an extra "runtimes" field
    When ToolProfileSchema parses it
    Then the parse fails

  @test:schemas/tool-profile.test.ts::the_graph_—_what_one_file_cannot_know::the_T4_set_is_clean:_PlantUML_with_its_JRE_and_graphviz,_and_a_default_profile_naming_tools_only
  Scenario: PlantUML with its JRE and graphviz runtimes and a tools-only profile is clean
    Given the releases temurin-jre, graphviz and plantuml, with plantuml needing the JRE and graphviz
    And a "default" profile naming plantuml and graphviz
    When toolReleaseGraphProblems checks them
    Then there are no problems

  @test:schemas/tool-profile.test.ts::the_graph_—_what_one_file_cannot_know::a_profile_NAMING_A_RUNTIME_is_refused_—_that_is_the_global_java_pin_by_another_name
  Scenario: A profile naming a runtime release is refused
    Given the JRE, graphviz and plantuml releases
    And a profile mapping "temurin-jre" to "temurin-jre@21.0.4+7"
    When toolReleaseGraphProblems checks them
    Then there is exactly 1 problem
    And it contains "names runtime temurin-jre@21.0.4+7 directly"

  @test:schemas/tool-profile.test.ts::the_graph_—_what_one_file_cannot_know::a_profile_ref_to_no_release_is_refused
  Scenario: A profile referencing an unrecorded release is refused
    Given the JRE, graphviz and plantuml releases
    And a profile mapping "plantuml" to "plantuml@9.9"
    When toolReleaseGraphProblems checks them
    Then the first problem contains "no record declares"

  @test:schemas/tool-profile.test.ts::the_graph_—_what_one_file_cannot_know::a_runtime_ref_to_no_release_is_refused
  Scenario: A release needing an unrecorded runtime is refused
    Given the graphviz and plantuml releases but no JRE release
    When toolReleaseGraphProblems checks them with no profiles
    Then the first problem contains "needs runtime temurin-jre@21.0.4+7"

  @test:schemas/tool-profile.test.ts::the_graph_—_what_one_file_cannot_know::a_runtime_with_no_`entry.home`_cannot_be_injected
  Scenario: A runtime release without an entry home is refused
    Given a temurin-jre runtime release whose entry has no home
    And the graphviz and plantuml releases
    When toolReleaseGraphProblems checks them
    Then the first problem contains "declares no `entry.home`"

  @test:schemas/tool-profile.test.ts::the_graph_—_what_one_file_cannot_know::a_TOOL_may_be_another_tool's_runtime_—_graphviz_is_how_PlantUML_finds_`dot`
  Scenario: A tool release may also serve as another tool's runtime
    Given the JRE, graphviz and plantuml releases, with graphviz a runtime of plantuml
    And a profile naming graphviz as a tool
    When toolReleaseGraphProblems checks them
    Then there are no problems

  @test:schemas/tool-profile.test.ts::the_graph_—_what_one_file_cannot_know::one_release_recorded_twice_on_one_platform_is_refused;_on_two_platforms_it_is_not
  Scenario: A release recorded twice is refused only on the same platform
    Given the JRE release listed twice
    When toolReleaseGraphProblems checks them
    Then the first problem contains "recorded twice"
    And the same JRE recorded once for linux arm64 and once for linux x64 has no problems

  @test:schemas/tool-profile.test.ts::the_graph_—_what_one_file_cannot_know::two_profiles_with_one_name_are_refused
  Scenario: Two profiles with the same name are refused
    Given the graphviz release and the same profile listed twice
    When toolReleaseGraphProblems checks them
    Then the first problem contains "declared twice"

  @test:schemas/tool-profile.test.ts::the_seeded_directory,_as_the_gate_reads_it::every_file_parses_and_none_is_mistaken_for_an_instance_declaration
  Scenario: The seeded tool-releases directory loads without problems
    Given the harness "tool-releases" directory
    When loadToolReleases reads it
    Then it reports no problems

  @test:schemas/tool-profile.test.ts::the_seeded_directory,_as_the_gate_reads_it::the_graph_is_clean,_and_the_`default`_profile_names_no_runtime
  Scenario: The seeded releases and profiles form a clean graph with a default profile
    Given the releases and profiles loaded from the harness "tool-releases" directory
    When toolReleaseGraphProblems checks them
    Then there are no problems
    And the profile names include "default"
