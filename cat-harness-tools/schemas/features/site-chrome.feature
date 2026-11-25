# The site chrome subgraph (schemas/kg/cat-harness.js: siteLayersFor, siteChromeDirFor,
# siteFileFor) and cat-harness's own site-chrome/ templates and Jekyll plugins.
# Each Scenario names the test that executes it.
Feature: Site layers and the cat-harness site chrome

  @test:schemas/site-chrome.test.ts::site_layers::one_docs_directory:_every_answer_is_siteDirFor's
  Scenario: With one docs directory, every site answer is siteDirFor's
    Given an instance declaring only a docs directory at the site directory
    When its site layers, chrome directory and a site file are resolved
    Then the layers are just the site directory
    And the chrome directory is the site directory
    And "assets/css/a.css" resolves under the site directory

  @test:schemas/site-chrome.test.ts::site_layers::a_chrome_layer_declared_first_is_the_base;_a_file_resolves_to_the_top-most_layer_holding_it
  Scenario: A chrome layer declared first is the base, and a file resolves to the top-most layer holding it
    Given an instance declaring "chrome/", "pages/" and a repository-scoped "../pages/" docs directory
    And "chrome" holds "_includes/head_custom.html" and "_config.yml", and "pages" holds "_config.yml"
    When its site layers are read
    Then they are "chrome", "pages" and the site directory, and the repository-scoped one is not a layer
    And the chrome directory is "chrome"
    And "_includes/head_custom.html" resolves to "chrome" and "_config.yml" to "pages"
    And a file held by no layer, "assets/css/new.css", resolves to "chrome"

  @test:schemas/site-chrome.test.ts::cat-harness's_own_site_chrome::is_declared_before_docs,_so_it_is_the_base_layer
  Scenario: cat-harness's chrome is declared before docs, so it is the base layer
    Given the cat-harness instance
    When its site layers are read
    Then they are "site-chrome" then the site directory
    And the chrome directory is "site-chrome"

  @test:schemas/site-chrome.test.ts::cat-harness's_own_site_chrome::holds_the_chrome_the_slice_moved,_and_docs/_no_longer_does
  Scenario: cat-harness's chrome holds the files the slice moved, and docs/ no longer does
    Given the cat-harness instance
    When the moved chrome files are resolved, such as "_includes/head_custom.html", "assets/css/docs-ui.css" and "Gemfile"
    Then each resolves to the chrome directory and is absent from the site directory
    And the harness pages' own assets, such as "assets/js/work-plan.js", still resolve to the site directory

  @test:schemas/site-chrome.test.ts::cat-harness's_own_site_chrome::an_include_the_chrome_pulls_in_exists_in_the_chrome_alone,_so_a_site_with_no_harness_pages_builds
  Scenario: Includes the chrome pulls in exist in the chrome itself
    # Gap: no site build without harness pages is run; only the files' presence is checked
    Given the cat-harness chrome directory
    Then "_includes/generated/navbar-footer.html" and "_includes/generated/todo-listing.html" exist in it

  @test:schemas/site-chrome.test.ts::cat-harness's_own_site_chrome::the_nav_is_cached:_each_theme_override_looks_its_answer_up_in_a_map_rendered_once_per_build
  Scenario: Each theme override looks the nav up in a map rendered once per build
    # Gap: build cost is not measured; the include lines and the maps' text are checked
    Given the overrides for activation, breadcrumbs and children nav in the chrome
    Then each contains an "include_cached" of its nav_cache map
    And each map exists under the chrome's _includes
    And no map, outside its Liquid comments, reads "page."

  @test:schemas/site-chrome.test.ts::cat-harness's_own_site_chrome::the_two__config.yml_layers_merge_to_a_config_with_the_theme_keys_and_the_site's_identity_(D1)
  Scenario: The two _config.yml layers split the theme keys from the site's identity (D1)
    # Gap: the merged config is not computed; each layer's keys are checked
    Given the chrome's and the docs' _config.yml
    Then the chrome sets remote_theme to just-the-docs and has no title
    And docs sets a title and no remote_theme
    And docs' exclude list contains every entry of the chrome's

  @test:schemas/site-chrome.test.ts::the_theme's_markup_passes_leave_<script>_and_<style>_alone::the_theme's_pass_alone_breaks_the_script_(the_defect,_reproduced)
  Scenario: The theme's own anchor-heading pass breaks an inline script
    Given a page with headings, an inline script that builds HTML in strings, and a style block
    When it is rendered through the theme's "vendor/anchor_headings_core.html"
    Then at least one inline script no longer parses
    And the first script's body contains "anchor-heading"

  @test:schemas/site-chrome.test.ts::the_theme's_markup_passes_leave_<script>_and_<style>_alone::anchor_headings:_script_and_style_bodies_come_through_byte_for_byte;_every_heading_outside_them_is_anchored
  Scenario: anchor_headings leaves script and style bodies byte for byte and anchors every heading outside them
    Given the same page with headings, an inline script and a style block
    When it is rendered through the chrome's "vendor/anchor_headings.html"
    Then the script and style come through unchanged and every script parses
    And headings "one", "two" and "three" each get an anchor-heading link
    And the text "after text " is kept and "<hafter" never appears

  @test:schemas/site-chrome.test.ts::the_theme's_markup_passes_leave_<script>_and_<style>_alone::anchor_headings:_content_with_no_script_or_style_is_exactly_the_theme's_pass
  Scenario: anchor_headings on content with no script or style matches the theme's pass exactly
    Given plain content with headings, code, a rule and a heading with no id
    When it is rendered through the override and through the theme's core include
    Then both outputs are identical

  @test:schemas/site-chrome.test.ts::the_theme's_markup_passes_leave_<script>_and_<style>_alone::table_wrappers:_tables_outside_raw_text_are_wrapped,_the_script's_are_not
  Scenario: table_wrappers wraps tables outside raw text and leaves the script's alone
    Given a whole page with a style in the head, one table in the body and the inline script
    When the chrome's table_wrappers layout renders it
    Then the script and style come through unchanged
    And the body table is wrapped in a "table-wrapper" div
    And "table-wrapper" appears exactly once and every script parses

  @test:schemas/site-chrome.test.ts::the_theme's_markup_passes_leave_<script>_and_<style>_alone::the_theme's_include_is_kept,_renamed,_for_the_override_to_call
  Scenario: The theme's include is kept, renamed, for the override to call
    Given the chrome's vendor includes
    Then "anchor_headings_core.html" credits the jekyll-anchor-headings project
    And "anchor_headings.html" includes "vendor/anchor_headings_core.html"

  @test:schemas/site-chrome.test.ts::first-party_asset_versions::no_template_prints_site.time,_so_a_rebuild_with_no_source_change_renders_the_same_bytes
  Scenario: No template prints site.time
    # Gap: no rebuild is run; template text is scanned
    Given every html, md, liquid, scss, js and json file under site-chrome/ and docs/
    Then none prints site.time in a Liquid output or tag

  @test:schemas/site-chrome.test.ts::first-party_asset_versions::every_?v=_in_head_custom.html_hashes_the_very_asset_its_URL_names
  Scenario: Every ?v= in head_custom.html hashes the very asset its URL names
    Given the chrome's head_custom.html
    When its relative_url tags with a ?v= filter are found
    Then there are at least 10
    And each hashes the same path as its URL, with the "fa_asset_version" filter
    And every ?v= in the file is one of those tags or a "?v=<content hash>" note

  @test:schemas/site-chrome.test.ts::first-party_asset_versions::harness-data.js,_which_carries_live_counts,_is_loaded_with_no_?v
  Scenario: harness-data.js is loaded with no ?v
    Given the chrome's head_custom.html
    Then the script tag for "/assets/js/harness-data.js" has nothing after its URL

  @test:schemas/site-chrome.test.ts::first-party_asset_versions::the_filter_is_defined_in_the_chrome,_so_every_site_that_mounts_the_chrome_has_it
  Scenario: The fa_asset_version filter is defined in the chrome's plugin
    Given the chrome's "_plugins/fa-asset-version.rb"
    Then it defines "fa_asset_version", registers the filter, and hooks the site's post_render
    And its code, outside comments, never names site.time or Time.now

  @test:schemas/site-chrome.test.ts::the_chrome's_includes_carry_no_HTML_comments_into_pages::every_HTML_comment_outside_<script>/<style>_is_a_fa-_marker
  Scenario: Every HTML comment in the chrome's includes outside script and style is a fa- marker
    Given every .html include in the chrome, except under vendor/
    When each is parsed with an HTML parser
    Then no comment remains other than conditional comments and short "fa-" markers

  @test:schemas/site-chrome.test.ts::page-relative_links::the_plugin_swaps_the_base_for_a_token_once_the_site_is_read,_before_generators_run,_and_resolves_it_after_rendering
  Scenario: The root-relative plugin swaps the base for a token after reading and resolves it after rendering
    # Gap: the plugin is not run; its Ruby source is matched
    Given the chrome's "_plugins/fa-root-relative.rb"
    Then a post_read site hook calls swap_in
    And a post_render site hook calls resolve
    And an ensure clause puts the real baseurl back

  @test:schemas/site-chrome.test.ts::page-relative_links::an_absolute_URL_keeps_the_real_base:_an_identity_is_never_relativized
  Scenario: An absolute URL keeps the real base
    # Gap: the plugin is not run; its Ruby source is matched
    Given the chrome's "_plugins/fa-root-relative.rb"
    Then an origin-qualified URL is built from the origin and the real base

  @test:schemas/site-chrome.test.ts::page-relative_links::404.html_keeps_the_real_base:_GitHub_Pages_serves_it_at_whatever_depth_was_missing
  Scenario: 404.html keeps the real base
    # Gap: the plugin is not run; its Ruby source is matched
    Given the chrome's "_plugins/fa-root-relative.rb"
    Then it returns false for an item whose url is "/404.html"

  @test:schemas/site-chrome.test.ts::page-relative_links::fa-staging_says_only_WHETHER_this_is_a_preview,_never_which_one
  Scenario: fa-staging says only whether this is a preview, never which one
    Given the chrome's head_custom.html
    Then its fa-staging meta line is exactly a content of "preview" when a staging slug is set, else empty
