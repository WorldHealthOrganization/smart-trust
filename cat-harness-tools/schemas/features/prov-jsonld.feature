# schemas/kg/prov-jsonld.ts emits PROV-JSONLD for task activities, turning agents, roles, plans, used
# items and decision-record citations into links at their release addresses, checked by expanding with a real JSON-LD processor.
# Each Scenario names the test that executes it.
Feature: PROV-JSONLD emission expands to links

  @test:schemas/prov-jsonld.test.ts::the_held_PROV-JSONLD_context::matches_its_pinned_sha256,_and_is_the_JSON-LD_1.1_context_it_claims_to_be
  Scenario: The held PROV-JSONLD context is a JSON-LD 1.1 context for PROV
    # Gap: the test does not itself compare the context against its pinned sha256
    Given the checkout
    When the held PROV-JSONLD context is read
    Then its "@version" is 1.1
    And its "prov" prefix is the PROV-O namespace

  @test:schemas/prov-jsonld.test.ts::provJsonldDocument_—_a_real_checkout's_actors,_roles_and_plans::agent,_role_and_plan_expand_to_LINKS_at_their_release_addresses,_not_literals
  Scenario: Agent, role and plan expand to links at their release addresses
    Given an activity by "owner" as "authoring-agent" following "code-change-review#Task_ClaimBean"
    When its PROV-JSONLD document is built from the checkout's address book and expanded
    Then nothing is unaddressed
    And the association's agent links to the cat-harness v0 actors address for "owner"
    And its role links to the cat-harness v0 roles address for "authoring-agent"
    And its plan links to the cat-harness v0 processes address for "code-change-review/Task_ClaimBean"

  @test:schemas/prov-jsonld.test.ts::provJsonldDocument_—_a_real_checkout's_actors,_roles_and_plans::the_activity_is_joined_to_its_association_through_@reverse_prov:qualifiedAssociation
  Scenario: The activity is joined to its association through a reverse qualifiedAssociation
    Given the same activity, expanded
    Then the activity's id is "https://litlfred.github.io/folio/t--x#1" and it has a start time
    And the association's "@reverse" qualifiedAssociation links to that activity id

  @test:schemas/prov-jsonld.test.ts::provJsonldDocument_—_a_real_checkout's_actors,_roles_and_plans::underPolicy's_IRIs_are_links_too
  Scenario: The underPolicy value expands to a link
    Given an activity under the policy "https://litlfred.github.io/folio-assistant/policies/folio-defaults"
    When its document is expanded
    Then the activity's underPolicy is a link to that policy IRI

  @test:schemas/prov-jsonld.test.ts::provJsonldDocument_—_a_real_checkout's_actors,_roles_and_plans::an_owner_with_no_iriBase_keeps_the_value_a_LITERAL_and_says_why_—_never_a_relative_IRI
  Scenario: A plan whose owner declares no iriBase stays a literal and is reported
    Given an activity following "render-kg-to-github-pages#Task_Scope", held by a layer with no iriBase
    When its PROV-JSONLD document is built and expanded
    Then one value is unaddressed, of kind "plan", with a reason containing "declares no iriBase"
    And the association's plan is the literal "render-kg-to-github-pages#Task_Scope"

  @test:schemas/prov-jsonld.test.ts::provJsonldDocument_—_a_real_checkout's_actors,_roles_and_plans::an_id_nobody_declares_is_unaddressed,_with_the_reason
  Scenario: An agent no instance declares is unaddressed with the reason
    Given an activity by the agent "nobody-at-all"
    When its PROV-JSONLD document is built
    Then the only unaddressed value is the "agent", because no instance in this checkout declares actor "nobody-at-all"

  @test:schemas/prov-jsonld.test.ts::prov:used_—_catalogue_items_linked_at_their_Handle_(owner_2026-10-01,_option_A)::an_item_nobody_catalogues_stays_a_literal,_with_the_reason
  Scenario: A used item no instance catalogues stays a literal with the reason
    Given an activity that used "item/not-catalogued"
    When its PROV-JSONLD document is built and expanded
    Then the only unaddressed value is the "entity", because no instance in this checkout catalogues "item/not-catalogued"
    And the activity's used value is the literal "item/not-catalogued"

  @test:schemas/prov-jsonld.test.ts::prov:wasInformedBy_—_a_link_to_another_activity_(bean_w1gy)::each_value_is_emitted_as_an_@id_link_and_expands_to_the_PROV-O_property
  Scenario: A wasInformedBy value is emitted as a link
    Given an activity informed by "https://example.org/step/0" and a stub address book
    When its document is built and expanded
    Then the activity's PROV-O wasInformedBy is a link to "https://example.org/step/0"

  @test:schemas/prov-jsonld.test.ts::the_context_is_named,_never_fetched::documents_reference_the_published_URL_and_carry_@base_in_their_OWN_context
  Scenario: A document names the published context URL and carries @base in its own context
    Given a stub address book
    When a document with no activities is built
    Then its first context entry is the published PROV-JSONLD context URL
    And its second context entry defines "@base"

  @test:schemas/prov-jsonld.test.ts::subject_IRIs_beside_the_release_addresses_(issue_#959,_owner_2026-10-30_option_A)::plan_and_role_subjects_are_links;_the_stored_short_reference_stays_the_plan
  Scenario: Plan and role subjects are added as links while the plan stays the release address
    Given an address book giving release addresses and subject IRIs for plans and roles but not agents
    When a document is built for "owner" as "merge-steward" following "merge-train#Task_ReadLive"
    Then the association's plan is the release address for "merge-train#Task_ReadLive"
    And its planSubject is "https://example.org/kg/plan/merge-train/node/Task_ReadLive"
    And its roleSubject is "https://example.org/kg/role/merge-steward"
    And it has no agentSubject
    And the expanded planSubject is a link to the plan subject IRI

  @test:schemas/prov-jsonld.test.ts::subject_IRIs_beside_the_release_addresses_(issue_#959,_owner_2026-10-30_option_A)::a_book_without_subjects_publishes_only_the_release_addresses
  Scenario: An address book without subjects publishes no subject terms
    Given an address book giving only release addresses
    When the same document is built
    Then the association has no key ending in "Subject"

  @test:schemas/prov-jsonld.test.ts::processHolding_—_the_process_a_task_belongs_to::each_task_resolves_to_its_own_process;_unknown_ids_and_ids_outside_any_process_to_none
  Scenario: A task resolves to the process that holds it
    Given a BPMN diagram with task "T1" in process "A", user task "T2" in process "B", and participant "P1"
    Then "T1" is held by "A"
    And "T2" is held by "B"
    And "nope" and "P1" are held by no process

  @test:schemas/prov-jsonld.test.ts::decision_records_cite_agreement_and_grant_with_standard_terms_(bean_yy40)::the_agreement_is_a_prov:used_dcat:Distribution_with_spdx:checksum,_the_grant_a_VC;_the_hash_chain_is_labelled_a_local_extension
  Scenario: A decision record cites its agreement and grant with standard terms
    Given a stamped decision record that used an agreement distribution with a sha256 checksum and a grant credential
    When its PROV-JSONLD document is built and expanded
    Then the agreement is typed as a PROV Entity and a DCAT Distribution
    And its SPDX checksum has algorithm sha256 and the hexBinary checksum value
    And the grant is typed as a PROV Entity and a Verifiable Credential
    And the activity has no agreement or grant term of its own
    And "previousHash" and "recordHash" each carry an rdfs comment starting "Local extension"
