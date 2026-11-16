# Mounted pages carry the docs pages' own locale chrome (issue #2219): the
# block is the include's block. Each Scenario names the test that executes it.
Feature: Translation meta on mounted pages

  @test:scripts/tests/mount-translation-meta.test.ts::translationMetaBlock::declares_every_supported_locale,_and_none_of_them_as_translated
  Scenario: The block declares every supported locale and none as translated
    When the translation meta block is written for a mounted instance
    Then its lang is en, its supported locales are the UN locales, and its available locales are none

  @test:scripts/tests/mount-translation-meta.test.ts::translationMetaBlock::carries_only_fields_the_include_writes
  Scenario: The block carries only fields the include writes
    When the include's translation meta script is read
    Then it is found, and every key of the block is named in it

  @test:scripts/tests/mount-translation-meta.test.ts::withTranslationMeta::puts_the_block_in_the_head,_once
  Scenario: The block goes in the head, once
    When the block is added to a page with a head
    Then it sits at the end of the head
    And adding it again changes nothing

  @test:scripts/tests/mount-translation-meta.test.ts::withTranslationMeta::leaves_a_page_that_already_has_its_own_block,_or_no_head,_alone
  Scenario: A page with its own block, or with no head, is left alone
    Then a head already holding a translation meta block is unchanged
    And a fragment with no head is unchanged
