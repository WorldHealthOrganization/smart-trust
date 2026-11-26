# scripts/publish-main-site.ts publishes main's built site onto the Pages tree, tracking its
# own files in a manifest so it removes only what main stopped producing and never touches
# reserved paths such as STAGING previews. Each Scenario names the test that executes it.
Feature: Publishing the main site

  @test:scripts/tests/sdlc/publish-main-site.test.ts::publish-main-site_(bean_5uuf)::the_first_publish_writes_the_site_and_a_manifest,_and_leaves_everything_else_alone
  Scenario: The first publish writes the site and a manifest and leaves everything else alone
    Given a Pages tree holding a STAGING preview, CNAME and a render log
    And a site with index.html and doc/a.html
    When the site is published at commit "abc"
    Then 2 files are written, none removed, 1 left alone, and it is the first publish
    And doc/a.html holds the site's content
    And the STAGING preview and CNAME are untouched
    And the manifest lists "doc/a.html" and "index.html"

  @test:scripts/tests/sdlc/publish-main-site.test.ts::publish-main-site_(bean_5uuf)::a_later_publish_removes_the_pages_main_stopped_producing,_and_only_those
  Scenario: A later publish removes the pages main stopped producing, and only those
    Given a Pages tree with CNAME and a STAGING preview, after a publish of index.html and doc/a.html
    When a site with only a new index.html is published
    Then 2 files are removed and doc/a.html is gone
    And index.html holds the new content
    And CNAME and the STAGING preview still exist

  @test:scripts/tests/sdlc/publish-main-site.test.ts::publish-main-site_(bean_5uuf)::a_site_that_writes_into_a_reserved_path_is_refused_before_anything_changes
  Scenario: A site that writes into a reserved path is refused before anything changes
    Given a Pages tree with a STAGING preview
    When a site that writes the same STAGING path is published
    Then it fails as "reserved"
    And the preview is unchanged and no manifest is written

  @test:scripts/tests/sdlc/publish-main-site.test.ts::publish-main-site_(bean_5uuf)::an_empty_site_is_refused,_so_main_keeps_its_last_site
  Scenario: An empty site is refused, so main keeps its last site
    Given a Pages tree with an index.html
    When an empty site is published
    Then it fails as "empty"
    And the old index.html is kept

  @test:scripts/tests/sdlc/publish-main-site.test.ts::publish-main-site_(bean_5uuf)::a_manifest_naming_a_path_outside_the_main_site_is_refused,_not_followed
  Scenario: A manifest naming a path outside the main site is refused, not followed
    Given a Pages tree whose manifest lists a STAGING preview file
    When a site is published
    Then it fails saying the path is "not the main site's"
    And the STAGING preview still exists

  @test:scripts/tests/sdlc/publish-main-site.test.ts::publish-main-site_(bean_5uuf)::a_manifest_that_is_not_one_is_an_error,_never_read_as_'no_manifest'
  Scenario: A malformed manifest is an error, never read as no manifest
    Given a Pages tree whose manifest is an empty JSON object
    When a site is published
    Then it fails naming the "folio-main-site/v1" schema

  @test:scripts/tests/sdlc/publish-main-site.test.ts::publish-main-site_(bean_5uuf)::own_paths_exclude_escapes_and_reserved_names
  Scenario: Own paths exclude escapes and reserved names
    Given candidate paths for the main site
    When each is checked for being an own path
    Then "doc/a.html" is an own path
    And the empty path, an absolute path, "../x", "a/../b", "./a", STAGING, _render-log, the manifest and .git paths are not
