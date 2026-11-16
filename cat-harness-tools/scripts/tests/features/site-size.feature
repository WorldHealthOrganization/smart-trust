# The size review: a fixture site measured, compared with a git ls-tree
# listing, a tree on disk and an earlier report, and run as a build step.
# Each Scenario names the test that executes it.
Feature: Site size review

  Background:
    Given a fixture site with pages, scripts, stylesheets and their source maps, three byte-identical artefacts, two other layers' pages, two empty files and a vendored SQLite build
    And an index.lock.json naming layer-a and layer-b

  @test:scripts/tests/site-size.test.ts::measureSite::totals,_directories,_extensions_and_the_biggest_files
  Scenario: Totals, directories, extensions and biggest files
    When the site is measured with the lock at a fixed time
    Then the report has the site-size schema and that time
    And it counts 15 files whose bytes sum over the top directories
    And assets is the largest top directory with 5 files, and the root holds 4 files
    And assets/js holds 7800 bytes, .map files 3500 bytes in 2 files, and there is no "(none)" extension
    And the biggest file is assets/js/app.js at 4000 bytes

  @test:scripts/tests/site-size.test.ts::measureSite::byte-identical_files_are_grouped,_with_what_the_extra_copies_cost;_empty_files_are_not
  Scenario: Byte-identical files are grouped with their cost
    When the site is measured
    Then there is one duplicate group of the three artefacts, 3 copies of 1100 bytes
    And the extra copies waste 2200 bytes
    And the empty files form no group

  @test:scripts/tests/site-size.test.ts::measureSite::same_size,_different_bytes:_not_duplicates
  Scenario: Same size but different bytes are not duplicates
    Given two four-byte files with different content
    When the site is measured
    Then neither is in a duplicate group

  @test:scripts/tests/site-size.test.ts::measureSite::every_.map_file_is_listed
  Scenario: Every source map is listed
    When the site is measured
    Then the source maps are app.js.map and site.css.map, 3500 bytes in all

  @test:scripts/tests/site-size.test.ts::measureSite::directories_named_after_another_layer_come_from_the_lock,_not_from_a_list
  Scenario: Other layers' directories come from the lock
    When the site is measured with the lock
    Then the other-layer directories are layer-a (2000 bytes) and en/layer-b (1500 bytes)
    And without the lock there are none
    And with layer-a as the site's own layer only en/layer-b remains

  @test:scripts/tests/site-size.test.ts::measureSite::directories_the_shared-assets_host_could_serve_are_named
  Scenario: Shareable directories are named
    When the site is measured
    Then the only shareable directory is assets/js/vendor/sqlite-wasm/ with 800 bytes in 1 file

  @test:scripts/tests/site-size.test.ts::helpers::lockInstances_reads_names_and_mount_basenames,_and_tolerates_a_missing_or_broken_lock
  Scenario: Lock instances are read tolerantly
    Then the lock's instances are layer-a and layer-b
    And a missing or unparseable lock gives none

  @test:scripts/tests/site-size.test.ts::helpers::otherLayerDir:_the_outermost_directory_within_three_segments,_never_the_file
  Scenario: The other-layer directory is found within three segments
    Then "l/x.html", "en/l/x.html" and "a/b/l/x.html" give directories l, en/l and a/b/l
    And "a/b/c/l/x.html" and the bare file "l" give nothing

  @test:scripts/tests/site-size.test.ts::helpers::parseLsTree_keeps_blobs,_skips_submodules,_unquotes_paths
  Scenario: ls-tree output is parsed
    Given ls-tree lines for two blobs, a submodule and a quoted path
    Then the parsed files are the two blobs and the unquoted path, with their sizes
    And as a gh-pages baseline, branch previews are excluded, giving 130 bytes in 2 files, all at the root

  @test:scripts/tests/site-size.test.ts::compareSize::growth_over_the_budget_is_a_warning,_said_and_not_refused
  Scenario: Growth over the budget is a warning
    Given a 1000-byte baseline and a 10% / 10 MB budget
    When the site is compared
    Then the byte delta is the growth and its percentage exceeds 10
    And the first warning says the site "grew"
    And warnings mention source maps and another layer
    And assets leads the directory changes

  @test:scripts/tests/site-size.test.ts::compareSize::within_the_budget:_no_growth_warning
  Scenario: Within the budget there is no growth warning
    When the site is compared with a baseline of its own total
    Then no warning says "grew"

  @test:scripts/tests/site-size.test.ts::compareSize::a_tree_on_disk_and_an_earlier_report_are_baselines_too
  Scenario: A tree on disk and an earlier report are baselines
    Then a published tree on disk gives a baseline of 17 bytes in 1 file, excluding branch previews
    And an earlier report gives a baseline equal to its totals, with a zero delta
    And a JSON file with another schema is not a baseline

  @test:scripts/tests/site-size.test.ts::compareSize::formatReport_names_every_section
  Scenario: The formatted report names every section
    When a measured report with a comparison is formatted
    Then it names the top directories, extensions, biggest files, duplicates, source maps, other layers, shared-assets host, baseline, budget and a warning sign

  @test:scripts/tests/site-size.test.ts::the_build_step::against_the_local_origin/gh-pages,_by_git_ls-tree
  Scenario: The build step compares against the local origin/gh-pages
    Given a repository whose origin/gh-pages holds a 100-byte page and a large staging preview
    Then its baseline is 100 bytes in 1 file from origin/gh-pages, and an absent ref gives none
    When the size review runs as a build step
    Then it compares against 100 bytes
    And it writes its report to the build output, not into the site, with the site-size schema
    And it logs that it compared against origin/gh-pages

  @test:scripts/tests/site-size.test.ts::the_build_step::with_no_published_tree,_the_last_report_is_the_baseline;_a_missing_site_is_said,_not_thrown
  Scenario: Without a published tree the last report is the baseline
    When the review runs with no published site or earlier report
    Then it logs "no published site or earlier report"
    And after adding a 50-byte script, the next review's delta is 50 bytes
    And a missing site returns nothing and logs "nothing measured"
