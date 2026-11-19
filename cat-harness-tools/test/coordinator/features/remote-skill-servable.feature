# Specifies remotePackageDeclarations and knownSkills
# (scripts/known-skills.ts) and the synced packages of
# scripts/sync-remote-skills.ts, over the cat-harness instance in the checkout.
Feature: Every skill a remote package declares can be served, and the formerly unservable names are real

  @test:test/coordinator/remote-skill-servable.test.ts::remote-package_declarations_vs_what_this_instance_can_serve::there_are_declarations_to_check
  Scenario: There are remote-package declarations to check
    Given the cat-harness instance in the checkout
    When its remote-package declarations are read
    Then there is at least one

  @test:test/coordinator/remote-skill-servable.test.ts::remote-package_declarations_vs_what_this_instance_can_serve::the_unservable_set_is_exactly_the_known_one_—_it_has_not_grown_or_vanished
  Scenario: No declared skill is unservable
    Given the remote-package declarations and the known skills
    When the declared skills that are not known are collected
    Then there are none

  @test:test/coordinator/remote-skill-servable.test.ts::remote-package_declarations_vs_what_this_instance_can_serve::each_synced_name_is_still_declared,_served,_and_materialized_—_not_a_stub
  Scenario: Each materialized skill is declared, served, pinned and not a stub
    Given hypothesis-generation, scientific-critical-thinking and scientific-visualization
    When each is looked up
    Then it is declared by a wrapper and is a known skill
    And some wrapper's skills directory has its materialization.json
    And that record lists at least one file, each with a sha256 fixity
    And its skill file has no "stub:" line

  @test:test/coordinator/remote-skill-servable.test.ts::remote-package_declarations_vs_what_this_instance_can_serve::the_two_FHIR_names_are_authored_in_fhir-harness,_and_no_wrapper_claims_them
  Scenario: The two FHIR names are authored in fhir-harness and declared by no wrapper
    Given fhir-client-operations and smart-launch
    When each is looked up
    Then no remote package declares it
    And its file under fhir-harness/skills/fhir-client starts with front matter
    And it has no "stub:" line

  @test:test/coordinator/remote-skill-servable.test.ts::remote-package_declarations_vs_what_this_instance_can_serve::every_declared_skill_names_a_wrapper_that_exists,_so_a_finding_is_actionable
  Scenario: Every declaration names a .json wrapper file that exists and lists the skill
    Given the remote-package declarations
    When each is read
    Then its file ends with ".json"
    And its skill name is not empty
    And a file of that name is in the "remote-packages" directory of at least one declared skills root
    And at least one such file lists the skill among its wrapper's skills

  @test:test/coordinator/remote-skill-servable.test.ts::remote-package_declarations_vs_what_this_instance_can_serve::every_declared_skill_comes_from_a_wrapper_that_syncs,_pinned,_never_auto-updating
  Scenario: Every declared skill comes from a pinned sync that does not auto-update
    Given the remote-package declarations
    When each one's sync is read
    Then it has a sync
    And its autoUpdate is false
