# What scripts/tests/kg/kg-audit-orphan-sweep.test.ts covers: sweepOrphans in schemas/sdlc/kg-qa.ts finds QA sidecars
# this run did not write and says from each sidecar's subject.path whether its subject still exists.
# Each Scenario names the test that executes it.
Feature: The orphan-sidecar sweep

  @test:scripts/tests/kg/kg-audit-orphan-sweep.test.ts::the_sweep_finds_what_this_run_did_not_write::a_sidecar_in_`written`_is_not_an_orphan;_one_outside_it_is
  Scenario: A sidecar this run wrote is not an orphan, one it did not write is
    Given sidecars "kept" and "left" under skills/pkg in the results tree
    When the sweep runs with only "kept" written
    Then the only orphan is the "left.kg-qa.json" sidecar

  @test:scripts/tests/kg/kg-audit-orphan-sweep.test.ts::the_sweep_finds_what_this_run_did_not_write::it_recurses_—_the_real_orphans_sit_three_and_four_levels_deep
  Scenario: The sweep recurses into deep directories
    Given a sidecar "deep" four levels down under skills/a/b/c
    When the sweep runs with nothing written
    Then the only orphan is that "deep.kg-qa.json" sidecar

  @test:scripts/tests/kg/kg-audit-orphan-sweep.test.ts::the_sweep_finds_what_this_run_did_not_write::a_missing_results_tree_is_not_a_finding
  Scenario: A missing results tree is not a finding
    Given a directory with no results tree
    When the sweep runs
    Then it finds no orphans

  @test:scripts/tests/kg/kg-audit-orphan-sweep.test.ts::the_sweep_finds_what_this_run_did_not_write::...but_an_EMPTY_results_tree_is_not_a_finding_either,_and_neither_is_silence
  Scenario: An empty results tree is not a finding
    Given an empty results tree
    When the sweep runs
    Then it finds no orphans

  @test:scripts/tests/kg/kg-audit-orphan-sweep.test.ts::the_sweep_finds_what_this_run_did_not_write::a_non-sidecar_file_in_the_tree_is_ignored
  Scenario: A non-sidecar file in the tree is ignored
    Given a results tree holding only a README.md
    When the sweep runs
    Then it finds no orphans

  @test:scripts/tests/kg/kg-audit-orphan-sweep.test.ts::it_says_WHY,_from_the_sidecar's_own_`subject.path`::subject_gone_→_subjectExists_false
  Scenario: An orphan whose subject is gone has subjectExists false
    Given a sidecar recording subject "skills/pkg/moved.md", which is not on disk
    When the sweep runs
    Then the orphan names that subject with subjectExists false

  @test:scripts/tests/kg/kg-audit-orphan-sweep.test.ts::it_says_WHY,_from_the_sidecar's_own_`subject.path`::subject_present_but_unaudited_→_subjectExists_true
  Scenario: An orphan whose subject is present but unaudited has subjectExists true
    Given a sidecar recording subject "skills/pkg/frag.md", which is on disk
    When the sweep runs
    Then the orphan names that subject with subjectExists true

  @test:scripts/tests/kg/kg-audit-orphan-sweep.test.ts::it_says_WHY,_from_the_sidecar's_own_`subject.path`::both_kinds_in_one_tree_are_reported_separately,_not_merged
  Scenario: Present and gone subjects in one tree are reported separately
    Given sidecars for "skills/pkg/here.md", which is on disk, and "skills/pkg/gone.md", which is not
    When the sweep runs
    Then here.md is reported with subjectExists true and gone.md with false

  @test:scripts/tests/kg/kg-audit-orphan-sweep.test.ts::it_says_WHY,_from_the_sidecar's_own_`subject.path`::unreadable_or_path-less_→_subjectExists_UNDEFINED,_not_false
  Scenario: An unreadable or path-less sidecar has subjectExists undefined
    Given a sidecar that is not valid JSON and a sidecar with a null subject path
    When the sweep runs
    Then both orphans have subjectExists undefined
