# Voice profiles (schemas/content/voices.ts): resolveVoice unions a voice's rules with those it extends,
# voiceActiveIn and ruleAppliesHere scope them, and provenance and supersession are structural.
# Each Scenario names the test that executes it.
Feature: Voice inheritance, applicability and provenance

  @test:schemas/voice-inheritance.test.ts::rules_UNION,_because_two_vendors_agreeing_is_evidence::a_child_keeps_the_base's_rules_and_adds_its_own
  Scenario: A child voice keeps its base's rules and adds its own
    Given a base voice "skill-authoring" with rules "degrees-of-freedom" and "concise"
    And a child voice "skill-authoring-claude" extending it with rule "gerund-names"
    When the child is resolved
    Then resolution succeeds
    And the rule ids are "degrees-of-freedom", "concise", "gerund-names" in that order

  @test:schemas/voice-inheritance.test.ts::rules_UNION,_because_two_vendors_agreeing_is_evidence::and_says_WHERE_each_rule_came_from_—_otherwise_the_union_is_untraceable
  Scenario: A resolved voice records which voice each rule came from
    Given a base voice "skill-authoring" with rule "degrees-of-freedom"
    And a child voice "skill-authoring-gemini" extending it with rule "progressive-disclosure"
    When the child is resolved in instance "agent-skills"
    Then the origin of "degrees-of-freedom" is "agent-skills/skill-authoring"
    And the origin of "progressive-disclosure" is "agent-skills/skill-authoring-gemini"

  @test:schemas/voice-inheritance.test.ts::rules_UNION,_because_two_vendors_agreeing_is_evidence::a_child_overrides_ONLY_by_reusing_a_rule_id,_and_the_base_rule_keeps_its_place
  Scenario: A child overrides a base rule by reusing its id, in the base rule's position
    Given a base voice with rules "a", "b" and "c"
    And a child voice extending it with its own rule "b" described as "the child's version"
    When the child is resolved in instance "i"
    Then the rule ids are "a", "b", "c" in that order
    And rule "b" has the description "the child's version"
    And the origin of "b" is "i/child"

  @test:schemas/voice-inheritance.test.ts::what_is_NOT_inherited::provenance_is_the_child's_own_—_a_vendor_page_does_not_become_evidence
  Scenario: A child voice keeps its own provenance
    Given a base voice with provenance "evidence"
    And a child voice with provenance "assertion" extending it
    When the child is resolved
    Then the resolved provenance is "assertion"

  @test:schemas/voice-inheritance.test.ts::what_is_NOT_inherited::supersession_is_the_child's_own_—_a_live_source_does_not_die_with_its_parent
  Scenario: A child voice does not inherit its base's supersession
    Given a base voice superseded on "2026-06-18" by "Antigravity CLI"
    And a child voice with no supersession extending it
    When the child is resolved
    Then the resolved voice is not superseded

  @test:schemas/voice-inheritance.test.ts::the_chain_has_to_terminate,_and_say_so_when_it_does_not::a_cycle_is_reported_rather_than_hanging
  Scenario: An extends cycle is reported as a failure
    Given voice "a" extending "b" and voice "b" extending "a"
    When "a" is resolved
    Then resolution fails with kind "cycle"
    And the explanation contains "cycle"

  @test:schemas/voice-inheritance.test.ts::the_chain_has_to_terminate,_and_say_so_when_it_does_not::a_voice_extending_one_nothing_serves_names_the_id_and_the_instance
  Scenario: Extending an unknown voice names the missing instance and id
    Given a voice extending voice "missing" in instance "someone/elsewhere"
    And a lookup that serves no voices
    When it is resolved
    Then resolution fails
    And the explanation contains "someone/elsewhere/missing"
    And it contains "voices"

  @test:schemas/voice-inheritance.test.ts::applicability_—_the_CRDM_axis::absent_means_EVERYWHERE,_including_a_context_naming_nothing
  Scenario: A voice with no applicability is active everywhere
    Given a voice with no activeIn
    Then it is active in an empty context
    And it is active in process "Process_Anything" with role "reviewer"

  @test:schemas/voice-inheritance.test.ts::applicability_—_the_CRDM_axis::a_declared_list_is_an_OR_within_itself
  Scenario: A voice is active in any of its listed processes
    Given a voice active in processes "Process_Crdm" and "Process_Review"
    Then it is active in "Process_Review"
    And it is not active in "Process_Publication"

  @test:schemas/voice-inheritance.test.ts::applicability_—_the_CRDM_axis::and_an_AND_across_the_three_—_a_lane-scoped_voice_is_NOT_in_force_anywhere_its_process_runs
  Scenario: A voice scoped to a process and a role is active only where both match
    Given a voice active in process "Process_Crdm" and role "requirements-analyst"
    Then it is active in "Process_Crdm" with role "requirements-analyst"
    And it is not active in "Process_Crdm" with role "reviewer"
    And it is not active in "Process_Crdm" with no role

  @test:schemas/voice-inheritance.test.ts::applicability_—_the_CRDM_axis::an_EMPTY_list_is_refused_—_it_would_switch_the_voice_off_silently
  Scenario: An empty applicability list is refused
    When VoiceApplicabilitySchema parses an empty processes list
    Then the parse fails
    And a processes list of "Process_Crdm" parses

  @test:schemas/voice-inheritance.test.ts::applicability_—_the_CRDM_axis::an_unknown_key_is_refused,_so_a_typo_is_not_a_voice_that_never_activates
  Scenario: An unknown applicability key is refused
    When VoiceApplicabilitySchema parses the key "process" instead of "processes"
    Then the parse fails

  @test:schemas/voice-inheritance.test.ts::provenance_and_supersession_are_structural,_the_rules_are_not::provenance_is_REQUIRED_—_a_voice_that_did_not_classify_itself_does_not_parse
  Scenario: A voice without provenance is refused
    Given a valid voice with its provenance removed
    When VoiceProfileSchema parses it
    Then the parse fails

  @test:schemas/voice-inheritance.test.ts::provenance_and_supersession_are_structural,_the_rules_are_not::the_three_classes_are_the_ones_the_corpus_actually_contains
  Scenario: The provenance classes are assertion, evidence and house
    # Gap: checks the enum's values only; the voice corpus is not read
    When the VOICE_PROVENANCE values are sorted
    Then they are "assertion", "evidence" and "house"

  @test:schemas/voice-inheritance.test.ts::provenance_and_supersession_are_structural,_the_rules_are_not::a_supersession_with_no_successor_is_VALID_—_the_honest_state
  Scenario: A supersession naming no successor voice is valid
    Given a supersession on "2026-06-18" by "Antigravity CLI" with a quote and no successor
    When VoiceSupersessionSchema parses it
    Then the parse succeeds

  @test:schemas/voice-inheritance.test.ts::provenance_and_supersession_are_structural,_the_rules_are_not::but_a_date_that_is_not_a_date_is_refused
  Scenario: A supersession date that is not a date is refused
    Given a supersession on "June 2026"
    When VoiceSupersessionSchema parses it
    Then the parse fails

  @test:schemas/voice-inheritance.test.ts::provenance_and_supersession_are_structural,_the_rules_are_not::a_rule's_CONTENT_is_unconstrained,_deliberately
  Scenario: A rule's description may be any prose
    Given a voice whose rule description is free prose with a caveat and a contradiction
    When VoiceProfileSchema parses it
    Then the parse succeeds

  @test:schemas/voice-inheritance.test.ts::an_inherited_rule_keeps_the_scope_it_was_DECLARED_under::both_rules_are_present_—_inheritance_still_unions
  Scenario: Resolving an unscoped child of a scoped base unions their rules
    Given a base voice "scoped-base" with rule "base-rule", applying to prose and active in "Process_Crdm"
    And a child voice "open-child" with rule "child-rule" and no scope, extending it
    When the child is resolved
    Then the rule ids are "base-rule" then "child-rule"

  @test:schemas/voice-inheritance.test.ts::an_inherited_rule_keeps_the_scope_it_was_DECLARED_under::the_BASE's_rule_is_still_confined_to_prose,_and_to_its_process
  Scenario: An inherited rule stays confined to its base's block kind and process
    Given the resolved unscoped child of the scoped base
    Then "base-rule" applies to a prose block in "Process_Crdm"
    And it does not apply to a theorem block in "Process_Crdm"
    And it does not apply to a prose block in "Process_Review"

  @test:schemas/voice-inheritance.test.ts::an_inherited_rule_keeps_the_scope_it_was_DECLARED_under::the_CHILD's_rule_is_unconfined,_because_its_author_declared_no_scope
  Scenario: The child's own unscoped rule applies everywhere
    Given the resolved unscoped child of the scoped base
    Then "child-rule" applies to a theorem block in "Process_Review"

  @test:schemas/voice-inheritance.test.ts::an_inherited_rule_keeps_the_scope_it_was_DECLARED_under::a_child_overriding_a_rule_id_takes_over_its_scope_—_it_is_the_child's_rule_now
  Scenario: A child overriding a scoped rule gives it the child's scope
    Given an unscoped child voice that redeclares "base-rule" and extends the scoped base
    When it is resolved
    Then "base-rule" applies to a theorem block

  @test:schemas/voice-inheritance.test.ts::an_inherited_rule_keeps_the_scope_it_was_DECLARED_under::an_unknown_rule_id_is_FALSE,_not_'everywhere'
  Scenario: An unknown rule id applies nowhere
    Given the resolved unscoped child of the scoped base
    Then "no-such-rule" does not apply to a prose block

  @test:schemas/voice-inheritance.test.ts::an_inherited_rule_keeps_the_scope_it_was_DECLARED_under::the_voice-level_fields_are_the_START_voice's_own,_and_say_so
  Scenario: The resolved voice-level scope is the start voice's, with per-rule scope kept separately
    Given the resolved unscoped child of the scoped base
    Then its appliesTo is undefined
    And its activeIn is undefined
    And the recorded scope of "base-rule" applies to "prose"
