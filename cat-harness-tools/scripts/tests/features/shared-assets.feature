# Shared assets: an IG site loads LHC-Forms, the editor bundle and the harness
# images from one host on its origin. Each Scenario names the test that executes it.
Feature: Shared assets across sites

  @test:scripts/tests/shared-assets.test.ts::shared-assets_—_which_directories,_and_their_addresses::the_fixed_directories_and_every_LHC-Forms_version_a_site_holds
  Scenario: The shared directories are the fixed ones and every LHC-Forms version
    Given a site with harness images, two LHC-Forms versions and another image directory
    Then its shared directories are assets/img/harness/ and both LHC-Forms version directories

  @test:scripts/tests/shared-assets.test.ts::shared-assets_—_which_directories,_and_their_addresses::the_Form_Builder's_bundle,_but_not_the_builder's_own_pages
  Scenario: The Form Builder bundle is shared but not its pages
    Given a site with a formbuilder-bundle version and formbuilder pages
    Then only the formbuilder-bundle version directory is shared

  @test:scripts/tests/shared-assets.test.ts::shared-assets_—_which_directories,_and_their_addresses::the_builder's_worker_finds_a_shared_bundle_through_its_percent-encoded_query_value
  Scenario: The builder's worker bundle query value is rewritten
    Given a service worker registration whose bundle query value is a percent-encoded relative path
    When it is rewritten to the shared bundle URL
    Then one reference is rewritten to the percent-encoded shared URL

  @test:scripts/tests/shared-assets.test.ts::shared-assets_—_which_directories,_and_their_addresses::the_key_is_the_content,_or_the_build_record_when_the_bundle_carries_one
  Scenario: The key is the content, or the build record
    Then two directories with the same file content have the same digest and a different content a different one
    And two directories with different content but the same .build.json have the same key

  @test:scripts/tests/shared-assets.test.ts::shared-assets_—_which_directories,_and_their_addresses::the_address_names_the_directory_and_its_key
  Scenario: The shared address names the directory and its key
    Then the shared URL of assets/img/harness/ with key abc is the host's shared/assets/img/harness/abc/

  @test:scripts/tests/shared-assets.test.ts::rewriteRefs_—_addresses_change,_prose_does_not::CSS_url(),_attributes,_the_rail's_root_prefix
  Scenario: CSS urls, attributes and the rail root prefix are rewritten
    Given a page referencing harness images by a relative CSS url, a rooted src, a data attribute and the rail root prefix
    When the references are rewritten
    Then all 4 point at the shared URL

  @test:scripts/tests/shared-assets.test.ts::rewriteRefs_—_addresses_change,_prose_does_not::a_path_in_prose,_or_on_another_host,_is_left_alone
  Scenario: Prose and other hosts are left alone
    Given a path in a code element and a link to another host
    When the references are rewritten
    Then the text is unchanged and nothing is counted

  @test:scripts/tests/shared-assets.test.ts::rewriteRefs_—_addresses_change,_prose_does_not::a_percent-encoded_relative_query_value_(the_Form_Builder's_worker)
  Scenario: A percent-encoded relative query value is rewritten
    Given a worker URL with an index and an lhc query value
    When the LHC-Forms directory is rewritten
    Then only the lhc value becomes the encoded shared URL and the index value is unchanged

  @test:scripts/tests/shared-assets.test.ts::rewriteRefs_—_addresses_change,_prose_does_not::a_script's_relative_module_literal,_resolved_from_the_script_(the_SQLite_and_Graphviz_loaders)
  Scenario: A script's relative module literal is resolved from the script
    Given the SQLite loader with a module URL, a comment naming the directory, and a worker URL
    When it is rewritten from assets/js/slice-sqlite.js
    Then only the module URL is rewritten, the comment and worker are unchanged
    And a deeper script's climbing import is rewritten
    And without a source script, or from a page, nothing is rewritten

  @test:scripts/tests/shared-assets.test.ts::rewriteRefs_—_addresses_change,_prose_does_not::a_page_names_each_shared_directory_in_a_meta
  Scenario: A page names each shared directory in a meta
    When a meta is added for the crepe directory
    Then a fa-shared-asset meta with its directory and URL is inserted at the start of head

  @test:scripts/tests/shared-assets.test.ts::shareAssets_—_the_site_points_at_the_host_and_drops_its_copies::a_served_directory_is_shared_and_deleted;_one_the_host_lacks_is_kept
  Scenario: A directory the host serves is shared and deleted; one it lacks is kept
    Given a page referencing harness images and an LHC-Forms version, and a host serving only the images
    When the site's assets are shared
    Then the images are shared with 1 reference and their directory is deleted
    And the LHC-Forms directory is kept and still referenced locally
    And the page carries no fa-shared-asset meta

  @test:scripts/tests/shared-assets.test.ts::shareAssets_—_the_site_points_at_the_host_and_drops_its_copies::the_vendored_SQLite_and_Graphviz_builds_are_shared;_the_SQLite_Worker_stays_on_the_site
  Scenario: Vendored SQLite and Graphviz builds are shared, the worker stays
    Given a site with the SQLite loader and worker, the graph script and their vendored builds
    Then both vendor directories are shared directories
    When the site's assets are shared with a host serving everything
    Then each is shared with 1 reference and deleted
    And the loader imports the shared SQLite URL but keeps its local worker, which still exists
    And the graph script imports the shared Graphviz URL

  @test:scripts/tests/shared-assets.test.ts::shareAssets_—_the_site_points_at_the_host_and_drops_its_copies::the_editor_bundle,_found_at_run_time,_is_named_in_each_page's_meta
  Scenario: The editor bundle is named in each page's meta
    Given a page and the crepe editor bundle
    When the site's assets are shared
    Then the page has a fa-shared-asset meta for assets/vendor/crepe/ with its shared URL

  @test:scripts/tests/shared-assets.test.ts::shareAssets_—_the_site_points_at_the_host_and_drops_its_copies::the_host_stages_each_directory_once,_at_its_key,_with_a_listing
  Scenario: The host stages each directory once at its key
    When the host stages a site's harness images
    Then the directory is written at shared/assets/img/harness/<digest> with a .shared.json listing a.webp
    And staging again writes nothing

  @test:scripts/tests/shared-assets.test.ts::sharedAssetsOf_—_the_IG_opts_in::an_https_URL_ending_in_/_is_the_host;_anything_else_is_none
  Scenario: The IG opts in with an https URL ending in /
    Then site.sharedAssets of an https URL ending in / is that host
    And an http URL, an https URL without a trailing slash, or no setting gives none

  @test:scripts/tests/shared-assets.test.ts::pagesBranchUrl_—_a_Pages_address_read_through_its_gh-pages_branch::a_project_site_maps_to_its_repository's_gh-pages_branch
  Scenario: A project Pages URL maps to its gh-pages branch
    Then a litlfred.github.io/smart-html-jtd URL maps to raw.githubusercontent.com on the gh-pages branch

  @test:scripts/tests/shared-assets.test.ts::pagesBranchUrl_—_a_Pages_address_read_through_its_gh-pages_branch::any_other_host_has_no_branch
  Scenario: Any other host has no branch URL
    Then an example.org URL maps to nothing
