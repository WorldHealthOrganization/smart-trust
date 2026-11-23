# Specifies schemas/content/odrl.ts, ODRL 2.2 policies (issue #1180): the
# policies committed in the harness (read from CAT_HARNESS_ROOT) and the
# migration of actor permissions into them; permits(), which answers permit,
# deny or unknown; OdrlPolicySchema's refusals; the computable DSA constraints
# and duties (bean s4v2); the obtainConsent duty evaluated by an injected
# ConsentEvaluator (beans a7c1, 2egb, 6jnx); and the PROV-O activity schema
# from prov.ts as the policies use it.
Feature: ODRL policies decide who may do what, answering permit, deny or unknown

  @test:schemas/content/odrl.test.ts::the_policies_in_this_repository::there_is_a_policy,_and_it_parses_(vacuity_guard)
  Scenario: The harness has at least one policy, and it parses
    When the harness's policies directory is read
    Then at least one policy is found

  @test:schemas/content/odrl.test.ts::the_policies_in_this_repository::no_actor_file_still_carries_its_own_permissions_list
  Scenario: No actor file carries its own permissions list
    When the actors are read without the policies' grants
    Then no actor has a permissions list

  @test:schemas/content/odrl.test.ts::the_policies_in_this_repository::the_migration_moved_every_permission,_and_added_none
  Scenario: The migration moved every permission and added none
    Given each actor's permissions as its file listed them before the migration, for the actors still declared here
    When the actors are read with the policies' grants
    Then each of those actors has exactly its earlier permissions

  @test:schemas/content/odrl.test.ts::the_policies_in_this_repository::every_assignee_is_an_actor_or_anyone,_and_every_action_is_in_the_profile
  Scenario: Every assignee is an actor or anyone, and every action is in the profile
    When the effective rules of the first policy are taken
    Then every permission's and prohibition's assignee is anyone or a declared actor
    And every action is in the action graph read from the harness's skills

  @test:schemas/content/odrl.test.ts::the_policies_in_this_repository::in_the_checkout,_every_assignee_of_every_instance's_policy_is_an_actor_the_checkout_declares
  Scenario: Across the checkout, every policy's assignee is a declared actor
    When the policies and actors of every instance in the checkout are read
    Then every assignee other than anyone is one of those actors

  @test:schemas/content/odrl.test.ts::the_policies_in_this_repository::every_profile_action_reaches_odrl:use
  Scenario: Every profile action reaches odrl:use
    When the broader actions of each action in the graph are taken
    Then each includes "odrl:use"

  @test:schemas/content/odrl.test.ts::the_policies_in_this_repository::an_unauthenticated_reader_may_visualize_and_render,_and_nothing_else_(owner,_2026-09-23)
  Scenario: An unauthenticated reader may visualize and render, and nothing else
    When a request with no actor asks for each action under the harness's policies
    Then "visualize" and "render" are permitted
    And no other action outside the "odrl:" vocabulary is permitted

  @test:schemas/content/odrl.test.ts::the_policies_in_this_repository::a_migrated_grant_still_holds:_admin_may_administer_roles,_author_may_not
  Scenario: Admin may manage roles; author is not permitted
    When "admin" and "author" each ask for "role-management" under the harness's policies
    Then admin is permitted
    And author's answer is unknown

  @test:schemas/content/odrl.test.ts::permits():_three_answers::a_grant_of_a_broader_action_permits_the_actions_included_in_it,_not_the_reverse
  Scenario: A broader grant permits the narrower action, not the reverse
    Given an action graph where "approve" is included in "perform-task", included in "odrl:execute"
    When actor "a", granted "perform-task", asks for "approve"
    Then it is permitted
    When actor "a", granted only "approve", asks for "perform-task"
    Then the answer is unknown

  @test:schemas/content/odrl.test.ts::permits():_three_answers::no_rule_is_unknown,_never_permit
  Scenario: No rule gives unknown
    Given a policy with no rules
    When actor "a" asks for "approve"
    Then the answer is unknown

  @test:schemas/content/odrl.test.ts::permits():_three_answers::a_scoped_grant_holds_only_in_its_scope,_and_an_unstated_scope_does_not_satisfy_it
  Scenario: A scoped grant holds only in its scope
    Given actor "a" granted "approve" only where the process equals "release"
    When it asks in the process "release", in "authoring", and with no scope
    Then the first is permitted
    And the other two are unknown

  @test:schemas/content/odrl.test.ts::permits():_three_answers::performing_a_task_in_a_lane_needs_the_lane's_role_as_well_as_the_permission
  Scenario: A task in a lane needs the lane's role as well as the permission
    Given actor "a" granted "approve"
    When it asks for "approve" in the lane of role "reviewer", holding "reviewer", holding "author", and declaring no roles
    Then holding "reviewer" is permitted
    And holding "author" is denied
    And declaring no roles is permitted

  @test:schemas/content/odrl.test.ts::permits():_three_answers::the_default_conflict_strategy_is_prohibit_—_a_ruled_profile_departure_from_ODRL's_invalid_(bean_jcet)
  Scenario: The default conflict strategy is prohibit
    When the folio default conflict strategy is read
    Then it is "odrl:prohibit"

  @test:schemas/content/odrl.test.ts::permits():_three_answers::permission_and_prohibition_together:_prohibit_by_default,_perm_when_the_policy_says_so,_invalid_voids
  Scenario: A permission and prohibition together follow the conflict strategy
    Given actor "a" both permitted and prohibited "approve"
    When it asks under the default strategy, under "odrl:perm", and under "odrl:invalid"
    Then the answers are deny, permit and deny

  @test:schemas/content/odrl.test.ts::permits():_three_answers::an_includedIn_cycle_does_not_hang,_and_the_graph_need_not_have_one_root
  Scenario: An includedIn cycle does not hang, and a graph may have several roots
    Given an action graph where "x" is included in "y", and "y" in "x" and "odrl:use"
    When the broader actions of "x" are taken
    Then they are "odrl:use", "x" and "y"
    Given an action graph where "p" is included in "r1" and "r2", which are included in nothing
    Then the broader actions of "p" are "p", "r1" and "r2"
    And the broader actions of each root "r1", "r2" and "odrl:use" are only itself

  @test:schemas/content/odrl.test.ts::permits():_three_answers::inheritFrom_brings_the_parent's_rules;_a_dangling_one_throws
  Scenario: inheritFrom brings the parent's rules; a dangling one throws
    Given a parent policy granting actor "a" "approve", and a child inheriting from it
    When actor "a" asks for "approve" under the child
    Then it is permitted
    When the effective rules are taken of a policy inheriting from an undeclared uid
    Then it throws saying it is not declared

  @test:schemas/content/odrl.test.ts::the_schema_refuses_what_it_cannot_mean::an_unknown_key_on_a_rule_is_refused,_not_dropped
  Scenario: An unknown or empty extra key on a rule is refused
    When policies whose permission carries "remedy": [] or "duty": [] are parsed
    Then both are refused

  @test:schemas/content/odrl.test.ts::the_schema_refuses_what_it_cannot_mean::an_Agreement_names_both_its_assigner_and_its_assignee_(ODRL_2.2_§2.1.3)
  Scenario: An Agreement names both its assigner and its assignee
    When Agreements with neither, only an assigner, only an assignee, and both are parsed
    Then only the one with both is accepted

  @test:schemas/content/odrl.test.ts::the_schema_refuses_what_it_cannot_mean::isAnyOf_takes_a_list_and_eq_takes_one_value
  Scenario: isAnyOf takes a list and eq takes one value
    When constraints with isAnyOf on a string, isAnyOf on a list, and eq on a list are parsed
    Then only isAnyOf on a list is accepted

  @test:schemas/content/odrl.test.ts::the_schema_refuses_what_it_cannot_mean::a_scope_outside_Process,_Task,_Role,_purpose,_dateTime_and_elapsedTime_is_refused
  Scenario: A constraint outside the six scopes is refused, and each of the six is accepted
    When constraints with the left operands "odrl:spatial", "odrl:count", "odrl:recipient", "odrl:industry", "odrl:event", "cat-harness:folio" and "process" are parsed
    Then each is refused
    When constraints on "cat-harness:process", "cat-harness:task", "cat-harness:role", purpose, dateTime and elapsedTime are parsed, the last three both "odrl:"-prefixed and unprefixed, each with a value of its kind
    Then each is accepted

  @test:schemas/content/odrl.test.ts::the_schema_refuses_what_it_cannot_mean::a_purpose_constraint_accepts_HL7_PurposeOfUse_codes_and_refuses_draft_vocabularies_(DPV)
  Scenario: A purpose constraint accepts an HL7 PurposeOfUse code and refuses DPV
    When purpose isA constraints on "HRESCH" and on "dpv:ResearchAndDevelopment" are parsed
    Then the first is accepted
    And the second is refused

  @test:schemas/content/odrl.test.ts::the_schema_refuses_what_it_cannot_mean::a_duty_accepts_only_the_supported_ODRL_duty_actions_(delete,_attribute,_inform,_obtainConsent)
  Scenario: A duty accepts only the four supported duty actions
    When duties with the actions "odrl:delete", "odrl:attribute", "odrl:inform" and "odrl:obtainConsent" are parsed
    Then each is accepted
    And so is each of their unprefixed spellings
    When duties with the actions "odrl:compensate", "compensate", "odrl:anonymize", "odrl:archive", "odrl:nextPolicy", "odrl:use", "odrl:read", "b" and the empty string are parsed
    Then each is refused

  @test:schemas/content/odrl.test.ts::computable_DSA_constraints_and_duties_(bean_s4v2)::purpose_isA_HL7_PurposeOfUse_HRESCH_permits_a_subclass_purpose_and_denies_an_unrelated_one
  Scenario: Purpose isA HRESCH permits its subclasses and denies unrelated purposes
    Given an Agreement from "org:who" to "org:ministry" permitting "odrl:use" for a purpose that isA "HRESCH"
    When "org:ministry" asks to "read-dataset" for each purpose
    Then "HRESCH", "BIORCH", "CLINTRCH" and "CLINTRCHPC" are permitted
    And "TREAT", "PUBHLTH" and "HMARKT" are denied
    And with no purpose the answer is unknown

  @test:schemas/content/odrl.test.ts::computable_DSA_constraints_and_duties_(bean_s4v2)::dateTime_lt_permits_before_and_denies_after_(and_lteq/gt/gteq_evaluate_boundaries)
  Scenario: dateTime lt, lteq, gt and gteq each decide before, at and after the bound
    Given an Agreement permitting "odrl:use" while the dateTime is before "2026-12-31T00:00:00Z"
    When "org:ministry" asks to "read-dataset" at 2026-06-15, at exactly the bound, at 2027-01-01, and with no dateTime
    Then the answers are permit, deny, deny and unknown
    When the same is asked, before, at and after the bound, of the Agreement with the operator lteq, gt and gteq in turn
    Then lteq answers permit, permit, deny
    And gt answers deny, deny, permit
    And gteq answers deny, permit, permit

  @test:schemas/content/odrl.test.ts::computable_DSA_constraints_and_duties_(bean_s4v2)::a_90-day_delete_duty:_permit_inside_90_days;_after,_deny_without_a_deletion_PROV_record,_permit_with_one,_unknown_when_records_are_absent
  Scenario: A 90-day delete duty follows the deletion PROV record
    Given an Agreement "urn:dsa:90d" permitting use of "dataset: cholera-2026" with a duty to delete within P90D
    And a PROV record of the delete task and one of an analyze task, both on that dataset under that agreement
    When "org:ministry" asks to read the dataset after each elapsed time
    Then P30D with no records given, and P90D with none, are permitted
    And P91D with none, and P100D with only the analyze record, are denied
    And P91D with the delete record, and P120D with both, are permitted
    And P91D with no records given at all is unknown

  @test:schemas/content/odrl.test.ts::computable_DSA_constraints_and_duties_(bean_s4v2)::immediate_duties_(attribute,_inform,_obtainConsent):_permit_when_fulfilled,_deny_when_unmet,_unknown_when_records_are_absent
  Scenario: Attribute, inform and obtainConsent duties: permit when fulfilled, deny when unmet, unknown when absent
    Given an Agreement "urn:dsa:attr" permitting use with duties to attribute and to inform
    And PROV records of the attribute task and the inform task under it
    When "org:ministry" asks to "read-dataset" with no records, with the attribute record, and with both
    Then the answers are unknown, deny and permit
    Given an Agreement "urn:dsa:consent" permitting use with a duty to obtainConsent
    And a PROV record of the obtainConsent task under it
    When "org:ministry" asks with no records, with that record, and with a consent verdict of deny
    Then the answers are unknown, permit and deny
    And with only the attribute record, which does not fulfil it, the answer is unknown, not deny

  @test:schemas/content/odrl.test.ts::odrl:obtainConsent_duty_evaluated_via_injected_ConsentEvaluator_(beans_a7c1,_2egb,_6jnx)::DSA_+_no_consent_(or_inactive/draft_consent_returning_unknown)_gives_unknown,_never_permit_or_deny
  Scenario: With no consent verdict, or an unknown one, the answer is unknown
    Given an Agreement "urn:dsa:pcf6" permitting use of "subject:pat-1" for any PurposeOfUse, with an obtainConsent duty
    And a request by "org:ministry" to "read-dataset" on that subject for "TREAT" in June 2026
    When it is decided with no evaluator, with an evaluator answering unknown, and with the precomputed verdict unknown
    Then permits answers unknown each time
    And decide answers unknown with no evaluator and with the unknown evaluator

  @test:schemas/content/odrl.test.ts::odrl:obtainConsent_duty_evaluated_via_injected_ConsentEvaluator_(beans_a7c1,_2egb,_6jnx)::DSA_+_deny_consent_gives_deny_and_surfaces_the_deciding_citation
  Scenario: A deny consent gives deny and surfaces the deciding citation
    Given the Agreement "urn:dsa:pcf6" with an obtainConsent duty
    When the request for "TREAT" in June 2026 is decided with an evaluator that always denies, citing "c-dissent" version 2
    Then permitsWithConsent and decideWithConsent both give deny with that citation
    When an evaluator permitting only TREAT purposes during 2026 is asked for "HMARKT" in June 2026, and for "TREAT" in February 2027
    Then both are denied

  @test:schemas/content/odrl.test.ts::odrl:obtainConsent_duty_evaluated_via_injected_ConsentEvaluator_(beans_a7c1,_2egb,_6jnx)::DSA_+_matching_active_permit_consent_gives_permit_(for_exact_and_subclass_HL7_PurposeOfUse)_and_surfaces_citation
  Scenario: A matching permit consent gives permit with its citation
    Given the Agreement "urn:dsa:pcf6" and an evaluator permitting TREAT and its subclasses during 2026, citing "c-permit" version 1
    When "org:ministry" asks in June 2026 for "TREAT", "ETREAT", "BTG", "CLINTRL", "POPHLTH" and "COC"
    Then each gives permit with that citation
    And decideWithConsent for "TREAT" gives permit with that citation

  @test:schemas/content/odrl.test.ts::odrl:obtainConsent_duty_evaluated_via_injected_ConsentEvaluator_(beans_a7c1,_2egb,_6jnx)::schemas/content/odrl.ts_names_no_FHIR_resource_and_no_pcf:_key,_and_reads_HL7_PurposeOfUse_from_published_v3-ActReason
  Scenario: odrl.ts names no FHIR resource or pcf key, and its PurposeOfUse matches the pinned fixture
    When the source of odrl.ts is read
    Then it contains none of "pcf:", "FhirConsent", "PcfConsent", nor the words Bundle, OperationOutcome, Patient, Practitioner or Encounter
    And the SHA-256 of the v3-ActReason fixture equals the one its provenance records
    And CLINTRL, POPHLTH and COC are subsumed by TREAT; CAREMGT by HOPERAT; HTEST by SYSDEV; LABELING and METAMGT by HSYSADMIN
    And odrl.ts's PurposeOfUse table equals what its loader reads from that fixture file
    And odrl.ts defines that table as the loader's result
    And HAAUTH is absent, and there are 60 codes

  @test:schemas/content/odrl.test.ts::PROV-O_activity::a_task_run_parses
  Scenario: A task run parses
    Given a PROV activity of "authoring-agent" in the role "author" with the plan "content-lifecycle#Task_author", under a policy
    When it is parsed with the activity schema
    Then it is accepted

  @test:schemas/content/odrl.test.ts::PROV-O_activity::hadPlan_must_name_a_BPMN_process_and_task
  Scenario: A plan naming no BPMN process and task is refused
    Given the "authoring-agent" task run with the plan "author"
    When it is parsed with the activity schema
    Then it is refused

  @test:schemas/content/odrl.test.ts::PROV-O_activity::a_run_under_no_policy_cannot_be_checked,_so_it_is_refused
  Scenario: A run under no policy is refused
    Given the "authoring-agent" task run with no policy
    When it is parsed with the activity schema
    Then it is refused

  @test:schemas/content/odrl.test.ts::PROV-O_activity::several_policies_in_force_are_listed,_and_an_empty_list_is_still_no_policy
  Scenario: Several policies may be listed, but an empty list is no policy
    When the "authoring-agent" task run is parsed under ["urn:a", "urn:b"], and under []
    Then the first is accepted
    And the second is refused

  @test:schemas/content/odrl.test.ts::PROV-O_activity::it_cannot_end_before_it_starts
  Scenario: A run cannot end before it starts
    Given the "authoring-agent" task run ending at 19:00, before it started at 19:36:08
    When it is parsed with the activity schema
    Then it is refused
