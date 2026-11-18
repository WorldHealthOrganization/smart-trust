# How the harness treats an opt-in sub-graph that a downstream mount left out (the lock's
# "except"): switched off for the mounted layer, not a declared directory gone missing, across
# directory resolution, kg-export, kg:audit and check:wireframes.
# Each Scenario names the test that executes it.
Feature: An opt-in sub-graph the mount left out is switched off, not missing

  @test:scripts/tests/kg/optin-left-out-by-mount.test.ts::an_opt-in_sub-graph_the_mount_left_out::is_switched_off_for_the_mounted_layer's_resolution
  Scenario: A left-out sub-graph is switched off for the mounted layer
    Given a downstream mounting "up" whole, whose mount left out "grp"
    And "up" enables its opt-in sub-graphs "up.grp" and "up.kept" for itself, with only "kept/" on disk
    When the mounted "up"'s directories are resolved
    Then "grp" is not among them
    And "kept" is among them

  @test:scripts/tests/kg/optin-left-out-by-mount.test.ts::an_opt-in_sub-graph_the_mount_left_out::is_still_declared:_a_structural_reader_asking_for_everything_sees_it
  Scenario: A left-out sub-graph is still declared to a reader asking for everything
    Given a downstream mounting "up" whole, whose mount left out "grp"
    When the mounted "up"'s directories are resolved with every sub-graph enabled
    Then "grp" is among them

  @test:scripts/tests/kg/optin-left-out-by-mount.test.ts::an_opt-in_sub-graph_the_mount_left_out::is_not_reported_as_a_declared_directory_that_is_absent
  Scenario: A left-out sub-graph is not reported absent
    Given a downstream mounting "up" whole, whose mount left out "grp"
    When kg-export collects the mounted "up"'s nodes
    Then no "declared knowledge-graph directory is absent: grp/" problem is reported

  @test:scripts/tests/kg/optin-left-out-by-mount.test.ts::the_absences_that_are_still_defects::an_opt-in_sub-graph_the_mount_TOOK,_and_that_is_not_there,_is_reported
  Scenario: An opt-in sub-graph the mount took that is not on disk is reported absent
    Given a downstream mounting "up" whole, whose mount left nothing out
    When the mounted "up"'s directories are resolved and its nodes collected
    Then "grp" is among the directories
    And exactly one "declared knowledge-graph directory is absent: grp/" problem is reported

  @test:scripts/tests/kg/optin-left-out-by-mount.test.ts::the_absences_that_are_still_defects::an_opt-in_sub-graph_of_a_layer_no_mount_placed,_and_that_is_not_there,_is_reported
  Scenario: An opt-in sub-graph of an unmounted layer that is not on disk is reported absent
    Given "up" placed directly, with no mount, and "grp/" not on disk
    When its directories are resolved and its nodes collected
    Then "grp" is among the directories
    And exactly one "declared knowledge-graph directory is absent: grp/" problem is reported

  @test:scripts/tests/kg/optin-left-out-by-mount.test.ts::leftOutByMount:_absent_by_consent,_and_nothing_else::left_out_by_the_mount,_and_not_on_disk
  Scenario: A path under a left-out, absent directory is left out by the mount
    Given a downstream mounting "up" whole, whose mount left out "grp"
    Then "up/grp" is left out by the mount
    And "up/grp/skills/deep" is left out by the mount

  @test:scripts/tests/kg/optin-left-out-by-mount.test.ts::leftOutByMount:_absent_by_consent,_and_nothing_else::on_disk,_taken_by_the_mount,_or_placed_by_no_mount:_not_consent
  Scenario: A directory on disk, taken by the mount, or placed by no mount is not left out
    Given a mount that left out "grp" and "kept", while "kept/" is on disk
    Then "up/kept" is not left out by the mount
    And in a mount that took everything, "up/grp" is not left out
    And in an "up" placed by no mount, "grp" is not left out

  @test:scripts/tests/kg/optin-left-out-by-mount.test.ts::kg:audit:_an_attestation_whose_subject_the_mount_left_out::its_mirrored_subject_is_the_left-out_directory,_so_it_is_not_judged_here
  Scenario: An attestation's mirrored subject is the left-out directory
    Given a downstream mounting "up" whole, whose mount left out "grp"
    When the subject of "qa/attestations/kg-qa/grp/skills/x.kg-qa.attestations.json" is mirrored
    Then the subject is "up/grp/skills"
    And that subject is left out by the mount

  @test:scripts/tests/kg/optin-left-out-by-mount.test.ts::kg:audit:_an_attestation_whose_subject_the_mount_left_out::an_attestation_of_a_subject_the_mount_took,_and_that_is_gone,_is_still_an_orphan
  Scenario: An attestation of a taken subject that is gone is not excused
    Given a downstream mounting "up" whole, whose mount left nothing out
    When the subject of "qa/attestations/kg-qa/grp/skills/x.kg-qa.attestations.json" is mirrored
    Then that subject is not left out by the mount

  @test:scripts/tests/kg/optin-left-out-by-mount.test.ts::kg:audit:_an_attestation_whose_subject_the_mount_left_out::a_file_outside_the_tree_mirrors_nothing
  Scenario: A file outside the attestation tree mirrors no subject
    When the subject of "/elsewhere/x.json" is mirrored against tree "/tree"
    Then there is no subject

  @test:scripts/tests/kg/optin-left-out-by-mount.test.ts::check:wireframes:_a_harness_whose_own_wireframes_the_mount_left_out::is_named_by_wireframesLeftOut_only_when_the_mount_left_them_out
  Scenario: A harness is named as wireframes-left-out only when its mount left them out
    Then a mount of "up" that left out "docs/wireframes" names "up" as having its wireframes left out
    And a mount that left nothing out names none
    And an "up" placed by no mount names none

  @test:scripts/tests/kg/optin-left-out-by-mount.test.ts::check:wireframes:_a_harness_whose_own_wireframes_the_mount_left_out::its_visualisers_are_not_judged;_another_harness's_uncovered_visualiser_still_fails
  Scenario: A left-out harness's visualisers are not judged, while others still fail
    Given an empty wireframe directory, so cat-harness has more than 0 uncovered visualisers
    When wireframes are checked with "cat-harness" marked as left out
    Then cat-harness's uncovered visualisers are listed as not judged instead
    And the uncovered list is exactly the other harnesses' uncovered visualisers
