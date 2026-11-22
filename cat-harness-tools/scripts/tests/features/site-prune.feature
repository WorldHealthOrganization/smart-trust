# What a scoped site leaves out: the PDF viewer when no page embeds it, and
# images no page shows. Each Scenario names the test that executes it.
Feature: Pruning a scoped site

  @test:scripts/tests/site-prune.test.ts::pagesEmbedPdf::a_page_carrying_the_embed_marker_embeds_the_viewer
  Scenario: A page with the embed marker embeds the viewer
    Given a page carrying the PDF embed marker
    Then the site embeds the PDF viewer

  @test:scripts/tests/site-prune.test.ts::pagesEmbedPdf::the_viewer's_own_files_do_not_count,_and_plain_pages_do_not_embed_it
  Scenario: The viewer's own files and plain pages do not embed it
    Given a plain page and the marker only inside the viewer's own directory
    Then the site does not embed the PDF viewer

  @test:scripts/tests/site-prune.test.ts::pruneUnreferencedImages::an_image_a_page,_a_stylesheet_or_a_script_names_is_kept;_the_others_go
  Scenario: Images named by a page, stylesheet or script are kept
    Given images named by a page, by an encoded CSS url and by a script, and two images nobody names
    When unreferenced images are pruned
    Then the two unnamed images, 6 bytes, are removed
    And the named images remain

  @test:scripts/tests/site-prune.test.ts::pruneUnreferencedImages::a_name_with_spaces,_a_comma_or_brackets_is_kept_when_a_page_names_it,_raw_or_encoded
  Scenario: Names with spaces, commas or brackets are matched raw or encoded
    Given workflow images named by pages raw and percent-encoded, and one nobody names
    When unreferenced images are pruned
    Then only the unnamed image, 3 bytes, is removed

  @test:scripts/tests/site-prune.test.ts::pruneUnreferencedImages::a_site_with_no_image_folder_prunes_nothing
  Scenario: A site with no image folder prunes nothing
    When a site with only a page is pruned
    Then nothing is removed
