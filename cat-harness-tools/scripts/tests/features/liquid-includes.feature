# Every Liquid tag in every site layer's _includes/ is a known tag carrying
# the expression its form needs, or sits inside {% raw %}: Liquid parses tags
# inside HTML comments. Each Scenario names the test that executes it.
Feature: Liquid tags in the site includes

  @test:scripts/tests/liquid-includes.test.ts::Liquid_in_docs/_includes::there_are_includes_to_check
  Scenario: There are includes to check
    Given every site layer's _includes directory that exists
    Then at least one .html, .js or .md file is found in them

  @test:scripts/tests/liquid-includes.test.ts::Liquid_in_docs/_includes::%s:_every_tag_is_real_or_escaped
  Scenario: Every Liquid tag of an include is real or escaped
    Given an include file
    When its Liquid tags outside raw blocks are read
    Then no tag that needs an expression lacks one
    And no tag is one the check does not know

  @test:scripts/tests/liquid-includes.test.ts::Liquid_in_docs/_includes::catches_the_exact_comment_that_broke_the_build
  Scenario: The comment that broke the build is caught
    # Gap: the test applies its own "bare if" filter to liquidTags, not the per-include check's rule
    Given an HTML comment whose third line holds a bare {% if %}
    When its tags outside raw blocks are read
    Then the bare "if" tag is found on line 3

  @test:scripts/tests/liquid-includes.test.ts::Liquid_in_docs/_includes::the_same_comment_inside_{%_raw_%}_is_fine
  Scenario: The same comment inside a raw block is fine
    Given an HTML comment holding {% raw %}{% if %}{% endraw %}
    When its tags outside raw blocks are read
    Then the only one is the opening "raw"
