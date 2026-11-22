# scripts/staging-changes.ts builds the staging preview's changes page: the changed sources
# with re-pins expanded, the predicted cone, and the QA diff against the publish root.
# Each Scenario names the test that executes it.
Feature: Staging preview changes page

  @test:scripts/tests/sdlc/staging-changes.test.ts::mountedPath::maps_through_the_longest_declared_directory,_and_a_root_mount
  Scenario: An upstream path maps through the longest declared directory, and a root mount
    Given directories "x" mounted from "." and "x/deep" mounted from "a/b"
    Then "a/b/c.md" maps to "x/deep/c.md"
    And "z.md" maps to "x/z.md" through the root mount
    And "q.md" maps to nothing when the only directory mounts "only"

  @test:scripts/tests/sdlc/staging-changes.test.ts::expandRepins::a_moved_pin_becomes_its_files_at_their_mount_paths;_an_unmoved_one_contributes_nothing
  Scenario: A moved pin becomes its files at their mount paths; an unmoved one contributes nothing
    Given a lock where "mounted-layer" moves from "s1" to "s2" and "tools" stays at "t1"
    And the upstream diff modifies a.bpmn, renames library/old.md to library/new.md and modifies input/fsh/x.fsh
    When the re-pins are expanded
    Then one re-pin is reported for "mounted-layer" from "s1" to "s2" with 3 files
    And the two files under mounted directories are marked mounted, and input/fsh/x.fsh is not
    And the rename keeps "mounted-layer/library/old.md" as where it came from

  @test:scripts/tests/sdlc/staging-changes.test.ts::expandRepins::a_pin_that_cannot_be_diffed_is_said,_never_dropped
  Scenario: A pin that cannot be diffed is said, never dropped
    Given a moved pin whose diff throws "fetch refused"
    When the re-pins are expanded
    Then no file changes are listed
    And the re-pin's file count is null and its doubt names "fetch refused"

  @test:scripts/tests/sdlc/staging-changes.test.ts::expandRepins::a_newly_mounted_instance_is_a_doubt,_not_an_empty_list
  Scenario: A newly mounted instance is a doubt, not an empty list
    Given a head lock that adds instance "new" at "n1"
    When the re-pins are expanded
    Then "new" is reported from null to "n1" with a null file count

  @test:scripts/tests/sdlc/staging-changes.test.ts::collectSources::expands_only_when_the_lock_is_in_the_branch's_list,_and_says_so_when_its_base_is_missing
  Scenario: Re-pins are expanded only when the lock changed, with a doubt when its base is missing
    Given a branch that changed index.lock.json and added docs/x.md, and a pin diff adding b.bpmn
    When its sources are collected
    Then the changes are index.lock.json, docs/x.md and mounted-layer/processes/b.bpmn
    And the cone inputs are those three paths, sorted
    And without a base lock the re-pin's doubt says "not expanded"
    And when index.lock.json is not in the changed list no re-pins are reported

  @test:scripts/tests/sdlc/staging-changes.test.ts::collectSources::parses_both_list_shapes_and_git's_name-status
  Scenario: Both changed-list shapes and git's name-status parse
    When "a.md" and a "renamed" line for b.md from old.md are parsed as a changed list
    Then they give a.md as "changed" and b.md as "renamed" from old.md
    When M, A, D and R087 name-status lines are parsed
    Then they give modified, added, removed, and renamed from d to e

  @test:scripts/tests/sdlc/staging-changes.test.ts::the_QA_diff_against_the_publish_root::folds_the_base,_compares_the_body_only,_and_leaves_out_other_previews_and_the_job's_files
  Scenario: The QA diff folds the base, compares the body only, and leaves out other previews and the job's files
    Given a publish root with pages, build.json, another preview and a render log
    And a preview with a and b changed, index differing only in chrome, ref/ not built, and its own changes page and impact file
    Then folding "/r/STAGING/s/a /r/STAGING/s" to base "/r" gives "/r/a /r"
    And the page body is taken from the opening main tag
    When the two sites are measured
    Then only a.html and b.html are "changed" and ref/one.html is "removed"

  @test:scripts/tests/sdlc/staging-changes.test.ts::the_QA_diff_against_the_publish_root::sorts_the_measurement_into_not-in-cone,_confirmed,_unconfirmed_and_absent
  Scenario: The measurement is sorted into not-in-cone, confirmed, unconfirmed and absent
    Given the measured sites and a prediction of a.html as changed content and c.json as changed data
    When QA is checked on matching base "base1"
    Then the status is "known"
    And b.html is changed but not in the cone, a.html is confirmed, c.json (data) is unconfirmed
    And the ref directory is absent with 1 page, sampled as "ref/one.html"
    And a mismatched base gives status "not-base"
    When the changes page is rendered for branch "feat<x>"
    Then the branch name is escaped as "feat&lt;x&gt;"
    And it links b.html in the preview and docs/a.md on GitHub at "abcdef1234"
    And it heads the not-in-cone section with a count of 1

  @test:scripts/tests/sdlc/staging-changes.test.ts::the_QA_diff_against_the_publish_root::no_prediction_and_no_root_are_'not_known',_never_'nothing'
  Scenario: No prediction and no root render as not known, never as nothing
    When the changes page is rendered with no prediction and QA absent for "no root"
    Then it says "Not known: this build wrote no prediction"
    And it says "Not measured: no root"

  @test:scripts/tests/sdlc/staging-changes.test.ts::prediction_by_provenance::reads_both_provenance_forms,_and_never_another_preview
  Scenario: Provenance is read in both forms, never from another preview
    Then "Generated from <code>x/y.md</code>" and a data-src of "./z.md" give sources "x/y.md" and "z.md"
    When the provenance index of a root with another preview under STAGING/ is built
    Then "mounted-layer/skills/a.md" maps only to "reference/a.html"
    And "mounted-layer/processes/a.bpmn" maps to "processes/a.html"

  @test:scripts/tests/sdlc/staging-changes.test.ts::prediction_by_provenance::a_changed_source_predicts_its_pages;_a_removed_one_removes_them;_an_unmounted_one_predicts_nothing
  Scenario: A changed source predicts its pages; a removed one removes them; an unmounted one predicts nothing
    Given a provenance index of the root
    When skills/a.md is modified, skills/b.md is removed, and an unmounted processes/a.bpmn is modified
    Then reference/a.html is predicted changed via skills/a.md
    And reference/b.html is predicted removed via skills/b.md
    And nothing is predicted for the unmounted source
    And merging with another impact for reference/a.html via "x.md" joins both via lists
