# scripts/docs-rendered-impact.ts is the docs site's renderer (bean bnjs): it maps changed source files to the
# pages of the composed just-the-docs site, or reports them undetermined. Each Scenario names the test that executes it.
Feature: Rendered impact of a change on the docs site

  @test:scripts/tests/docs-rendered-impact.test.ts::mapping_a_source_file_into_the_composed_tree::a_docs_layer_lands_at_the_root,_a_composed_instance_under_its_name,_anything_else_nowhere
  Scenario: A docs layer lands at the site root, a composed instance under its name, anything else nowhere
    Given mounts placing cat-harness/site-chrome/, cat-harness/docs/ and docs/ at the root and smart-trust/docs/ under "smart-trust/"
    Then "cat-harness/docs/guides/a.md" composes to "guides/a.md"
    And "docs/b.md" composes to "b.md"
    And "smart-trust/docs/c.md" composes to "smart-trust/c.md"
    And "cat-harness/scripts/x.ts" composes to nothing

  @test:scripts/tests/docs-rendered-impact.test.ts::mapping_a_source_file_into_the_composed_tree::a_page_renders_at_its_permalink,_or_at_the_same_path_as_.html
  Scenario: A page renders at its permalink, or at its own path as .html
    Then "guides/a.md" with no permalink renders at "guides/a.html"
    And "es/index.md" with permalink "/es/" renders at "es/index.html"
    And a permalink "/y/z" renders at "y/z/index.html" and "/y.html" at "y.html"
    And text with no front matter has none, and a quoted permalink "/p/" is read

  @test:scripts/tests/docs-rendered-impact.test.ts::docsRenderedImpact::a_page,_an_asset_and_the_search_index_every_page_change_moves
  Scenario: A changed page and asset reach the page, the asset and the search index
    Given a change to "guides/onboarding.md" and to the site-chrome asset "assets/css/docs-ui.css"
    When the rendered impact is computed
    Then it is the data file "assets/css/docs-ui.css", the search index, and the content page "guides/onboarding.html"

  @test:scripts/tests/docs-rendered-impact.test.ts::docsRenderedImpact::an_asset_alone_does_not_move_the_search_index
  Scenario: An asset change alone does not move the search index
    Given a change to the site-chrome asset "assets/css/docs-ui.css" only
    When the rendered impact is computed
    Then it is the data file "assets/css/docs-ui.css" only

  @test:scripts/tests/docs-rendered-impact.test.ts::docsRenderedImpact::an_asset_hashed_by_fa_asset_version_reaches_the_pages_or_theme_includes_that_hash_it
  Scenario: An asset hashed by fa_asset_version reaches the pages or theme includes that hash it
    Given a page "guides/styled.md" that hashes "/assets/css/page.css", and the theme include head_custom.html that hashes "/assets/js/docs-ui.js"
    When a change to "assets/css/page.css" is computed
    Then it reaches the asset, the search index and "guides/styled.html", with nothing undetermined
    And a change to "assets/js/docs-ui.js" reaches only the asset and is undetermined with scope "all"

  @test:scripts/tests/docs-rendered-impact.test.ts::docsRenderedImpact::an_include_reaches_the_pages_that_include_it,_through_other_includes
  Scenario: An include reaches the pages that include it
    # Gap: harnesses.md includes harness_details.html directly; reaching a page through another include is not exercised here
    Given a change to "_includes/harness_details.html"
    When the rendered impact is computed
    Then it is the search index and "harnesses.html"

  @test:scripts/tests/docs-rendered-impact.test.ts::docsRenderedImpact::a_data_file_reaches_the_pages_that_read_it,_directly_and_through_an_include
  Scenario: A data file reaches the pages that read it, directly and through an include
    Given the include landing.html reads site.data.stickies and is included by index.md and es/index.md
    When a change to "_data/stickies.json" is computed
    Then it is the search index, "es/index.html" and "index.html"
    And a change to "_data/node-kinds.json" reaches "reference/kinds.html", which reads it directly

  @test:scripts/tests/docs-rendered-impact.test.ts::docsRenderedImpact::Liquid-rendered_non-HTML_templates_(.liquid,_.json_with_front_matter)_render_at_their_permalink_as_data,_without_touching_the_search_index
  Scenario: Liquid-rendered non-HTML templates render at their permalink as data, without the search index
    Given a .liquid template and a .json template with front matter that both read site.data.harness
    When a change to "_data/harness.json" is computed
    Then it is the data files "assets/harness/tiles.json" and "assets/js/harness-data.js"
    And a change to the template "assets/js/harness-data.liquid" itself is the data file "assets/js/harness-data.js" only

  @test:scripts/tests/docs-rendered-impact.test.ts::docsRenderedImpact::an_include_the_THEME_defines,_one_nothing_calls,_or_one_a_layout_calls,_can_change_any_page
  Scenario: A theme include, an uncalled include, a layout's include, a layout or the config can change any page
    Given changes to "_includes/head_custom.html", "_includes/orphan.html", "_includes/wide_nav.html", "_layouts/wide.html" and "_config.yml" in turn
    When each rendered impact is computed
    Then each reaches no file
    And each is undetermined with scope "all"

  @test:scripts/tests/docs-rendered-impact.test.ts::docsRenderedImpact::with_no_readable_theme,_EVERY_include_is_site-wide:_never_'no_page'
  Scenario: With no readable theme every include is site-wide
    Given the site indexed with no theme include list
    When the pages reached by "_includes/harness_details.html" are computed
    Then the result is "all"

  @test:scripts/tests/docs-rendered-impact.test.ts::docsRenderedImpact::a_removed_page_is_reported_removed
  Scenario: A removed page is reported removed
    Given a change to "guides/gone.md", which can no longer be read
    When the rendered impact is computed
    Then its files include "guides/gone.html" as removed

  @test:scripts/tests/docs-rendered-impact.test.ts::docsRenderedImpact::a_file_outside_the_tree:_undetermined_when_the_staging_cone_carries_anything,_nothing_when_it_reaches_nothing
  Scenario: A file outside the tree is undetermined when the staging cone carries anything, and nothing otherwise
    Given a change to "cat-harness/scripts/gen.ts" whose staging cone carries "cat-harness/kg"
    When the rendered impact is computed
    Then it reaches no file and is undetermined with scope "unknown", the reason naming "cat-harness/kg"
    And a change to "README.md" whose cone carries nothing reaches no file, is not undetermined, and is listed as an input

  @test:scripts/tests/docs-rendered-impact.test.ts::docsRenderedImpact::a_site_prefix_is_put_in_front_of_every_path
  Scenario: A site prefix is put in front of every path
    Given a change to "guides/onboarding.md" with site "STAGING/x"
    When the rendered impact is computed
    Then it is the search index and "guides/onboarding.html", each under "STAGING/x/"
