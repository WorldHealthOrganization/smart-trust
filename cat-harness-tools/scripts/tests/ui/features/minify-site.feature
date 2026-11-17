# scripts/minify-site.ts: minifies the built site's HTML, dropping whitespace and comments a reader never sees while
# keeping verbatim regions, word boundaries, licence, conditional and marker comments. Each Scenario names the test that executes it.
Feature: Site minification drops only what cannot render

  @test:scripts/tests/ui/minify-site.test.ts::verbatim_regions_are_copied_byte_for_byte::a_<pre>_code_sample_keeps_every_newline_and_every_indent
  Scenario: A pre code sample keeps every newline and indent
    Given a highlighted pre/code block with indented lines inside a div
    When the page is minified
    Then the pre block appears byte for byte

  @test:scripts/tests/ui/minify-site.test.ts::verbatim_regions_are_copied_byte_for_byte::an_inline_<code>_span_keeps_its_interior_spacing
  Scenario: An inline code span keeps its interior spacing
    Given the paragraph "<p>Run <code>a   b</code> now</p>"
    When it is minified
    Then it still contains "<code>a   b</code>"

  @test:scripts/tests/ui/minify-site.test.ts::verbatim_regions_are_copied_byte_for_byte::a_<!--_inside_a_script_string_is_not_a_comment
  Scenario: A comment opener inside a script string is not a comment
    Given a script whose string holds "<!-- not a comment -->" followed by a newline and a second statement
    When it is minified
    Then the page is unchanged

  @test:scripts/tests/ui/minify-site.test.ts::verbatim_regions_are_copied_byte_for_byte::a_<style>_block's_declarations_are_untouched
  Scenario: A style block's declarations are untouched
    Given a head holding a style block with "body { color: red }" on its own line
    When it is minified
    Then the style block keeps its newlines and declaration exactly

  @test:scripts/tests/ui/minify-site.test.ts::verbatim_regions_are_copied_byte_for_byte::<textarea>_content_survives
  Scenario: Textarea content survives
    Given a form holding a textarea with indented lines "keep" and "me"
    When it is minified
    Then the textarea content is kept exactly

  @test:scripts/tests/ui/minify-site.test.ts::verbatim_regions_are_copied_byte_for_byte::an_unclosed_verbatim_tag_is_treated_as_a_plain_tag_rather_than_swallowing_the_page
  Scenario: An unclosed verbatim tag does not swallow the page
    Given a div holding an unclosed pre followed by "<span>x</span>"
    When it is minified
    Then the output still contains "<span>x</span>"

  @test:scripts/tests/ui/minify-site.test.ts::whitespace:_dropped_where_it_cannot_render,_one_space_where_it_can::between_block_elements_it_goes
  Scenario: Whitespace between block elements is dropped
    Given a ul with two li items on indented lines
    When it is minified
    Then it reads "<ul><li>a</li><li>b</li></ul>"

  @test:scripts/tests/ui/minify-site.test.ts::whitespace:_dropped_where_it_cannot_render,_one_space_where_it_can::between_two_inline_elements_it_becomes_exactly_one_space
  Scenario: Whitespace between two inline elements becomes one space
    Given two anchors separated by a newline and indent inside a paragraph
    When it is minified
    Then it reads "<p><a>one</a> <a>two</a></p>"

  @test:scripts/tests/ui/minify-site.test.ts::whitespace:_dropped_where_it_cannot_render,_one_space_where_it_can::…which_is_the_word_boundary_a_naive_`>\s+<`_would_delete
  Scenario: The word boundary between inline elements is not deleted
    Given two spans separated by a newline
    When it is minified
    Then it does not read "<span>one</span><span>two</span>"

  @test:scripts/tests/ui/minify-site.test.ts::whitespace:_dropped_where_it_cannot_render,_one_space_where_it_can::whitespace_touching_TEXT_is_part_of_the_text_and_is_left_alone
  Scenario: Whitespace touching text is left alone
    Given the paragraph "Cats <em>and</em>" followed by a newline and indented "dogs"
    When it is minified
    Then the page is unchanged

  @test:scripts/tests/ui/minify-site.test.ts::whitespace:_dropped_where_it_cannot_render,_one_space_where_it_can::a_single_space_between_inline_elements_is_already_minimal_and_is_not_rewritten
  Scenario: A single space between inline elements is not rewritten
    Given "<p><a>a</a> <a>b</a></p>"
    When it is minified
    Then the squeezed count is 0
    And the page is unchanged

  @test:scripts/tests/ui/minify-site.test.ts::whitespace:_dropped_where_it_cannot_render,_one_space_where_it_can::inside_an_<svg>_it_goes,_because_it_is_not_text_there
  Scenario: Whitespace inside an svg is dropped
    Given an svg with a path and an empty g on indented lines
    When it is minified
    Then it reads "<svg><path d=\"M0 0\"/><g></g></svg>"

  @test:scripts/tests/ui/minify-site.test.ts::whitespace:_dropped_where_it_cannot_render,_one_space_where_it_can::…but_not_around_an_svg_<text>_element
  Scenario: Whitespace between svg text elements keeps one space
    Given an svg holding two text elements separated by a newline
    When it is minified
    Then it reads "<svg><text>a</text> <text>b</text></svg>"

  @test:scripts/tests/ui/minify-site.test.ts::whitespace:_dropped_where_it_cannot_render,_one_space_where_it_can::whitespace_after_a_closing_</svg>_is_between_two_INLINE_boxes
  Scenario: Whitespace after a closing svg is between two inline boxes
    Given a paragraph holding two svgs separated by a newline
    When it is minified
    Then it reads "<p><svg></svg> <svg></svg></p>"

  @test:scripts/tests/ui/minify-site.test.ts::whitespace:_dropped_where_it_cannot_render,_one_space_where_it_can::an_unknown_element_keeps_its_space_—_the_safe_default
  Scenario: An unknown element keeps its space
    Given two "fa-chip" elements separated by a newline inside a paragraph
    When it is minified
    Then they are separated by one space

  @test:scripts/tests/ui/minify-site.test.ts::tag_scanning_survives_the_attributes_this_corpus_actually_ships::a_`>`_inside_a_quoted_attribute_does_not_end_the_tag
  Scenario: A > inside a quoted attribute does not end the tag
    Given a meta tag whose content attribute is "a > b", followed by a div
    When it is tokenized
    Then the whole meta tag is one tag token
    And minifying gives "<head><meta name=\"x\" content=\"a > b\"><div>y</div></head>"

  @test:scripts/tests/ui/minify-site.test.ts::tag_scanning_survives_the_attributes_this_corpus_actually_ships::an_HTML-escaped_JSON_blob_in_a_meta_content_attribute_is_preserved
  Scenario: An HTML-escaped JSON blob in a meta content attribute is preserved
    Given a "fa-tiles" meta tag whose content is HTML-escaped JSON
    When the head holding it is minified
    Then the meta tag is kept exactly

  @test:scripts/tests/ui/minify-site.test.ts::tag_scanning_survives_the_attributes_this_corpus_actually_ships::the_doctype_counts_as_a_block_boundary
  Scenario: The doctype counts as a block boundary
    Given a doctype, html and head on separate lines
    When it is minified
    Then it reads "<!doctype html><html><head></head></html>"

  @test:scripts/tests/ui/minify-site.test.ts::comments:_three_classes_stay,_and_the_reason_is_recorded::maintainer_prose_goes
  Scenario: A maintainer prose comment is dropped
    Given a head holding a prose comment and a meta
    When it is minified
    Then it reads "<head><meta></head>"
    And the comments count is 1

  @test:scripts/tests/ui/minify-site.test.ts::comments:_three_classes_stay,_and_the_reason_is_recorded::a_licence_notice_stays_—_MIT_requires_it_to_travel_with_the_copy
  Scenario: A licence notice comment stays
    Given the comment "Feather. MIT License: …/LICENSE"
    When it is classified
    Then it is kept as "licence"
    And minifying a head holding it keeps it

  @test:scripts/tests/ui/minify-site.test.ts::comments:_three_classes_stay,_and_the_reason_is_recorded::a_conditional_comment_stays_—_it_is_markup,_not_prose
  Scenario: A conditional comment stays
    Given the conditional comment "[if lt IE 9]" wrapping a script
    When it is classified
    Then it is kept as "conditional"
    And minifying a head holding it keeps it

  @test:scripts/tests/ui/minify-site.test.ts::comments:_three_classes_stay,_and_the_reason_is_recorded::the_downlevel-revealed_pair_both_stay
  Scenario: The downlevel-revealed conditional comment pair both stay
    Given the comments "<!--[if !IE]>-->" and "<!--<![endif]-->"
    When they are classified
    Then both are kept as "conditional"

  @test:scripts/tests/ui/minify-site.test.ts::comments:_three_classes_stay,_and_the_reason_is_recorded::a_region_marker_stays_—_it_exists_to_be_found_by_a_tool
  Scenario: A region marker comment stays
    Given the comments "fa-first-paint:begin", "fa-first-paint:end", "kg:subgraph:begin" and "detail"
    When each is classified and minified inside a div
    Then each is kept as "marker"
    And each survives minification

  @test:scripts/tests/ui/minify-site.test.ts::comments:_three_classes_stay,_and_the_reason_is_recorded::a_GENERATED-by_banner_is_prose_and_goes
  Scenario: A GENERATED-by banner comment is dropped
    Given a "GENERATED by cat-harness/scripts/gen-navbar-include.ts" banner comment
    When it is classified
    Then it is not kept
    And minifying a div holding it removes "GENERATED by"

  @test:scripts/tests/ui/minify-site.test.ts::comments:_three_classes_stay,_and_the_reason_is_recorded::consecutive_dropped_comments_leave_ONE_whitespace_decision,_not_three
  Scenario: Consecutive dropped comments leave one whitespace decision
    Given a head holding two prose comments and a meta on indented lines
    When it is minified
    Then it reads "<head><meta></head>"

  @test:scripts/tests/ui/minify-site.test.ts::comments:_three_classes_stay,_and_the_reason_is_recorded::an_unterminated_comment_is_consumed_rather_than_reopening_the_document
  Scenario: An unterminated comment is consumed
    Given "<div><!-- never closed"
    When it is minified
    Then it reads "<div>"

  @test:scripts/tests/ui/minify-site.test.ts::idempotent_—_a_second_run_writes_nothing::fixture_%d
  Scenario: Minifying a second time changes nothing
    Given each of three fixtures: a full page with comments, nav, pre, style and svg; a div with kg:subgraph markers around text; and "<p><a>a</a> <a>b</a></p>"
    When it is minified once and then again
    Then the second result equals the first
    And the second pass counts 0 comments, 0 dropped and 0 squeezed

  @test:scripts/tests/ui/minify-site.test.ts::the_runner's_three_states::an_unreadable_site_directory_is_exit_2,_never_a_clean_pass
  Scenario: An unreadable site directory exits 2
    Given a site directory that does not exist
    When the minify runner runs over it
    Then the exit code is 2
    And the text says "could not read"
    And bytes before is 0

  @test:scripts/tests/ui/minify-site.test.ts::the_runner's_three_states::--check_reports_and_writes_nothing
  Scenario: --check reports savings and writes nothing
    Given a site with "a.html" and "deep/b.html", each holding a prose comment
    When the minify runner runs with check
    Then the exit code is 0
    And 2 files are seen and 2 would change
    And bytes after is less than bytes before
    And the text says "would save"
    And "a.html" is unchanged on disk

  @test:scripts/tests/ui/minify-site.test.ts::the_runner's_three_states::a_write_pass_changes_the_files_and_a_re-run_changes_nothing
  Scenario: A write pass changes the files and a re-run changes nothing
    Given a site with "a.html" holding a prose comment and "keep.txt" holding a comment
    When the minify runner runs
    Then 1 file is seen and 1 changed
    And "a.html" reads "<head><meta></head>"
    And a second run changes no file and leaves bytes before equal to bytes after

  @test:scripts/tests/ui/minify-site.test.ts::shared_scripts_and_stylesheets::comments_and_whitespace_go,_and_the_script_still_runs_the_same
  Scenario: A script loses its comments and whitespace and still runs the same
    Given a commented IIFE that opens with "use strict" and defines window.faX
    When it is minified
    Then it is shorter, its comment is gone, and a bare call of window.faX still sees this as undefined

  @test:scripts/tests/ui/minify-site.test.ts::shared_scripts_and_stylesheets::a_directive_opening_the_whole-script_IIFE_comes_back_at_the_top
  Scenario: A directive opening the whole-script IIFE comes back at the top
    Given the chrome's shape, one IIFE whose body opens with "use strict"
    Then its strictness is "whole" and the minified copy starts with the directive and the IIFE

  @test:scripts/tests/ui/minify-site.test.ts::shared_scripts_and_stylesheets::a_directive_anywhere_else_leaves_the_file_as_it_was,_never_silently_sloppy
  Scenario: A directive anywhere else leaves the file as it was
    Given a script whose only "use strict" is inside a nested function
    Then its strictness is "other" and the script is skipped rather than minified

  @test:scripts/tests/ui/minify-site.test.ts::shared_scripts_and_stylesheets::top-level_names_are_kept:_a_classic_script's_globals_are_other_scripts'_API
  Scenario: Top-level names are kept
    Given a script declaring the function faShared and the var faCount
    When it is minified
    Then both names survive unchanged

  @test:scripts/tests/ui/minify-site.test.ts::shared_scripts_and_stylesheets::a_licence_comment_travels_with_the_copy
  Scenario: A licence comment travels with the copy
    Given a script with an @license comment and a line comment
    When it is minified
    Then the licence is kept and the line comment is gone

  @test:scripts/tests/ui/minify-site.test.ts::shared_scripts_and_stylesheets::a_script_that_does_not_parse_is_reported_and_left_alone
  Scenario: A script that does not parse is left alone
    Given Jekyll front matter followed by a statement
    Then minifying it reports a skip

  @test:scripts/tests/ui/minify-site.test.ts::shared_scripts_and_stylesheets::minifying_twice_is_minifying_once
  Scenario: Minifying a script twice is minifying it once
    Given the minified chrome-shaped IIFE
    Then minifying it again changes nothing

  @test:scripts/tests/ui/minify-site.test.ts::shared_scripts_and_stylesheets::CSS_is_minified,_url()_and_@import_untouched_in_meaning
  Scenario: CSS is minified with url() and @import kept
    Given a stylesheet with a comment, an @import, a url() background and a print media block
    When it is minified
    Then it is shorter, the comment is gone, the url, import and print block remain, and a second pass changes nothing

  @test:scripts/tests/ui/minify-site.test.ts::shared_scripts_and_stylesheets::vendored,_already-minified_and_non-asset_files_are_not_ours_to_rewrite
  Scenario: Vendored, already-minified and non-asset files are not rewritten
    Then docs-ui.js and docs-ui.css are ours, and vendor/ scripts, a .min.css and a .json are not

  @test:scripts/tests/ui/minify-site.test.ts::shared_scripts_and_stylesheets::the_runner_writes_once,_reports_bytes,_and_a_re-run_changes_nothing
  Scenario: The asset runner writes once and a re-run changes nothing
    Given a built tree with a script, a stylesheet and a vendored script
    When it is checked, then written, then written again
    Then the check writes nothing, the write shrinks both of ours and leaves the vendored one, and the re-run changes nothing

  @test:scripts/tests/ui/minify-site.test.ts::shared_scripts_and_stylesheets::a_print_handler_survives:_minifying_changes_what_a_script_is,_not_what_it_does_on_print
  Scenario: A beforeprint handler survives minification
    Given a strict IIFE that opens a disclosure on beforeprint
    When it is minified and run, and beforeprint fires
    Then the disclosure is open

  @test:scripts/tests/ui/minify-site.test.ts::shared_scripts_and_stylesheets::an_unreadable_site_directory_is_exit_2
  Scenario: The asset runner on an unreadable directory exits 2
    When it is pointed at a directory that does not exist
    Then it exits 2
