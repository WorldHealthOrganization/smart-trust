# Guards the docs site's HTML against an opening comment delimiter inside an already-open comment,
# the only detectable way to close a comment early by accident. Each Scenario names the test that executes it.
Feature: HTML comments in the docs site never nest

  @test:scripts/tests/ui/html-comment-delimiters.test.ts::HTML_comments_in_the_docs_site::never_open_a_comment_inside_an_open_comment
  Scenario: No docs site page opens a comment inside an open comment
    Given the declared site root of the harness
    When every HTML file under it is scanned comment by comment
    Then the site root exists
    And no comment body contains an opening comment delimiter

  @test:scripts/tests/ui/html-comment-delimiters.test.ts::HTML_comments_in_the_docs_site::detects_the_exact_shape_of_the_2026-09-19_defect
  Scenario: The scan detects the exact shape of the 2026-09-19 defect
    Given a comment whose second line spells both an opening and a closing comment delimiter
    When it is scanned
    Then exactly one nested opener is reported
    And it is reported on line 2

  @test:scripts/tests/ui/html-comment-delimiters.test.ts::HTML_comments_in_the_docs_site::passes_a_comment_that_merely_talks_about_comments_without_spelling_one
  Scenario: A comment that talks about comments without spelling one passes
    Given a comment reading "the comment wrapper means nothing to Liquid"
    When it is scanned
    Then no nested opener is reported
