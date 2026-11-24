# scripts/docs-cone-dryrun.ts is the docs site's dependency-cone deploy dry run (bean fwtz, option C): it collects the
# inputs since the deployed stamp, measures the build blind to deploy stamps, and judges whether the predicted cone was safe.
# Each Scenario names the test that executes it.
Feature: Docs dependency-cone deploy dry run

  @test:scripts/tests/docs-cone-dryrun.test.ts::nameStatus::reads_adds,_removals,_renames_and_copies_as_REST-style_statuses
  Scenario: Git name-status lines are read as REST-style statuses
    Given name-status output with a modify, an add, a delete, a rename from "old.md" to "new.md" and a copy to "y"
    When it is read
    Then the statuses are modified "a.md", added "b.md", removed "c.md", renamed "new.md" from "old.md", and added "y"

  @test:scripts/tests/docs-cone-dryrun.test.ts::intoCheckout::maps_a_branch_path_under_the_mount's_subtree_to_its_checkout_path,_and_nothing_else
  Scenario: A branch path under a mount's subtree maps to its checkout path, and nothing else does
    Given branch mounts with a path, an "into" checkout directory and optionally a branchPath
    Then "beans/defs/x.md" under mount "beans" into "beans" maps to "beans/defs/x.md"
    And "graph/a.json" under mount "graph" into "fsh-guts" maps to "fsh-guts/a.json"
    And "README.md" outside mount "beans" maps to nothing
    And "a.json" under a root mount into "todos" maps to "todos/a.json"
    And "test/results/health/run.json" under branchPath "test/results/health" into "smart-base" maps to "smart-base/run.json"

  @test:scripts/tests/docs-cone-dryrun.test.ts::markerKey_and_mountsForStamp::keys_multi-instance_mounts_by_<instance>.<id>_and_omits_colliding_bare_ids
  Scenario: Mounts are keyed by instance and id, and colliding bare ids are omitted
    Given markers "cat-harness.beans", "cat-harness.health" and "smart-base.health", two sharing the id "health"
    When their keys and the stamp's mounts are computed
    Then the keys are "cat-harness.beans", "cat-harness.health" and "smart-base.health"
    And the stamp records each keyed tip and the bare "beans", but no bare "health"

  @test:scripts/tests/docs-cone-dryrun.test.ts::collectInputs::diffs_from_the_DEPLOYED_commit,_and_a_moved_branch_mount_at_its_mount_path
  Scenario: Inputs are diffed from the deployed commit, plus a moved branch mount at its mount path
    Given a stamp deployed at "s1" with mount beans at "t1", head "h", and the beans mount now at "t2"
    When the inputs are collected
    Then there are no doubts
    And the changed inputs are "cat-harness/docs/a.md" and "beans/defs/x.md", and not the mount's "manifest.json"

  @test:scripts/tests/docs-cone-dryrun.test.ts::collectInputs::an_unmoved_mount_adds_nothing
  Scenario: An unmoved mount adds no inputs
    Given a stamp whose beans mount tip "t2" equals the marker's tip
    When the inputs are collected
    Then the only changed input is "cat-harness/docs/a.md"

  @test:scripts/tests/docs-cone-dryrun.test.ts::collectInputs::a_stamp_with_no_recorded_tip_is_a_doubt,_never_'the_mount_did_not_move'
  Scenario: A stamp that records no tip for a mount is a doubt
    Given a stamp with no mount tips and a beans marker
    When the inputs are collected
    Then there is one doubt saying it "records no tip"

  @test:scripts/tests/docs-cone-dryrun.test.ts::collectInputs::multi-instance_mounts_sharing_an_id_use_their_disambiguated_key_and_never_fall_back_to_a_colliding_bare_id
  Scenario: Mounts sharing an id are diffed by their disambiguated key, never a colliding bare id
    Given markers "cat-harness.health" and "smart-base.health" that share the id "health"
    When the inputs are collected from a legacy stamp recording only a bare "health" tip
    Then there are 2 doubts, saying it records no tip for "cat-harness.health" and for "smart-base.health"
    And when collected from a stamp keyed by both, each mount is diffed with its own marker
    And the changed inputs are "cat-harness/docs/a.md", "test/health/results/ci.json" and "smart-base/ig.json", with no doubts

  @test:scripts/tests/docs-cone-dryrun.test.ts::collectInputs::diffBranchMount_reads_from_the_mount's_BranchStore_(including_foreign-repository_mounts)
  Scenario: A branch mount's diff is read from its branch store, a foreign repository included
    Given a foreign repository whose branch "cat/smart-base/health" changed "test/results/health/a.json" between two commits
    And a "smart-base.health" mount on that repository
    When the mount is diffed between the two commits
    Then the name-status reads one modified "test/results/health/a.json"

  @test:scripts/tests/docs-cone-dryrun.test.ts::collectInputs::no_stamp_at_all,_or_an_unreadable_diff,_is_a_doubt
  Scenario: No stamp at all, or an unreadable diff, is a doubt
    When the inputs are collected with no stamp
    Then the first doubt says "no base"
    And when collected from a stamp whose diff cannot be read, the first doubt says "could not be read"

  @test:scripts/tests/docs-cone-dryrun.test.ts::measureDeploy::a_page_that_differs_only_in_the_deploy_stamps_measures_as_untouched
  Scenario: A page that differs only in its deploy stamps hashes the same
    Given two renders of a page that differ only in the build-stamp sha and asset version
    Then their stamped hashes are equal
    And a page with a different body hashes differently

  @test:scripts/tests/docs-cone-dryrun.test.ts::measureDeploy::a_schema's_build_provenance_block_is_a_stamp;_its_content_is_not
  Scenario: A schema's build provenance block is a stamp and its content is not
    Given two schema documents that differ only in their staging run and sha
    Then their stamped hashes are equal
    And a document with a different title hashes differently

  @test:scripts/tests/docs-cone-dryrun.test.ts::measureDeploy::jekyll-remote-theme_temp_paths_in_.css.map_and_live_QA_witness_timestamps/shas_are_stamps;_real_changes_are_not
  Scenario: Theme temp paths in a .css.map and QA witness timestamps and shas are stamps
    Given two .css.map files that differ only in the jekyll-remote-theme temp directory
    Then their stamped hashes are equal, and different mappings hash differently
    And two QA block files that differ only in witness time and sha hash the same
    And a QA block file whose state changes from "pass" to "fail" hashes differently

  @test:scripts/tests/docs-cone-dryrun.test.ts::measureDeploy::instance_graph_export_commit_stamps_and_state-visualizer_build_timestamps_are_stamps;_graph/token_changes_are_not
  Scenario: Graph export commit stamps and state-visualizer build times are stamps; graph and token changes are not
    Given two instance graph exports that differ only in generation time and source commit
    Then their stamped hashes are equal, and a changed node count hashes differently
    And two bootstrap.jsonld files that differ only in generation time and derivation sha hash the same, and a changed title hashes differently
    And two workflow pages that differ only in their build time hash the same, and a changed status hashes differently

  @test:scripts/tests/docs-cone-dryrun.test.ts::measureDeploy::post-#1084_deploy_stamps_(pins.json_self-sha,_root-index_sha256,_site:viz_gh-pages_state,_availability.json_source_race,_and_ustar_package.tgz_mtime)_are_stamps;_content_changes_are_not
  Scenario: Later deploy stamps are blind to the stamped hash; content changes are not
    Given two pins.json files differing only in their own sha
    Then they hash the same, and a changed layer pin hashes differently
    And two root index.json files differing only in bytes and sha256 hash the same, and a changed node count differs
    And two site:viz pages differing in tip, render-log files, preview count and preview rows hash the same, and a changed api page count differs
    And availability.json from "checkout" and from "fetched" hash the same, and "unavailable" differs
    And two FHIR artifact index.json files differing only in package bytes hash the same, and a changed artifact count differs
    And two ustar package.tgz files differing only in mtime hash the same, and a changed payload differs

  @test:scripts/tests/docs-cone-dryrun.test.ts::measureDeploy::compares_the_main_site_only:_other_previews,_the_render_log_and_build.json_are_left_out
  Scenario: The deploy measurement compares the main site only
    Given a before site with a.html, b.html, gone.html, a staging preview, a render log and build.json
    And an after site where a.html changed only in its stamps, b.html changed, c.json was added and build.json changed
    When the deploy is measured
    Then the result is "changed b.html", "added c.json" and "removed gone.html"

  @test:scripts/tests/docs-cone-dryrun.test.ts::judge::a_determined_cone_that_covers_every_measured_file_is_cone-safe
  Scenario: A determined cone covering every measured file is cone-safe
    Given measured changes to "assets/beans/index.json" and "en/beans/index.html"
    And a predicted cone of both plus "extra.json"
    When the dry run is judged
    Then the verdict is "cone-safe"
    And 1 predicted file is unconfirmed and 1 page is counted

  @test:scripts/tests/docs-cone-dryrun.test.ts::judge::a_determined_cone_that_misses_a_measured_file_is_cone-unsafe,_and_names_it
  Scenario: A determined cone that misses a measured file is cone-unsafe and names it
    Given a predicted cone of "assets/beans/index.json" only
    When the dry run is judged against both measured changes
    Then the verdict is "cone-unsafe"
    And the missed file is changed "en/beans/index.html"
    And the summary names "en/beans/index.html"

  @test:scripts/tests/docs-cone-dryrun.test.ts::judge::any_doubt_falls_back_to_the_full_build,_whatever_the_measurement
  Scenario: Any doubt falls back to the full build
    Then a prediction with an undetermined input is judged "full"
    And a repin with unreadable files is judged "full"
    And a collection doubt "no tip" is judged "full"
    And no prediction at all is judged "full"

  @test:scripts/tests/docs-cone-dryrun.test.ts::judge::no_input_since_the_deploy_is_an_empty_cone:_safe_only_when_the_build_changed_nothing
  Scenario: With no input since the deploy, the cone is safe only when nothing changed
    Given no inputs since the deploy and no prediction
    Then the verdict is "cone-safe" when nothing was measured
    And "cone-unsafe" when files were measured as changed

  @test:scripts/tests/docs-cone-dryrun.test.ts::judge::split_search_indices_under_assets/js/search/*.json_are_covered_when_assets/js/search-data.json_is_predicted,_and_missed_otherwise
  Scenario: Split search indices are covered by a predicted search-data.json and missed otherwise
    Given measured changes to a page, "assets/js/search-data.json" and three files under "assets/js/search/"
    When a cone predicting the page and "assets/js/search-data.json" is judged
    Then the verdict is "cone-safe" with nothing missed
    And a cone predicting only "assets/css/docs-ui.css" against a changed "assets/js/search/manifest.json" is "cone-unsafe", missing that file
