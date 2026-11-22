# wrapRaw renders back to exactly its input, whatever it holds, above all the
# raw block's own closing tag (bean kjbb). A model renderer of the Liquid
# wrapRaw emits is the oracle everywhere; Ruby Liquid in strict mode is a
# second one when installed. Each Scenario names the test that executes it.
Feature: Wrapping text in a Liquid raw block

  @test:scripts/tests/liquid-raw.test.ts::wrapRaw::round-trips_%s
  Scenario: Each case round-trips through wrapRaw and the model renderer
    Given a case among plain prose, expression and tag syntax, the closing tag in a code span, its whitespace-control and spacing variants, the closing tag alone, the closing tag before an unparseable tag, and a word that merely starts with endraw
    When it is wrapped and the result rendered by the model renderer
    Then the rendered text is the case's text

  @test:scripts/tests/liquid-raw.test.ts::wrapRaw::leaves_text_without_a_closing_tag_untouched
  Scenario: Text without a closing raw tag is not escaped
    Given text holding {{ x }} and {% if %} but no endraw tag
    When it is escaped for a raw block
    Then it is unchanged

  @test:scripts/tests/liquid-raw.test.ts::wrapRaw::is_what_the_unescaped_form_gets_wrong
  Scenario: The unescaped form fails the oracle
    Given the closing tag followed by an unparseable tag, wrapped in raw and endraw without escaping
    When the model renderer renders it
    Then it throws

  @test:scripts/tests/liquid-raw.test.ts::wrapRaw::round-trips_every_case_through_Ruby_Liquid_(strict)
  Scenario: Every case round-trips through Ruby Liquid in strict mode
    Given Ruby with the liquid gem is installed, else the test is skipped
    When every wrapped case is parsed in strict mode and rendered
    Then nothing is written to stderr and each renders to its case's text
