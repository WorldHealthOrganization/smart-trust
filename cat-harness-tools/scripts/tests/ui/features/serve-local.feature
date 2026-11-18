# Covers scripts/serve-local.ts: fetches a repository's gh-pages into a sparse local cache, leaving previews
# out unless named, and updates it on the next run. Each Scenario names the test that executes it.
Feature: Serving a published site locally

  @test:scripts/tests/ui/serve-local.test.ts::fetching_a_site::the_first_fetch_checks_out_the_site_without_STAGING
  Scenario: The first fetch checks out the site without STAGING
    Given a local gh-pages repository with "index.html" "v1" and two STAGING previews
    When the site is fetched into an empty cache
    Then the cached "index.html" reads "v1"
    And the cache has no "STAGING" directory

  @test:scripts/tests/ui/serve-local.test.ts::fetching_a_site::a_named_preview_is_added,_the_others_stay_out
  Scenario: A named preview is fetched and the others stay out
    Given the site already fetched into the cache
    When it is fetched again naming the preview "claude-a"
    Then "STAGING/claude-a/index.html" reads "preview a"
    And "STAGING/claude-b" is absent

  @test:scripts/tests/ui/serve-local.test.ts::fetching_a_site::the_next_run_picks_up_a_new_publish
  Scenario: The next fetch picks up a new publish
    Given the remote's "index.html" changed to "v2" in a new commit
    When the site is fetched again into the same cache
    Then the cached "index.html" reads "v2"

  @test:scripts/tests/ui/serve-local.test.ts::inputs::a_served_folder_with_no_index.html_points_at_the_subfolders_that_have_one
  Scenario: A folder with no index.html lists the subfolders that have one
    Given a folder with subfolders "site", "docs", "scripts" and ".git", where all but "scripts" hold an index.html
    When the pages below it are listed
    Then the list is "docs" then "site"
    And once the folder itself has an index.html the list is empty

  @test:scripts/tests/ui/serve-local.test.ts::inputs::the_owner_comes_from_<owner>.github.io
  Scenario: The owner is read from an owner.github.io address
    Then "https://litlfred.github.io" gives the owner "litlfred"
    And "https://example.org" gives no owner
    And no address gives no owner

  @test:scripts/tests/ui/serve-local.test.ts::inputs::the_remote_template_fills_owner_and_repo
  Scenario: The remote template fills in owner and repo
    When "https://github.com/{owner}/{repo}.git" is filled with "litlfred" and "dth-pc"
    Then the remote is "https://github.com/litlfred/dth-pc.git"

  @test:scripts/tests/ui/serve-local.test.ts::inputs::repo_names_are_single_segments
  Scenario: Repository names are trimmed single path segments
    When " folio-assistant, dth-pc ," is parsed
    Then the repositories are "folio-assistant" and "dth-pc"
    And parsing "a/../b" throws

  @test:scripts/tests/ui/serve-local.test.ts::inputs::STAGING_is_excluded_and_named_previews_added_back
  Scenario: Sparse patterns exclude previews and add named ones back
    When sparse patterns are built for the preview "claude-x"
    Then they are "/*", "!/branches/", "!/STAGING/", "/branches/claude-x/" and "/STAGING/claude-x/" in that order
    And building them for "../x" throws

  @test:scripts/tests/ui/serve-local.test.ts::inputs::the_cache_follows_XDG_CACHE_HOME
  Scenario: The cache directory follows XDG_CACHE_HOME
    When XDG_CACHE_HOME is "/c"
    Then the default cache directory is "/c/cat-harness/serve-local"
