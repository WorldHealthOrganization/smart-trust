# scripts/mount-instance-docs.ts renders the hand-written markdown pages a mounted
# directory publishes (renderMountedMarkdown), rewriting links that leave the mount.
# Each Scenario names the test that executes it.
Feature: A mount renders the markdown pages it publishes

  @test:scripts/tests/ui/mount-render-markdown.test.ts::renderMountedMarkdown::renders_a_hand-written_page_beside_its_source,_tables_and_links_included
  Scenario: A hand-written page is rendered to HTML beside its source, with tables and links
    Given a site with "style-guide.md" holding a heading, a table and a link to "style-guide-agents.md#rules"
    And a site page "style-guide-agents.md"
    When the mounted markdown is rendered
    Then the rendered pages are "style-guide-agents.html" and "style-guide.html"
    And "style-guide.html" has the title "The WHO style guide"
    And it contains a table
    And the link points to "style-guide-agents.html#rules"
    And "style-guide.md" still exists

  @test:scripts/tests/ui/mount-render-markdown.test.ts::renderMountedMarkdown::never_overwrites_a_generated_page,_and_leaves_a_Jekyll_page_(front_matter)_alone
  Scenario: A generated page is never overwritten and a Jekyll page is left alone
    Given a site with a generated "index.html", "kg-to-portal.md" beside a generated "kg-to-portal.html", a Jekyll "site-home.md" with front matter, and "README.md"
    When the mounted markdown is rendered
    Then only "README.html" is rendered
    And "kg-to-portal.html" and "index.html" still hold the generated content
    And no "site-home.html" is written

  @test:scripts/tests/ui/mount-render-markdown.test.ts::renderMountedMarkdown::renders_a_page_whose_front_matter_is_only_`generated:`,_with_the_block_stripped
  Scenario: A page whose front matter is only a generated key is rendered with the block stripped
    Given "sub/README.md" whose front matter holds only a "generated" key, followed by a heading and a table
    And "page.md" whose front matter holds "generated" and "title"
    When the mounted markdown is rendered
    Then the rendered pages are "sub/README.html" and "sub/index.html"
    And "sub/README.html" has the title "Sub" and contains a table
    And it contains neither "generated:" nor a horizontal rule
    And no "page.html" is written

  @test:scripts/tests/ui/mount-render-markdown.test.ts::renderMountedMarkdown::generatedOnlyFrontMatter:_one_top-level_`generated`_key,_nothing_else
  Scenario: Only front matter with one top-level generated key counts as generated-only
    When generatedOnlyFrontMatter reads a page whose front matter is only "generated: x"
    Then it returns that front matter block, with LF or CRLF line endings kept
    And front matter with a comment and a folded multi-line "generated" value is recognised
    And front matter with another key, an empty "generated" value, only "layout", or no front matter at all gives undefined

  @test:scripts/tests/ui/mount-render-markdown.test.ts::renderMountedMarkdown::a_README_becomes_the_directory's_index_when_it_has_none,_in_subdirectories_too
  Scenario: A README becomes its directory's index when the directory has none
    Given a site holding only "sub/README.md"
    When the mounted markdown is rendered
    Then the rendered pages are "sub/README.html" and "sub/index.html"

  @test:scripts/tests/ui/mount-render-markdown.test.ts::renderMountedMarkdown::a_link_leaving_the_mount_becomes_a_repository_URL;_one_leaving_the_instance_is_unresolved
  Scenario: A link leaving the mount becomes a repository URL and one leaving the instance is unresolved
    Given an instance whose site directory and its mounted copy hold "a.md", an "assets/" directory and "guide/README.md"
    And "a.md" links "../library/", "../AGENTS.md#top", "style-guide.md", "../../AGENTS.md", an external URL, "assets/" and "guide/"
    When the mounted markdown is rendered for repository "example/who-iris"
    Then the rendered pages are "a.html", "guide/README.html" and "guide/index.html"
    And "../library/" becomes "https://github.com/example/who-iris/tree/HEAD/library/"
    And "../AGENTS.md#top" becomes "https://github.com/example/who-iris/blob/HEAD/AGENTS.md#top"
    And "style-guide.md" becomes "style-guide.html" and the external URL is kept
    And "assets/" becomes "https://github.com/example/who-iris/tree/HEAD/docs/assets/" while "guide/" stays a page link
    And the only unresolved entry says "../../AGENTS.md" climbs out of the instance

  @test:scripts/tests/ui/mount-render-markdown.test.ts::renderMountedMarkdown::a_link_to_what_the_copy_left_out,_or_to_a_Jekyll_page_it_never_renders,_becomes_a_repository_URL
  Scenario: A link to a held-back directory or an unrendered Jekyll page becomes a repository URL
    Given an instance site directory with "catalogue/index.html", a Jekyll "site-home.md", "style-guide.md" and a "README.md" linking all three
    And a mounted copy that leaves out "catalogue/"
    When the mounted markdown is rendered for repository "example/who-iris"
    Then "catalogue/" becomes "https://github.com/example/who-iris/tree/HEAD/docs/catalogue/"
    And "site-home.md" becomes "https://github.com/example/who-iris/blob/HEAD/docs/site-home.md"
    And "style-guide.md" becomes "style-guide.html"
    And nothing is unresolved
