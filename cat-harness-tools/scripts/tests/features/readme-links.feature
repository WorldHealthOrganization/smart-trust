# readme_audit: link verification over authored README prose. A Pages URL
# resolves against the publish ref, an unreadable ref makes its links
# unchecked rather than dead, and a shell example is not a link. The options
# name repository owner/repo, Pages base https://owner.github.io/repo and
# publish ref gh-pages. Each Scenario names the test that executes it.
Feature: README links are verified against what is published

  @test:scripts/tests/readme-links.test.ts::parsing::finds_inline_links,_images_and_reference_definitions,_with_line_numbers
  Scenario: Inline links, images and reference definitions are found with line numbers
    When "See [one](a.md) and ![img](b.png)." on line 3 and "[ref]: c.md" on line 5 are parsed
    Then the links are a.md and b.png on line 3, and c.md on line 5

  @test:scripts/tests/readme-links.test.ts::parsing::a_fenced_shell_example_is_not_a_link,_and_line_numbers_survive_it
  Scenario: A fenced shell example is not a link
    Given a fenced bash block holding "[thing](not-a-link)", then "[real](after.md)" on line 7
    When it is parsed
    Then the only link is after.md on line 7

  @test:scripts/tests/readme-links.test.ts::parsing::HTML_`<img_src>`_and_`<a_href>`_are_links_too_—_the_t373_hole
  Scenario: HTML img src and a href are links
    When an img with src after another attribute, an a with single-quoted href, and an img with src after alt are parsed
    Then the targets are docs/a.svg, docs/b.md and docs/c.png on lines 1, 2 and 3

  @test:scripts/tests/readme-links.test.ts::parsing::the_src_attribute_is_found_wherever_it_sits_in_the_tag
  Scenario: The src attribute is found wherever it sits
    Then '<img src="a.svg">', an img with src among other attributes, and '<IMG SRC="c.svg">' each yield their src

  @test:scripts/tests/readme-links.test.ts::parsing::an_HTML_tag_with_no_src_or_href_contributes_no_link
  Scenario: An HTML tag without src or href is no link
    When a br, a div, an img with only alt, and an a with no href are parsed
    Then there are no links

  @test:scripts/tests/readme-links.test.ts::parsing::a_link_title_is_not_part_of_the_target
  Scenario: A link title is not part of the target
    Then '[x](a.md "Title")' targets "a.md"

  @test:scripts/tests/readme-links.test.ts::classification::a_Pages_URL_resolves_against_the_publish_ref_the_site_is_served_from
  Scenario: A Pages URL resolves against the publish ref
    Then "https://owner.github.io/repo/lean/docs/" is ref "gh-pages" path "/lean/docs/"

  @test:scripts/tests/readme-links.test.ts::classification::blob,_tree_and_raw_links_name_their_own_ref
  Scenario: blob, tree and raw links name their own ref
    Then blob, tree and raw links to gh-pages/a.pdf are ref "gh-pages" path "a.pdf"
    And a blob link to main/src/x.ts is ref "main" path "src/x.ts"

  @test:scripts/tests/readme-links.test.ts::classification::another_repo,_an_anchor_and_a_mailto_are_unchecked,_not_dead
  Scenario: Another repository, an external URL, an anchor and a mailto are unchecked
    Then each is classified "unchecked"

  @test:scripts/tests/readme-links.test.ts::classification::fragments_and_percent-encoding_are_stripped_from_the_path
  Scenario: Fragments and percent-encoding are stripped
    Then "docs/a%20b.md#sec" is the worktree path "docs/a b.md"

  @test:scripts/tests/readme-links.test.ts::auditing::a_missing_relative_path_is_dead,_with_the_line_it_is_on
  Scenario: A missing relative path is dead, with its line
    Given a repository holding real.md
    When "[ok](real.md)" and "[bad](gone.md)" on line 3 are audited
    Then one is ok and one is dead: "bad" to "gone.md" on line 3

  @test:scripts/tests/readme-links.test.ts::auditing::the_qou_case:_a_table_row_pointing_at_a_path_never_published
  Scenario: A table row pointing at a path never published is dead
    Given gh-pages holds only lean/docs/index.html
    When table rows linking tree/gh-pages/lean/docs and tree/gh-pages/blueprint are audited
    Then one is ok and the only dead link is "blueprint/"

  @test:scripts/tests/readme-links.test.ts::auditing::a_directory_resolves_when_anything_sits_under_it
  Scenario: A directory resolves when anything sits under it
    Given gh-pages holds python-api/index.html
    When a Pages link to python-api/ is audited
    Then nothing is dead and one is ok

  @test:scripts/tests/readme-links.test.ts::auditing::an_unreadable_ref_makes_its_links_unchecked_—_never_dead
  Scenario: An unreadable ref makes its links unchecked
    Given gh-pages exists
    When a blob link to "no-such-ref" is audited
    Then nothing is dead, nothing is checked, and the unchecked reason says "not readable"

  @test:scripts/tests/readme-links.test.ts::auditing::external_links_are_counted,_not_fetched
  Scenario: External links are counted, not fetched
    When a link to https://example.com/x is audited
    Then nothing is checked and one is counted as "external URL (not fetched)"

  @test:scripts/tests/readme-links.test.ts::runReadmeAudit::exits_1_and_names_the_file_and_line_when_a_link_is_dead
  Scenario: A dead link exits 1 naming file and line
    Given a README whose line 3 links missing.md
    When the README audit runs
    Then it exits 1 and says "README.md:3" and "1 dead"

  @test:scripts/tests/readme-links.test.ts::runReadmeAudit::a_dead_HTML_<img_src>_fails_the_audit,_exactly_as_a_dead_Markdown_link_does
  Scenario: A dead HTML img fails the audit
    Given a README with a live img on line 3 and an img of gone.svg on line 4
    When the README audit runs
    Then it exits 1 and says "README.md:4", "gone.svg", "2 link(s) checked" and "1 dead"

  @test:scripts/tests/readme-links.test.ts::runReadmeAudit::exits_0_on_a_clean_file_and_still_reports_what_it_could_not_check
  Scenario: A clean file exits 0 and reports what it could not check
    Given a README linking an existing file and an external URL
    When the README audit runs
    Then it exits 0 and says "1 not checked"

  @test:scripts/tests/readme-links.test.ts::runReadmeAudit::a_missing_file_is_an_error,_not_a_clean_pass
  Scenario: A missing README is an error
    When the README audit runs in a repository with no README
    Then it exits 2

  @test:scripts/tests/readme-links.test.ts::runReadmeAudit_and_a_declared_move::a_link_to_the_old_path_passes_in_the_window,_reported_as_moved
  Scenario: A link to a moved path passes within the move's window
    Given a layer declaring a move from "old" to "new" until 2099-12-31, and a README linking old/x.md
    When the README audit runs
    Then it exits 0 and says "1 through a declared move"

  @test:scripts/tests/readme-links.test.ts::runReadmeAudit_and_a_declared_move::an_expired_move_gives_no_relief
  Scenario: An expired move gives no relief
    Given the same move until 2020-01-01
    When the README audit runs
    Then it exits 1 and says "1 dead"
