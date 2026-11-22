# scripts/merge-leftover.ts reports whether a PR's intent already landed on a base,
# on the path classes scripts/merge-pipeline-paths.ts reads from the merge-conflict
# declaration. Each Scenario names the test that executes it.
Feature: What a PR leaves over against its base

  @test:scripts/tests/sdlc/merge-leftover.test.ts::path_classes_come_from_the_merge-conflict_declaration::take-base_paths,_kg-qa_sidecars_among_them,_are_generated;_READMEs_are_regions;_the_rest_is_authored
  Scenario: Take-base paths are generated, READMEs are regions and everything else is authored
    Given the merge-conflict declaration
    When paths are classed
    Then the lsi glossary index is "generated" under the pattern "glossary"
    And a kg-qa sidecar under test/results/kg-qa is "generated"
    And beans/README.md is "generated-regions"
    And cat-harness/scripts/merge-base.ts is "authored" with no pattern
    And a path under a refused pattern, beans/defs/x.md, is "authored"

  @test:scripts/tests/sdlc/merge-leftover.test.ts::path_classes_come_from_the_merge-conflict_declaration::shared_declarations:_instance_JSON,_roles,_package,_lockfile,_schemas,_diagrams
  Scenario: Shared declarations are recognised by path
    Given paths of instance JSON, roles, package, lockfile, schemas and process diagrams
    When their shared declarations are read
    Then cat-harness/cat-harness.json and smart-base/smart-base.json are instance declarations
    And cat-harness/semantic-zoom.json is not an instance declaration
    And the instance JSON, roles.json, package.json, bun.lock, a schemas file and a .bpmn process each name their one declaration
    And cat-harness-tools/scripts/merge-train.ts names none

  @test:scripts/tests/sdlc/merge-leftover.test.ts::path_classes_come_from_the_merge-conflict_declaration::region_stripping:_a_changed_region_is_region-only,_changed_prose_is_not,_an_unclosed_region_is_not
  Scenario: Only a closed generated region may differ for a region-only change
    Given READMEs built from prose and a generated region
    Then two READMEs with the same prose and different regions differ only in regions
    And two READMEs with different prose do not
    And stripping regions leaves a text with an unclosed region unchanged
    And two texts differing inside an unclosed region do not differ only in regions

  @test:scripts/tests/sdlc/merge-leftover.test.ts::path_classes_come_from_the_merge-conflict_declaration::member_specs:_PR,_pinned_PR,_ref
  Scenario: Member specs parse as a PR, a pinned PR or a ref
    When member specs are parsed
    Then "1874" is PR 1874
    And "#1874:ABCDEF1" is PR 1874 pinned to sha "abcdef1", lower-cased
    And "origin/claude/x" is the ref "origin/claude/x"

  @test:scripts/tests/sdlc/merge-leftover.test.ts::verdictOf::different_outranks_unknown;_unknown_is_never_landed
  Scenario: A different path outranks an unknown one, and unknown is never landed
    When verdicts are taken over path states
    Then "different" with "unknown" is "not-landed"
    And "generated" with "unknown" is "could-not-determine"
    And generated, generated-region, contained and same together are "landed"
    And no paths at all is "landed"

  @test:scripts/tests/sdlc/merge-leftover.test.ts::leftover_on_a_real_history::a_head_the_base_contains_is_landed
  Scenario: A head the base contains is landed
    Given a git history where a PR branch was merged into main
    When the leftover of the PR head against main is read
    Then the verdict is "landed"
    And the reason mentions "contained"

  @test:scripts/tests/sdlc/merge-leftover.test.ts::leftover_on_a_real_history::intent_landed_through_a_train:_the_head_differs_only_in_generated_files,_regions_and_changes_the_base_already_carries
  Scenario: Intent landed through a train reads as landed
    Given a PR changing an authored file, a generated file and a README region
    And main carrying the same change in another commit, then regenerating and editing the same file far from the PR's hunk
    When the leftover of the PR head against main is read
    Then the verdict is "landed"
    And the authored file is "contained", the generated file "generated" and the README "generated-region"

  @test:scripts/tests/sdlc/merge-leftover.test.ts::leftover_on_a_real_history::an_authored_change_the_base_does_not_carry_is_not-landed,_and_named
  Scenario: An authored change the base does not carry is not-landed and named
    Given a PR editing src/a.ts, adding src/new.ts and regenerating a generated file
    And main only regenerating the generated file
    When the leftover of the PR head against main is read
    Then the verdict is "not-landed"
    And the authored paths that differ are src/a.ts and src/new.ts

  @test:scripts/tests/sdlc/merge-leftover.test.ts::leftover_on_a_real_history::a_README_whose_PROSE_the_base_lacks_is_authored,_not_a_region
  Scenario: A README whose prose the base lacks is authored, not a region
    Given a PR changing the prose of docs/README.md
    And main moving on in another file
    When the leftover of the PR head against main is read
    Then the verdict is "not-landed"
    And the only authored path that differs is docs/README.md

  @test:scripts/tests/sdlc/merge-leftover.test.ts::leftover_on_a_real_history::the_base_rewrote_the_PR's_own_lines:_not-landed,_for_a_person_to_look_at
  Scenario: A base that rewrote the PR's own lines is not-landed
    Given a PR changing the first line of src/a.ts to "ONE"
    And main changing the same line to "uno"
    When the leftover of the PR head against main is read
    Then the verdict is "not-landed"

  @test:scripts/tests/sdlc/merge-leftover.test.ts::leftover_on_a_real_history::unrelated_histories_could_not_be_determined,_and_are_never_shown_as_landed
  Scenario: Unrelated histories could not be determined
    Given an orphan branch with no history in common with main
    When the leftover of its head against main is read
    Then the verdict is "could-not-determine"
