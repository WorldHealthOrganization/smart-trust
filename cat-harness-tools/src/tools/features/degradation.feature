# src/tools/degradation.ts joins each skill's required capabilities with what is present and gives
# a verdict (ready, partial, degraded or blocked) that keeps "ran with less" apart from "did not run".
# Each Scenario names the test that executes it.
Feature: Skill availability under missing capabilities

  @test:src/tools/degradation.test.ts::each_strategy_maps_to_a_distinct_verdict::everything_present_is_ready,_with_nothing_to_say
  Scenario: Everything present is ready, with nothing to say
    Given a skill requiring the present capability "present-tool" with strategy "fail"
    When its availability is computed
    Then its state is "ready"
    And it gives no reasons

  @test:src/tools/degradation.test.ts::each_strategy_maps_to_a_distinct_verdict::`fail`_on_an_absent_capability_blocks,_and_names_it
  Scenario: Strategy "fail" on an absent capability blocks, and names it
    Given a skill requiring the absent capability "absent-tool" with strategy "fail"
    When its availability is computed
    Then its state is "blocked"
    And it is blocked by "absent-tool" alone

  @test:src/tools/degradation.test.ts::each_strategy_maps_to_a_distinct_verdict::`warn`_is_degraded,_not_blocked_—_the_skill_still_runs
  Scenario: Strategy "warn" is degraded, not blocked, so the skill still runs
    Given a skill requiring the absent capability "absent-tool" with strategy "warn"
    When its availability is computed
    Then its state is "degraded"
    And it is blocked by nothing

  @test:src/tools/degradation.test.ts::each_strategy_maps_to_a_distinct_verdict::`skip`_is_partial_—_the_requirement_is_dropped,_not_the_skill
  Scenario: Strategy "skip" is partial: the requirement is dropped, not the skill
    Given a skill requiring the absent capability "absent-tool" with strategy "skip"
    When its availability is computed
    Then its state is "partial"

  @test:src/tools/degradation.test.ts::each_strategy_maps_to_a_distinct_verdict::`fallback`_uses_the_capability's_substitute_when_it_is_present
  Scenario: Strategy "fallback" uses the capability's substitute when it is present
    Given a skill requiring the absent capability "has-substitute", whose fallback "present-tool" is present, with strategy "fallback"
    When its availability is computed
    Then its state is "degraded"
    And it records using the fallback from "has-substitute" to "present-tool"

  @test:src/tools/degradation.test.ts::each_strategy_maps_to_a_distinct_verdict::`fallback`_blocks_when_the_substitute_is_absent_too
  Scenario: Strategy "fallback" blocks when the substitute is absent too
    Given a skill requiring the absent capability "dead-substitute", whose fallback "absent-tool" is absent, with strategy "fallback"
    When its availability is computed
    Then its state is "blocked"
    And its first reason says the substitute is "absent too"

  @test:src/tools/degradation.test.ts::the_human_route::a_person_takes_over_when_no_capability_can,_and_that_is_DEGRADED_not_blocked
  Scenario: A person takes over when no capability can, and that is degraded, not blocked
    Given a skill requiring "absent-tool" with strategy "fallback" and no substitute
    And a human lane offering the role "publication-manager"
    When its availability is computed
    Then its state is "degraded"
    And it records "absent-tool" as taken over by the role "publication-manager"

  @test:src/tools/degradation.test.ts::the_human_route::with_no_human_lane_it_blocks,_and_says_both_things_it_looked_for
  Scenario: With no human lane the fallback blocks, and says both things it looked for
    Given a skill requiring "absent-tool" with strategy "fallback" and no substitute
    And no human lane
    When its availability is computed
    Then its state is "blocked"
    And its first reason says there is "no `fallbackTo`" and "no human lane"

  @test:src/tools/degradation.test.ts::the_guards::an_UNDECLARED_capability_blocks_rather_than_being_ignored
  Scenario: An undeclared capability blocks rather than being ignored
    Given a skill requiring "never-declared", which no capability declares, with strategy "warn"
    When its availability is computed
    Then its state is "blocked"
    And its first reason says the capability "cannot be established"

  @test:src/tools/degradation.test.ts::the_guards::a_skill's_state_is_the_WORST_of_its_requirements
  Scenario: A skill's state is the worst of its requirements
    Given a skill requiring "present-tool" with "fail", "absent-tool" with "skip" and "absent-tool" with "fail"
    When its availability is computed
    Then its state is "blocked"

  @test:src/tools/degradation.test.ts::the_guards::an_empty_corpus_says_it_checked_nothing_rather_than_printing_a_tick
  Scenario: An empty corpus says it checked nothing rather than printing a tick
    Given no skill availability rows
    When they are formatted
    Then the text says "nothing was checked"

  @test:src/tools/degradation.test.ts::loading_the_graph_must_not_RUN_it_(bean_`ymsu`)::a_module_that_declares_no_capabilities_is_NEVER_imported,_so_its_side_effects_never_run
  Scenario: A module that declares no capabilities is never imported, so its side effects never run
    Given a graph root holding only a script that writes a "RAN" marker at top level
    When the skill needs are loaded from that root
    Then no skill is loaded
    And the "RAN" marker does not exist

  @test:src/tools/degradation.test.ts::loading_the_graph_must_not_RUN_it_(bean_`ymsu`)::...and_one_that_DOES_declare_them_is_still_imported,_so_the_filter_has_not_eaten_the_feature
  Scenario: A module that does declare capabilities is still imported
    Given a graph root holding a module exporting a skill "probe" with a required capability
    When the skill needs are loaded from that root
    Then nothing is unreadable
    And the skills loaded are exactly "probe"

  @test:src/tools/degradation.test.ts::loading_the_graph_must_not_RUN_it_(bean_`ymsu`)::a_module_that_names_the_field_and_will_not_import_is_REPORTED,_not_skipped
  Scenario: A module that names the field and will not import is reported, not skipped
    Given a graph root holding "broken.ts", which names requiredCapabilities but is not valid TypeScript
    When the skill needs are loaded from that root
    Then no skill is loaded
    And exactly one file is reported unreadable, naming "broken.ts"

  @test:src/tools/degradation.test.ts::over_the_real_corpus::the_skills_load,_and_none_is_unreadable
  Scenario: The harness's skills load, and none is unreadable
    Given the harness's knowledge-graph roots
    When the skill needs are loaded from them
    Then nothing is unreadable
    And more than 10 skills are loaded
    And every skill requires at least one capability

  @test:src/tools/degradation.test.ts::over_the_real_corpus::every_capability_a_skill_requires_is_DECLARED
  Scenario: Every capability a skill requires is declared
    Given the harness's skills and its declared capabilities
    Then more than 5 capabilities are declared
    And no capability any skill requires is undeclared

  @test:src/tools/degradation.test.ts::over_the_real_corpus::the_real_join_runs_and_produces_a_verdict_per_skill
  Scenario: The real join runs and produces a verdict per skill
    Given the harness's skills and its declared capabilities, probed on this machine
    When the availability of every skill is computed
    Then there is one row per skill
    And each row's state is one of "ready", "partial", "degraded" or "blocked"
