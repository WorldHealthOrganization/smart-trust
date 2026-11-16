# scripts/lib/index-pages.ts: pagesBuildsFor works out which declared docs directories index:render must build
# with each instance's "<instance>:pages" script before it renders. Each Scenario names the test that executes it.
Feature: index:render builds the declared pages first

  @test:scripts/tests/ui/index-pages.test.ts::pagesBuildsFor:_what_index:render_builds_before_it_renders::a_built_docs_directory_that_is_not_on_disk_is_built_by_its_`<instance>:pages`
  Scenario: A built docs directory that is not on disk is built by its instance's pages script
    Given an instance "ig" whose docs directory has a writer and is not on disk, and a package script "ig:pages"
    When the pages builds are computed
    Then one build is asked for: instance "ig", script "ig:pages", dirs ["docs/"]

  @test:scripts/tests/ui/index-pages.test.ts::pagesBuildsFor:_what_index:render_builds_before_it_renders::one_already_on_disk_is_not_rebuilt:_only_its_presence_is_read
  Scenario: A built docs directory already on disk is not rebuilt
    Given an instance "built" with a writer, a "built:pages" script, and its docs directory on disk
    When the pages builds are computed
    Then no build is asked for

  @test:scripts/tests/ui/index-pages.test.ts::pagesBuildsFor:_what_index:render_builds_before_it_renders::an_authored_docs_directory_(no_writer),_or_no_pages_script,_asks_for_no_build
  Scenario: An authored docs directory, or one with no pages script, asks for no build
    Given an instance "authored" whose docs directory has no writer
    And an instance "noscript" with a writer but no pages script
    When the pages builds are computed for each
    Then neither asks for a build
