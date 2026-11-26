# readme_toc, the folio contents table: papers and chapters in manifest
# order, a PDF link only when the publish branch holds the PDF, and the table
# injected between marker comments. Fixture folios are scratch trees with a
# publish branch built by git plumbing. Each Scenario names the test that
# executes it.
Feature: The folio README contents table

  @test:scripts/tests/readme-toc.test.ts::discovery::papers_come_in_folio.ts_order,_not_readdir_order
  Scenario: Papers come in folio.ts order
    Given a folio whose folio.ts lists papers zeta, alpha and mu
    When its papers are discovered
    Then they are zeta, alpha, mu in that order

  @test:scripts/tests/readme-toc.test.ts::discovery::a_folio_with_no_folio.ts_falls_back_to_the_directory_scan
  Scenario: A folio with no folio.ts falls back to the directory scan
    Given a folio with the paper directory "solo" and no folio.ts
    When its papers are discovered
    Then the only paper is "solo"

  @test:scripts/tests/readme-toc.test.ts::discovery::chapters_keep_manifest_order_and_are_classified_by_prefix
  Scenario: Chapters keep manifest order and are classified by prefix
    Given a paper whose manifest lists intro, appendix-tables and index-of-definitions
    When its chapters are read
    Then their kinds are chapter, appendix and index in that order

  @test:scripts/tests/readme-toc.test.ts::PDF_links_are_verified,_not_composed::a_published_chapter_links;_an_unpublished_one_renders_an_em_dash
  Scenario: Only a published chapter gets a PDF link, and an unpublished one keeps its row
    # Gap: the em dash is not asserted; only that the unpublished chapter has no PDF link and its title still appears
    Given a paper with chapters one and two, and a gh-pages branch holding only one's PDF
    When the table is rendered
    Then it links one's PDF at its GitHub blob URL
    And it holds no link to two's PDF, but still holds two's title

  @test:scripts/tests/readme-toc.test.ts::PDF_links_are_verified,_not_composed::nothing_published_means_no_PDF_link_anywhere
  Scenario: Nothing published means no PDF link anywhere
    Given a gh-pages branch holding only index.html
    When the table is rendered
    Then it mentions no .pdf, and chapter one of paper p is reported missing its PDF

  @test:scripts/tests/readme-toc.test.ts::PDF_links_are_verified,_not_composed::an_unreadable_publish_ref_is_reported,_not_silently_rendered_as_unpublished
  Scenario: An unreadable publish ref is reported, not rendered as unpublished
    Given the configured publish ref "no-such-branch" does not exist
    When the table is rendered
    Then the publish ref is flagged unavailable, the table says "PDF links unavailable", and no PDF is counted missing

  @test:scripts/tests/readme-toc.test.ts::link_styles::%s_renders_%s
  Scenario Outline: Each link style renders its URL
    Given a published PDF for chapter one of paper p
    When the table is rendered with the link style <style>
    Then it holds <url>

    Examples:
      | style | url                                                                    |
      | blob  | https://github.com/owner/repo/blob/gh-pages/papers/p/one.pdf           |
      | raw   | https://raw.githubusercontent.com/owner/repo/gh-pages/papers/p/one.pdf |
      | pages | https://example.github.io/repo/papers/p/one.pdf                        |

  @test:scripts/tests/readme-toc.test.ts::link_styles::pages_and_raw_both_warn_that_they_need_a_public_repository
  Scenario: The pages and raw link styles warn that they need a public repository
    # Gap: for raw only the word "public" is checked, not a warning
    Given a published PDF
    When the table is rendered with the pages style
    Then it says "only while Pages is public"
    When the table is rendered with the raw style
    Then it says "public"

  @test:scripts/tests/readme-toc.test.ts::link_styles::blob_says_it_works_for_a_private_repository
  Scenario: The blob link style says it works for a private repository
    Given a published PDF
    When the table is rendered with the default style
    Then it says "private"

  @test:scripts/tests/readme-toc.test.ts::every_paper_in_the_folio_gets_a_table::three_papers,_three_sections
  Scenario: Every paper gets a section, an empty one saying so
    Given papers first, second and third, the last with no chapters
    When the table is rendered
    Then it has a "###" heading for each paper's title
    And it says "_No chapters in this paper's manifest yet._"

  @test:scripts/tests/readme-toc.test.ts::every_paper_in_the_folio_gets_a_table::source_links_are_relative,_so_they_resolve_in_a_private_repo's_web_UI
  Scenario: Source links are relative
    Given paper p with chapter one
    When the table is rendered
    Then it links chapter one's source as [`one/`](folio/p/one/)

  @test:scripts/tests/readme-toc.test.ts::injectSection::replaces_the_marked_region_and_leaves_the_rest_alone
  Scenario: Injection replaces the marked region and leaves the rest alone
    Given a README with "old" between folio:toc markers and a tail after them
    When "new body" is injected
    Then it reports a change, holds "new body" and the tail, and no longer holds "old"

  @test:scripts/tests/readme-toc.test.ts::injectSection::re-injecting_identical_content_is_a_no-op
  Scenario: Re-injecting identical content is a no-op
    Given a README already holding "new body" between its markers
    When "new body" is injected again
    Then it reports no change

  @test:scripts/tests/readme-toc.test.ts::injectSection::missing_markers_throw_rather_than_silently_appending_or_doing_nothing
  Scenario: Injecting into a README without markers throws
    When a body is injected into a README with no folio:toc markers
    Then it throws naming the marker comments
