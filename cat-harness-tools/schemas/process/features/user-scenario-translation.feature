# Specifies pipeline/pot-for-user-scenarios.ts and scripts/translate-user-scenarios.ts:
# the translation templates of the user-scenario kind.
Feature: A user scenario's readable text is handed to translators, and its references are not

  @test:pipeline/pot-for-user-scenarios.test.ts::extractUserScenario_—_the_words_a_person_reads,_and_nothing_a_machine_resolves::titles,_narrative,_experiences,_record_and_handoff_text_are_extracted,_each_with_its_field_as_context
  Scenario: The text a person reads is extracted with its field as context
    Given a user scenario with a title, a step narrative, an experience, a record and a handoff
    When its template is extracted
    Then each of those texts is an entry whose msgctxt is its field path

  @test:pipeline/pot-for-user-scenarios.test.ts::extractUserScenario_—_the_words_a_person_reads,_and_nothing_a_machine_resolves::ids,_hrefs,_ladder_codes,_actor_ids,_resource_keys_and_profiles_are_never_extracted
  Scenario: Ids, links and codes are never handed to a translator
    Given the same scenario, which names ids, hrefs, a trust-ladder code, actor ids, a resource key and a profile
    When its template is extracted
    Then none of them is an entry

  @test:pipeline/pot-for-user-scenarios.test.ts::extractUserScenario_—_the_words_a_person_reads,_and_nothing_a_machine_resolves::a_field_path's_context_drops_the_array_markers_and_reads_steps_as_step
  Scenario: A field's context is its path without array markers
    Given the field path of an experience's doing
    Then its context is "step.experiences.doing"

  @test:pipeline/pot-for-user-scenarios.test.ts::translate-user-scenarios_—_templates_per_locale,_and_--check::--check_fails_on_a_missing_template,_--extract_writes_it,_then_--check_passes;_no_user-scenario_directory_exits_2
  Scenario: The check fails until the templates are extracted
    Given an instance declaring a user-scenario directory and one locale
    When the check runs before extraction it fails
    And after extraction it passes
    And an instance with no user-scenario directory exits 2
