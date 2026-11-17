# What scripts/tests/kg/kg-export-sidecars.test.ts covers: sidecarSubjects in scripts/kg-export.ts derives the QA sidecars
# kg-export --check verifies from the committed files, reporting any that no layer claims as orphans.
# Each Scenario names the test that executes it.
Feature: kg-export sidecar subjects are derived from what is committed

  @test:scripts/tests/kg/kg-export-sidecars.test.ts::kg-export_sidecar_subjects_are_DERIVED_from_what_is_committed_(bean_`v556`)::the_real_tree:_the_host,_plus_every_committed_foreign_sidecar,_and_no_orphan
  Scenario: The real tree has the host sidecar first, bootstrap's resolved, and no orphan
    Given the real results tree, and a fixture holding the host and bootstrap sidecars
    When the sidecar subjects are derived
    Then the first subject is the host "kg-export" and there are no orphans
    And "kg-export.bootstrap" resolves to the bootstrap layer
    And the fixture has no orphans

  @test:scripts/tests/kg/kg-export-sidecars.test.ts::kg-export_sidecar_subjects_are_DERIVED_from_what_is_committed_(bean_`v556`)::a_committed_sidecar_whose_stub_no_instance_declares_is_an_ORPHAN,_not_skipped
  Scenario: A sidecar whose stub no layer declares is an orphan
    Given a directory with host, bootstrap, "no-such-instance" and unrelated "something-else" sidecars
    When the sidecar subjects are derived against the repository's layers
    Then the subjects are "kg-export" and "kg-export.bootstrap"
    And the only orphan is "kg-export.no-such-instance.qa-results.json"

  @test:scripts/tests/kg/kg-export-sidecars.test.ts::kg-export_sidecar_subjects_are_DERIVED_from_what_is_committed_(bean_`v556`)::with_no_instances_to_match_against,_every_foreign_sidecar_is_an_orphan_—_never_a_silent_pass
  Scenario: With no layers to match against every foreign sidecar is an orphan
    Given a directory with only the bootstrap sidecar
    When the sidecar subjects are derived against no layers
    Then the only subject is the host "kg-export"
    And "kg-export.bootstrap.qa-results.json" is an orphan
