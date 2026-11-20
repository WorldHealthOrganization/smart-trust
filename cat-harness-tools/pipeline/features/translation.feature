# pipeline/pot-extract.ts extracts translatable strings from Markdown and block manifests into POT;
# pipeline/po-inject.ts parses PO catalogues and injects them back, keeping document structure.
# Each Scenario names the test that executes it.
Feature: Translation extraction and injection

  @test:pipeline/translation.test.ts::cleanMarkdownText::strips_bold_markers
  Scenario: Bold markers are stripped
    Given the text "**bold text**"
    When it is cleaned for extraction
    Then it reads "bold text"

  @test:pipeline/translation.test.ts::cleanMarkdownText::strips_italic_markers_(asterisk)
  Scenario: Asterisk italic markers are stripped
    Given the text "*italic text*"
    When it is cleaned for extraction
    Then it reads "italic text"

  @test:pipeline/translation.test.ts::cleanMarkdownText::strips_italic_markers_(underscore)
  Scenario: Underscore italic markers are stripped
    Given the text "_italic text_"
    When it is cleaned for extraction
    Then it reads "italic text"

  @test:pipeline/translation.test.ts::cleanMarkdownText::a_LaTeX_subscript_survives,_alone_or_beside_another
  Scenario: A LaTeX subscript survives, alone or beside another
    Given the texts "$a_1$", "$a_1$ and $b_2$" and "x_1 y_2"
    When each is cleaned for extraction
    Then each is returned unchanged

  @test:pipeline/translation.test.ts::cleanMarkdownText::a_subscripted_LaTeX_command_is_not_turned_into_a_different_expression
  Scenario: A subscripted LaTeX command keeps its underscores
    Given the texts "weighted by $w_\lambda = dq$" and "the subspace $G^+ = \sum_{\lambda_i}$"
    When each is cleaned for extraction
    Then each is returned unchanged

  @test:pipeline/translation.test.ts::cleanMarkdownText::a_snake_case_identifier_is_not_a_word_with_emphasis_inside_it
  Scenario: A snake_case identifier is not read as a word with emphasis inside it
    Given the texts "snake_case_name stays" and "perform-task for Process_CodeChangeReview/Task_ClaimBean"
    When each is cleaned for extraction
    Then each is returned unchanged

  @test:pipeline/translation.test.ts::cleanMarkdownText::real_emphasis_is_still_stripped,_including_two_spans_in_one_string
  Scenario: Real underscore emphasis is still stripped, including two spans in one string
    When underscore emphasis is cleaned for extraction
    Then "say _this_ and _that_" reads "say this and that"
    And "a _multi word_ span" reads "a multi word span"
    And "(_parenthesised_)" reads "(parenthesised)"

  @test:pipeline/translation.test.ts::cleanMarkdownText::replaces_links_with_indexed_<aN>_placeholders_(G3)
  Scenario: A link becomes an indexed <aN> placeholder
    Given the text "[click here](https://example.com)"
    When it is cleaned for extraction
    Then it reads "<a0>click here</a0>"

  @test:pipeline/translation.test.ts::cleanMarkdownText::replaces_images_with_alt_text
  Scenario: An image is replaced by its alt text
    Given the text "![alt text](image.png)"
    When it is cleaned for extraction
    Then it reads "alt text"

  @test:pipeline/translation.test.ts::cleanMarkdownText::replaces_inline_code_with_indexed_{codeN}_placeholders_(G3)
  Scenario: Inline code becomes an indexed {codeN} placeholder
    Given the text "use `foo()` function"
    When it is cleaned for extraction
    Then it reads "use {code0} function"

  @test:pipeline/translation.test.ts::cleanMarkdownText::removes_HTML_comments
  Scenario: HTML comments are removed
    Given the text "text <!-- comment --> more"
    When it is cleaned for extraction
    Then it reads "text  more"

  @test:pipeline/translation.test.ts::cleanMarkdownText::removes_HTML_tags
  Scenario: HTML tags are removed
    Given the text "<br/>text<div>more</div>"
    When it is cleaned for extraction
    Then it reads "textmore"

  @test:pipeline/translation.test.ts::cleanMarkdownText::removes_angle-bracket_autolinks
  Scenario: Angle-bracket autolinks are removed
    Given the text "see <https://example.com> for info"
    When it is cleaned for extraction
    Then it reads "see  for info"

  @test:pipeline/translation.test.ts::cleanMarkdownText::transforms_Liquid_output_to_gettext_brace_vars
  Scenario: Liquid output becomes a gettext brace variable
    Given the text "There are {{ count }} items"
    When it is cleaned for extraction
    Then it reads "There are {lqd_count} items"

  @test:pipeline/translation.test.ts::cleanMarkdownText::removes_Liquid_control_tags
  Scenario: Liquid control tags are removed
    Given the text "{% if true %}text{% endif %}"
    When it is cleaned for extraction
    Then it reads "text"

  @test:pipeline/translation.test.ts::cleanMarkdownText::preserves_underscores_in_Liquid_variables
  Scenario: Underscores inside a Liquid variable are preserved
    Given the text "{{ cell_var }}"
    When it is cleaned for extraction
    Then it reads "{lqd_cell_var}"

  @test:pipeline/translation.test.ts::cleanMarkdownText_—_emphasis_around_a_code_span_(bean_`3mo4`_+_G3)::bold_wrapping_a_code_span_leaves_no_asterisks
  Scenario: Bold wrapping a code span leaves no asterisks
    Given the text "**`clarity-defn-single`** — fail if x"
    When it is cleaned for extraction
    Then it reads "{code0} — fail if x"

  @test:pipeline/translation.test.ts::cleanMarkdownText_—_emphasis_around_a_code_span_(bean_`3mo4`_+_G3)::italic_wrapping_a_code_span_leaves_no_asterisks
  Scenario: Italic wrapping a code span leaves no asterisks
    Given the text "*`italic-code`* trailing"
    When it is cleaned for extraction
    Then it reads "{code0} trailing"

  @test:pipeline/translation.test.ts::cleanMarkdownText_—_emphasis_around_a_code_span_(bean_`3mo4`_+_G3)::bold_around_ordinary_text_is_unaffected
  Scenario: Bold around ordinary text is stripped as before
    Given the text "**bold** — fail if x"
    When it is cleaned for extraction
    Then it reads "bold — fail if x"

  @test:pipeline/translation.test.ts::cleanMarkdownText_—_emphasis_around_a_code_span_(bean_`3mo4`_+_G3)::a_bare_code_span_is_unaffected
  Scenario: A bare code span becomes a code placeholder
    Given the text "`code` — fail if x"
    When it is cleaned for extraction
    Then it reads "{code0} — fail if x"

  @test:pipeline/translation.test.ts::cleanMarkdownText_—_emphasis_around_a_code_span_(bean_`3mo4`_+_G3)::the_construct_TWICE_in_one_string_preserves_both_code_placeholders
  Scenario: Bold-wrapped code spans twice in one string keep both placeholders
    Given the text "**`a`** and **`b`** both"
    When it is cleaned for extraction
    Then it reads "{code0} and {code1} both"

  @test:pipeline/translation.test.ts::cleanMarkdownText_—_emphasis_around_a_code_span_(bean_`3mo4`_+_G3)::TWO_bold_runs,_the_first_wrapping_a_code_span,_left_the_markers_asymmetric
  Scenario: Two bold runs, the first wrapping a code span, are both stripped
    Given the text "**`skill_list`** — every servable skill **with its one-line summary**,"
    When it is cleaned for extraction
    Then it reads "{code0} — every servable skill with its one-line summary,"

  @test:pipeline/translation.test.ts::cleanMarkdownText_—_emphasis_around_a_code_span_(bean_`3mo4`_+_G3)::a_glob_INSIDE_a_code_span_is_never_reached_by_the_emphasis_regexes
  Scenario: A glob inside a code span is never reached by the emphasis rules
    When code spans holding globs are cleaned for extraction
    Then "see `content/**/*.lean` glob" reads "see {code0} glob"
    And "`a/**/b` and `c/**/d`" reads "{code0} and {code1}"

  @test:pipeline/translation.test.ts::cleanMarkdownText_—_emphasis_around_a_code_span_(bean_`3mo4`_+_G3)::over_the_REAL_corpus:_no_msgid_carries_a_run_of_four_asterisks
  Scenario: Over the real corpus no msgid carries a run of four asterisks
    Given every .md page under the site root, skipping directories that start with "_"
    When each page's msgids are extracted
    Then no msgid contains four asterisks in a row
    And more than 300 files and more than 20000 msgids were seen

  @test:pipeline/translation.test.ts::isTranslatable_—_a_single_ideograph_is_a_word_(bean_`6b8u`)::a_lone_Han_character_is_translatable
  Scenario: A lone Han character is translatable
    When "是" or "否" is checked for translatability
    Then each is translatable

  @test:pipeline/translation.test.ts::isTranslatable_—_a_single_ideograph_is_a_word_(bean_`6b8u`)::a_lone_Latin_letter_is_still_NOT_translatable
  Scenario: A lone Latin letter is not translatable
    When "y", "n" or "a" is checked for translatability
    Then none is translatable

  @test:pipeline/translation.test.ts::isTranslatable_—_a_single_ideograph_is_a_word_(bean_`6b8u`)::two_Latin_letters_remain_the_threshold
  Scenario: Two letters are the threshold for alphabetic scripts
    When "no" or "нет" is checked for translatability
    Then each is translatable

  @test:pipeline/translation.test.ts::isTranslatable_—_a_single_ideograph_is_a_word_(bean_`6b8u`)::Hiragana,_Katakana_and_Hangul_count_too,_not_only_Han
  Scenario: A lone Hiragana, Katakana or Hangul character is translatable
    When "ひ", "ア" or "한" is checked for translatability
    Then each is translatable

  @test:pipeline/translation.test.ts::isTranslatable_—_a_single_ideograph_is_a_word_(bean_`6b8u`)::still_nothing_translatable_in_a_letterless_string
  Scenario: A letterless string is not translatable
    When ", ", the empty string or "42 — 7" is checked for translatability
    Then none is translatable

  @test:pipeline/translation.test.ts::isTranslatable_—_a_single_ideograph_is_a_word_(bean_`6b8u`)::it_admits_EXACTLY_the_cells_measured,_and_no_more
  Scenario: Over the real corpus the one-character rule admits exactly the measured cells
    Given every table cell of every .md page under the site root
    When each cleaned cell with fewer than two letters is checked for translatability
    Then the only cells admitted are "否" and "是"
    And they are admitted 6 times in all

  @test:pipeline/translation.test.ts::extractMarkdown::extracts_headings
  Scenario: Headings are extracted
    Given a page with the heading "# Main Title" and a paragraph
    When it is extracted
    Then there are at least two entries
    And the first msgid is "Main Title"

  @test:pipeline/translation.test.ts::extractMarkdown::extracts_paragraphs
  Scenario: Paragraphs are extracted
    Given a page with the paragraphs "First paragraph text." and "Second paragraph text."
    When it is extracted
    Then there are exactly two entries, those two paragraphs in order

  @test:pipeline/translation.test.ts::extractMarkdown::accumulates_continuation_lines_into_one_paragraph
  Scenario: Continuation lines join into one paragraph
    Given a paragraph wrapped over three lines, then another paragraph
    When it is extracted
    Then the first msgid is "This is a long paragraph that spans multiple lines."

  @test:pipeline/translation.test.ts::extractMarkdown::skips_YAML_front_matter
  Scenario: YAML front matter is skipped
    Given a page whose front matter sets title and layout, then "Actual content here."
    When it is extracted
    Then the only msgid is "Actual content here."

  @test:pipeline/translation.test.ts::extractMarkdown::skips_fenced_code_blocks
  Scenario: Fenced code blocks are skipped
    Given a typescript code fence between two paragraphs
    When it is extracted
    Then "Before code." and "After code." are msgids
    And "const x = 1;" is not

  @test:pipeline/translation.test.ts::extractMarkdown::skips_HTML_style_blocks
  Scenario: HTML style blocks are skipped
    Given a <style> block between two paragraphs
    When it is extracted
    Then "Before." and "After." are msgids
    And ".foo { color: red; }" is not

  @test:pipeline/translation.test.ts::extractMarkdown::extracts_list_items
  Scenario: List items are extracted
    Given a list of three items
    When it is extracted
    Then there are three entries
    And the first msgid is "First item"

  @test:pipeline/translation.test.ts::extractMarkdown::extracts_blockquote_text
  Scenario: Blockquote text is extracted
    Given the blockquote "> This is a quote."
    When it is extracted
    Then the first msgid is "This is a quote."

  @test:pipeline/translation.test.ts::extractMarkdown::extracts_table_cells
  Scenario: Table cells are extracted
    Given a table with a header row, a separator row and one body row
    When it is extracted
    Then "Header One" and "Cell one" are among the msgids

  @test:pipeline/translation.test.ts::extractMarkdown::skips_table_separator_rows
  Scenario: Table separator rows are skipped
    Given a table with a |---|---| separator row
    When it is extracted
    Then "---" is not a msgid

  @test:pipeline/translation.test.ts::extractMarkdown::skips_kramdown_attributes
  Scenario: Kramdown attribute lists are skipped
    Given a heading followed by "{: .no_toc }"
    When it is extracted
    Then ".no_toc" is not a msgid

  @test:pipeline/translation.test.ts::extractMarkdown::the_list_a_`{:toc}`_replaces_is_not_offered_to_translators
  Scenario: The list a {:toc} replaces is not offered to translators
    Given "Intro line." followed by the list "1. TOC" and "{:toc}"
    When it is extracted
    Then the msgids are exactly "Intro line."

  @test:pipeline/translation.test.ts::extractMarkdown::`{:_.no_toc_}`_keeps_the_heading_it_attaches_to
  Scenario: {: .no_toc } keeps the heading it attaches to
    Given "## Subgraph viewers" followed by "{: .no_toc }" and "Body."
    When it is extracted
    Then the msgids are exactly "Subgraph viewers" and "Body."

  @test:pipeline/translation.test.ts::extractMarkdown::an_ordinary_list_is_untouched
  Scenario: An ordinary list is extracted untouched
    Given a two-item list followed by a paragraph
    When it is extracted
    Then the msgids are exactly "first item", "second item" and "A paragraph."

  @test:pipeline/translation.test.ts::extractMarkdown::a_`{:toc}`_further_down_the_page_does_not_reach_back_to_an_earlier_list
  Scenario: A {:toc} further down the page does not reach back to an earlier list
    Given a two-item list, a paragraph, then "1. TOC" followed by "{:toc}"
    When it is extracted
    Then the msgids are exactly "keep me", "keep me too" and "A paragraph."

  @test:pipeline/translation.test.ts::extractMarkdown::a_multi-item_placeholder_goes_entirely,_because_the_directive_takes_the_LIST
  Scenario: A multi-item {:toc} placeholder list is dropped entirely
    Given the list "- TOC" and "- Contents" followed by "{:toc}"
    When it is extracted
    Then there are no entries

  @test:pipeline/translation.test.ts::extractMarkdown::an_attribute_list_that_attaches_to_prose_keeps_the_prose
  Scenario: An attribute list attached to prose keeps the prose
    Given "Some real prose." followed by "{: .note }"
    When it is extracted
    Then the msgids are exactly "Some real prose."

  @test:pipeline/translation.test.ts::extractMarkdown::skips_horizontal_rules
  Scenario: Horizontal rules do not disturb the paragraphs around them
    # Gap: the test does not assert that "---" itself is absent from the msgids
    Given a "---" rule between two paragraphs
    When it is extracted
    Then "Before." and "After." are msgids

  @test:pipeline/translation.test.ts::extractMarkdown::skips_strings_with_fewer_than_two_LETTERS,_not_fewer_than_three_characters
  Scenario: Strings with fewer than two letters are skipped, not strings under three characters
    Given a page with "OK" and "Real content here." as paragraphs
    When it is extracted
    Then the msgids are exactly "OK" and "Real content here."

  @test:pipeline/translation.test.ts::extractMarkdown::a_string_with_no_letters_is_never_translatable
  Scenario: A string with no letters is never extracted
    Given a table row with cells "...", "—", "1.2.3" and "Real words here"
    When it is extracted
    Then the msgids are exactly "Real words here"

  @test:pipeline/translation.test.ts::extractFromManifest::extracts_title_from_manifest
  Scenario: A manifest's title is extracted
    Given a definition manifest titled "My Definition"
    When its strings are extracted
    Then there is one entry with msgid "My Definition"
    And its comment mentions "definition"

  @test:pipeline/translation.test.ts::extractFromManifest::returns_empty_for_manifest_without_title
  Scenario: A manifest without a title yields no entries
    Given a manifest with only a label
    When its strings are extracted
    Then there are no entries

  @test:pipeline/translation.test.ts::formatPot::formats_valid_POT_with_header
  Scenario: A POT file is formatted with its header
    Given one entry "Hello world" from test.md line 1 and project name "test-folio"
    When the POT is formatted
    Then it contains msgid "Hello world" and an empty msgstr
    And the header "Project-Id-Version: test-folio"
    And the reference "#: test.md:1"

  @test:pipeline/translation.test.ts::formatPot::deduplicates_entries_with_same_msgid
  Scenario: Entries with the same msgid are written once
    Given "Same text" from a.md line 1 and from b.md line 5
    When the POT is formatted
    Then msgid "Same text" appears once
    And both "#: a.md:1" and "#: b.md:5" references are present

  @test:pipeline/translation.test.ts::formatPot::adds_python-brace-format_flag_for_Liquid_vars
  Scenario: A msgid with a Liquid variable is flagged python-brace-format
    Given the entry "Count: {lqd_count}"
    When the POT is formatted
    Then it contains "#, python-brace-format"

  @test:pipeline/translation.test.ts::parsePo::parses_simple_PO_file
  Scenario: A simple PO file is parsed into translations
    Given a PO file with a header and two translated entries
    When it is parsed
    Then "Hello world" maps to "Bonjour le monde"
    And "Goodbye" maps to "Au revoir"

  @test:pipeline/translation.test.ts::parsePo::skips_fuzzy_entries
  Scenario: Fuzzy entries are skipped
    Given a PO file where "Uncertain" is marked fuzzy
    When it is parsed
    Then "Clear" maps to "Clair"
    And "Uncertain" has no translation

  @test:pipeline/translation.test.ts::parsePo::skips_entries_with_empty_msgstr
  Scenario: Entries with an empty msgstr are skipped
    Given a PO file where "Untranslated" has an empty msgstr
    When it is parsed
    Then "Translated" maps to "Traduit"
    And "Untranslated" has no translation

  @test:pipeline/translation.test.ts::injectMarkdown::injects_heading_translations
  Scenario: A heading translation is injected
    Given "# Main Title" and a translation to "Titre principal"
    When the translations are injected
    Then the output contains "# Titre principal"
    And the result is marked changed

  @test:pipeline/translation.test.ts::injectMarkdown::injects_paragraph_translations
  Scenario: Paragraph translations are injected
    Given two paragraphs, each with a French translation
    When the translations are injected
    Then the output contains "Premier paragraphe." and "Deuxième paragraphe."

  @test:pipeline/translation.test.ts::injectMarkdown::preserves_untranslated_content
  Scenario: Untranslated content is kept as it is
    Given "Known" with a translation and "Unknown text here." without one
    When the translations are injected
    Then the output contains "Connu" and "Unknown text here."

  @test:pipeline/translation.test.ts::injectMarkdown::preserves_code_blocks
  Scenario: Code blocks are kept through injection
    Given a code fence between two translated paragraphs
    When the translations are injected
    Then the output contains both translations and "const x = 1;"

  @test:pipeline/translation.test.ts::injectMarkdown::restores_Liquid_variables
  Scenario: Liquid variables are restored on injection
    Given "There are {{ count }} items" translated as "Il y a {lqd_count} éléments"
    When the translations are injected
    Then the output contains "Il y a {{ count }} éléments"

  @test:pipeline/translation.test.ts::injectMarkdown::reports_statistics
  Scenario: Injection reports span statistics
    Given "Hello" with a translation and "World is big." without one
    When the translations are injected
    Then one span is counted translated and one untranslated

  @test:pipeline/translation.test.ts::injectMarkdown_preserves_document_structure::the_author's_blank_lines_survive_—_all_three_of_them
  Scenario: The author's blank lines survive injection
    Given a heading, a paragraph, a two-item list and a paragraph separated by 3 blank lines
    When only "Title" is translated to "Titre"
    Then the output still has 3 blank lines
    And the whole output equals the source with "# Titre" as its heading

  @test:pipeline/translation.test.ts::injectMarkdown_preserves_document_structure::a_wrapped_paragraph_STILL_collapses_to_one_line
  Scenario: A wrapped paragraph still collapses to one line
    Given a paragraph hard-wrapped over three lines
    When its joined text is translated
    Then the output is the single line "Une phrase repliée."
    And the result is marked changed

  @test:pipeline/translation.test.ts::injectMarkdown_preserves_document_structure::collapsing_a_multi-line_continuation_leaves_no_blank_line_inside_the_list
  Scenario: Collapsing a multi-line list continuation leaves no blank line inside the list
    Given a list item with two continuation lines followed by a second item
    When the joined item is translated to "article traduit"
    Then the output is exactly "- article traduit" then "- second item"
    And it holds no blank line

  @test:pipeline/translation.test.ts::injectMarkdown_preserves_document_structure::a_document_with_NO_translation_is_returned_unchanged,_byte_for_byte
  Scenario: A document with no translation is returned unchanged, byte for byte
    Given a document with headings, lists and a double blank line
    When it is injected with no translations
    Then the output equals the source
    And the result is not marked changed

  @test:pipeline/translation.test.ts::injectMarkdown_preserves_document_structure::over_the_REAL_corpus:_injection_never_changes_the_blank-line_count
  Scenario: Over the real corpus injection never changes the blank-line count
    Given every published (page, locale) pair whose page and catalogue both exist
    When each catalogue is injected into its page
    Then the output has as many blank lines as the source
    And at least 55 pairs were checked, every one of them changed by injection
    And at least one output collapsed lines

  @test:pipeline/translation.test.ts::injectMarkdown_translates_a_wrapped_list_item_and_blockquote_whole::the_catalogue's_msgids_are_the_joined_units_the_extractor_writes
  Scenario: The catalogue's msgids are the joined units the extractor writes
    Given a page with wrapped list items, a nested wrapped item, an item continuing with markup and a wrapped blockquote
    When it is extracted
    Then each wrapped list item and the blockquote is one msgid, joined across its lines, between the intro and outro paragraphs
    And the markup continuation reads "... bold words and a <a0>link</a0>."

  @test:pipeline/translation.test.ts::injectMarkdown_translates_a_wrapped_list_item_and_blockquote_whole::every_wrapped_unit_is_translated_whole,_under_its_own_marker_and_indentation
  Scenario: Every wrapped unit is translated whole, under its own marker and indentation
    Given that page and an Arabic catalogue for its four wrapped units
    When the translations are injected
    Then each unit is one line of Arabic under its original marker and indentation, with the link restored
    And the paragraphs and blank lines are unchanged
    And the stats are 6 spans in all, 4 translated and 2 untranslated

  @test:pipeline/translation.test.ts::injectMarkdown_translates_a_wrapped_list_item_and_blockquote_whole::a_depth_change_inside_a_quote_is_a_separate_unit
  Scenario: A depth change inside a quote is a separate unit
    Given a two-line ">" quote followed by a two-line ">>" quote, each translated
    When the translations are injected
    Then the output is "> اقتباس خارجي." then ">> اقتباس داخلي."

  @test:pipeline/translation.test.ts::round-trip::extract_→_format_→_parse_→_inject_preserves_structure
  Scenario: Extract, format and inject keep the page's structure
    # Gap: the POT is never parsed back; the translations are built directly from the extracted entries
    Given a page with front matter, headings, a list, a code fence, a blockquote, a table and paragraphs
    When its entries are extracted and formatted as a POT
    And every msgid is translated as "[FR] <msgid>" and injected
    Then there was at least one entry and the POT contains a msgid
    And the result is marked changed
    And the output keeps the code fence, "const x = 42;" and "---"
    And it contains "[FR] Introduction", "[FR] First item in the list" and "[FR] A blockquote for emphasis."

  @test:pipeline/translation.test.ts::bean_h11k_—_G1:_math_protection_through_extraction_and_injection::inline_math_with_asterisks_$a*b*c$_is_preserved_verbatim
  Scenario: Inline math with asterisks is preserved verbatim
    When text with inline math is cleaned for extraction
    Then "Let $a*b*c$ be the product." is unchanged
    And in "We have $f^* \circ g^*$ and *italic* text." only the italic markers outside the math are stripped

  @test:pipeline/translation.test.ts::bean_h11k_—_G1:_math_protection_through_extraction_and_injection::subscripts_after_closing_braces_in_math_survive
  Scenario: Subscripts after closing braces in math survive
    Given a sentence with "$\pi_K = \pi_1(S^3 \setminus K)$" and "$\langle g_1\rangle_{i_0}$"
    When it is cleaned for extraction
    Then it is returned unchanged

  @test:pipeline/translation.test.ts::bean_h11k_—_G1:_math_protection_through_extraction_and_injection::multi-line_display_math_$$...$$_is_skipped_as_a_block,_never_split_on_'-_x_+_y'
  Scenario: Multi-line display math is skipped as a block, never split on a leading '- '
    Given a paragraph, a $$ display-math block holding the line "  - x + y &= 0", and a closing sentence
    When it is extracted
    Then the msgids are exactly "Consider the system:" and "where $x, y \in \mathbb{R}$."
    When both are translated and injected
    Then the output holds both translations and the math line "  - x + y &= 0" unchanged

  @test:pipeline/translation.test.ts::bean_h11k_—_G1:_math_protection_through_extraction_and_injection::pure-math_strings_are_excluded_by_isTranslatable
  Scenario: Pure-math strings are not translatable
    When strings are checked for translatability
    Then "$x^2 + y^2 = z^2$" and "$$\int_0^1 f(x)\,dx$$" are not translatable
    And "Let $x > 0$ be positive." is

  @test:pipeline/translation.test.ts::bean_h11k_—_G1:_math_protection_through_extraction_and_injection::table_cell_containing_$|\psi|^2$_is_not_split_at_the_pipe
  Scenario: A table cell holding $|\psi|^2$ is not split at the pipe
    Given a table whose cell reads "The norm $|\psi|^2$ vanishes at the boundary"
    When it is extracted
    Then that whole cell is one msgid
    When the row's cells are translated and injected
    Then the row reads "| Densité de probabilité | La norme $|\psi|^2$ s'annule sur le bord |"

  @test:pipeline/translation.test.ts::bean_h11k_—_G3:_inline-code_and_link_placeholders::extracts_{code0},_{code1}_and_<a0>...</a0>_and_restores_them_on_inject
  Scenario: Code and link placeholders are extracted and restored on injection
    Given a paragraph with two code spans and a link to "#sec:two"
    When it is extracted
    Then its one msgid is "Call {code0} and {code1} as described in <a0>Section 2</a0>."
    And its POT carries "#, python-brace-format"
    When a French translation reordering the text around the placeholders is injected
    Then the output restores both code spans and the link target

  @test:pipeline/translation.test.ts::bean_h11k_—_G3:_inline-code_and_link_placeholders::preserves_standalone_image_![alt](src)_wrapper_on_inject
  Scenario: A standalone image keeps its ![alt](src) wrapper on injection
    Given the image "![Architecture overview](assets/arch.svg)"
    When it is extracted
    Then its one msgid is "Architecture overview"
    When the alt text is translated and injected
    Then the output is "![Vue d'ensemble de l'architecture](assets/arch.svg)"

  @test:pipeline/translation.test.ts::bean_h11k_—_G4:_extractFromManifest_on_objects,_.ts_sources,_and_QA_pipeline::extracts_title,_caption,_narrative,_simulator_views,_and_section_titles_with_msgctxt
  Scenario: A .ts manifest yields its title, caption, narrative, view titles with msgctxt
    # Gap: the manifest has no sections, so section titles are not exercised
    Given a simulator .ts source with title, caption, narrative, a default view and two views
    When its strings are extracted
    Then the entries in order carry msgctxt "title", "caption", "narrative.text", "defaultView.title", "views[0].title" and "views[1].title"
    And their POT holds msgctxt "title", "caption" and "narrative.text"
    When a PO with msgctxt "title" and "caption" entries is parsed
    Then the title translation is found both under its context key and under the bare msgid

  @test:pipeline/translation.test.ts::bean_h11k_—_G4:_extractFromManifest_on_objects,_.ts_sources,_and_QA_pipeline::measureBlock_and_buildReport_include_companion_.ts_manifest_strings
  Scenario: Block QA counts the strings of a companion .ts manifest
    Given a theorem block's .md body, its .ts manifest with a title, and a French PO translating both
    When the block is measured with its manifest
    Then 2 of 2 strings are translated
    And the report's translation-coverage metrics are 2 translated of 2, 100 percent

  @test:pipeline/translation.test.ts::bean_h11k_—_G5:_translated_block_render_path_(Markdown_&_LaTeX)::renderBlockMarkdown_and_renderBlock_translate_block_title,_caption,_kind_heading,_and_.md_body
  Scenario: Markdown and LaTeX block rendering translate title, kind heading and body
    # Gap: the block has no caption, so caption translation is not checked
    Given a theorem block titled "Noether's Theorem" with a body holding a code span, and a French catalogue
    When it is rendered to Markdown in French
    Then the kind heading reads "Théorème" and the title "Théorème de Noether."
    And the body is translated with the code span restored
    When it is rendered to LaTeX in French
    Then it opens "\begin{theorem}[{Théorème de Noether}]"
    And the translated body carries the code span as \texttt

  @test:pipeline/translation.test.ts::bean_h11k_—_G5:_translated_block_render_path_(Markdown_&_LaTeX)::buildDocumentMarkdown_resolves_translations/<locale>/*.po_via_resolvePoSources_and_renders_translated_document
  Scenario: A French document is built from translations/fr/*.po
    Given a fixture folio with a document, one chapter, one section and a definition block
    And translations/fr/ch1.po translating their titles and the block body
    When the document Markdown is built for locale "fr"
    Then there are no issues
    And the document, chapter and section headings read "Directive clinique", "Chapitre premier" and "Première section"
    And the block shows kind "Définition" and title "Continuité des soins."
    And the body is translated with its code span, link and math restored
