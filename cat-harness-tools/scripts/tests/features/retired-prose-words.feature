# Retired prose words: "bean" stays a name in code and quotations, and is
# "work item" in prose. Each Scenario names the test that executes it.
Feature: Retired prose words

  @test:scripts/tests/retired-prose-words.test.ts::what_counts_as_prose::a_word_in_running_text_is_found,_in_any_case
  Scenario: A retired word in running text is found in any case
    Given the text "Claim the bean first." then "Beans are shared."
    When retired words are found
    Then "bean" on line 1 and "Beans" on line 2 are reported

  @test:scripts/tests/retired-prose-words.test.ts::what_counts_as_prose::a_name_is_not_prose:_code,_link_targets,_identifiers,_URLs
  Scenario: Names are not prose
    Given text using the word only in inline code, a link target, a hyphenated identifier, a path, a schema tag, a URL and a fenced code block
    When retired words are found
    Then nothing is reported

  @test:scripts/tests/retired-prose-words.test.ts::what_counts_as_prose::code_and_quotes_that_wrap_onto_the_next_line_are_still_code_and_quotes
  Scenario: Code and quotations that wrap a line are still code and quotations
    Given an inline code span and a quotation that each wrap onto the next line around the word
    When retired words are found
    Then nothing is reported

  @test:scripts/tests/retired-prose-words.test.ts::what_counts_as_prose::a_span_never_crosses_a_blank_line,_so_an_unclosed_backtick_does_not_hide_a_paragraph
  Scenario: An unclosed backtick does not hide the next paragraph
    Given a stray backtick followed by a blank line and "the bean is found"
    When retired words are found
    Then "bean" on line 3 is reported

  @test:scripts/tests/retired-prose-words.test.ts::what_counts_as_prose::headings_keep_their_anchors;_quotations_keep_their_words
  Scenario: Headings and quotations keep their words
    Given a heading naming a bean and an italic quotation naming a bean
    When retired words are found
    Then nothing is reported

  @test:scripts/tests/retired-prose-words.test.ts::what_counts_as_prose::front_matter:_only_the_description_is_prose
  Scenario: In front matter only the description is prose
    Given front matter whose name, description and graph-typologies all mention beans
    When retired words are found
    Then only "beans" on line 4, inside the description, is reported

  @test:scripts/tests/retired-prose-words.test.ts::what_counts_as_prose::a_quoted_YAML_description_is_prose;_a_quotation_inside_it_is_not
  Scenario: A quoted YAML description is prose but a quotation inside it is not
    Given a double-quoted description "Measured for bean cmsl."
    Then "bean" on line 2 is reported
    And given a folded description whose only mention is inside a quotation
    Then nothing is reported

  @test:scripts/tests/retired-prose-words.test.ts::what_counts_as_prose::a_generated_file_is_its_generator's_to_fix
  Scenario: A generated file is recognised as generated
    Given a file whose front matter has a "generated" field
    Then it is generated
    And a plain Markdown page is not

  @test:scripts/tests/retired-prose-words.test.ts::whose_prose_it_is::another_graph's_materialised_bytes_are_not_this_instance's_prose
  Scenario: Another graph's materialised files are not this instance's prose
    Given an instance with skills/own.md and a subscribed subgraph carrying a materialisation record and its own Markdown
    When the instance's own prose files are listed
    Then only "skills/own.md" is listed

  @test:scripts/tests/retired-prose-words.test.ts::whose_prose_it_is::a_page_declared_built_at_publish_is_its_generator's,_whether_or_not_a_build_has_written_it
  Scenario: A page declared built at publish is not the instance's own prose
    Given an instance declaring builtAtPublish for docs/kind-table.md and docs/auto/
    And files at docs/own.md, docs/kind-table.md and docs/auto/page.md
    When the instance's own prose files are listed
    Then only "docs/own.md" is listed

  @test:scripts/tests/retired-prose-words.test.ts::this_harness's_own_prose::says_no_retired_word
  Scenario: The harness's own prose says no retired word
    Given the harness declares code-lists/retired-prose-words.json
    When the harness instance is scanned
    Then the scan state is "scanned" over more than 100 files
    And no retired word is reported
