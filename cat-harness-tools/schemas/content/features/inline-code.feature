# Specifies schemas/content/inline-code.ts: withInlineCode, which turns
# backtick spans into <code> and escapes the rest with the caller's escaper,
# and stripInlineCode (bean mylx).
Feature: Backtick spans become <code>, escaped by the caller's escaper

  Background:
    Given an escaper for "&", "<" and ">"

  @test:schemas/content/inline-code.test.ts::backtick_spans_become_<code>_—_bean_`mylx`::a_span_is_wrapped,_and_the_text_around_it_is_escaped
  Scenario: A span is wrapped and everything is escaped
    When "run `bun <x>` & go" is rendered
    Then it is "run <code>bun &lt;x&gt;</code> &amp; go"

  @test:schemas/content/inline-code.test.ts::backtick_spans_become_<code>_—_bean_`mylx`::several_spans_on_one_line
  Scenario: Several spans on one line
    When "`a` and `b`" is rendered
    Then it is "<code>a</code> and <code>b</code>"

  @test:schemas/content/inline-code.test.ts::backtick_spans_become_<code>_—_bean_`mylx`::the_caller's_escaper_reaches_the_code_span_too
  Scenario: The caller's escaper reaches the code span
    Given an escaper that also escapes "{"
    When "`{{ x }}`" is rendered with it
    Then it is "<code>&#123;&#123; x }}</code>"

  @test:schemas/content/inline-code.test.ts::backtick_spans_become_<code>_—_bean_`mylx`::an_unpaired_backtick_is_left_as_written,_not_guessed_at
  Scenario: An unpaired backtick is left as written
    When "it's a ` stray" is rendered
    Then it is unchanged

  @test:schemas/content/inline-code.test.ts::backtick_spans_become_<code>_—_bean_`mylx`::an_empty_pair_is_not_a_span
  Scenario: An empty pair is not a span
    When "`` two" is rendered
    Then it is unchanged

  @test:schemas/content/inline-code.test.ts::backtick_spans_become_<code>_—_bean_`mylx`::strip_removes_only_the_markers
  Scenario: Stripping removes only the backticks
    When "`MathlibExt` Curator" is stripped
    Then it is "MathlibExt Curator"
