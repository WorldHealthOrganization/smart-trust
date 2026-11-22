# A remote declaration is not resolution (bean nup0): a skill only a file
# under skills/remote-packages/ names is not servable, though it is still
# recognised as declared. Each Scenario names the test that executes it.
Feature: A remote-declared skill is not a servable skill

  @test:scripts/tests/manifest-remote-readers.test.ts::a_manifest_entry_supplied_only_by_a_remote_package::is_NOT_servable_by_this_instance
  Scenario: A manifest entry supplied only by a remote package is not servable
    Given a package naming a held skill and a skill only a remote package declares
    When the servable skills are read
    Then the held skill is servable and the remote-only skill is not

  @test:scripts/tests/manifest-remote-readers.test.ts::a_manifest_entry_supplied_only_by_a_remote_package::is_still_recognised_as_declared,_so_a_finding_can_say_WHICH_problem_it_is
  Scenario: A remote-only entry is still recognised as declared
    Given the same package
    Then the remote package skills include the remote-only skill
    And the manifest-resolvable skills include both the remote-only and the held skill

  @test:scripts/tests/manifest-remote-readers.test.ts::the_reason_the_allowance_was_closed_is_still_true::every_reader_of_skills/remote-packages/_is_accounted_for,_and_none_serves_a_body
  Scenario: Every reader of skills/remote-packages/ is accounted for
    When this layer's non-schema, non-test .ts files whose code quotes a remote-packages path are found
    Then they are exactly kg-audit.ts, known-skills.ts, partition/instance-rules.ts and sync-remote-skills.ts

  @test:scripts/tests/manifest-remote-readers.test.ts::the_reason_the_allowance_was_closed_is_still_true::kg-audit_no_longer_excuses_a_remote-declared_entry
  Scenario: kg-audit no longer excuses a remote-declared entry
    When kg-audit.ts is read
    Then it does not filter entries out for being remote-declared
    And it still tests remote.has(e.skill) to tell the remedies apart
