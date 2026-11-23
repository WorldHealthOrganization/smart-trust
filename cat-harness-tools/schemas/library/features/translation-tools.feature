# schemas/library/translation-tools.ts: content-type translation profiles are declared by the
# instance that owns the content type, and collected across the instances present.
# Each Scenario names the test that executes it.
Feature: Content-type translation profiles

  @test:schemas/library/translation-tools.test.ts::translation_profiles_come_from_the_instances_present::standalone,_with_no_instance_declaring_a_content_type,_nothing_is_translatable
  Scenario: With no instance declaring a content type, nothing is translatable
    Given a root holding only instance "acme", which declares no translation profiles
    When the content-type translations are collected
    Then the list is empty

  @test:schemas/library/translation-tools.test.ts::translation_profiles_come_from_the_instances_present::a_declared_profile_is_collected_with_the_instance_that_declared_it
  Scenario: A declared profile is collected with the instance that declared it
    Given instance "acme" declaring a translation profile for content type "brochure"
    When the content-type translations are collected
    Then the only content type is "brochure"
    And it is declared by the "acme" directory

  @test:schemas/library/translation-tools.test.ts::translation_profiles_come_from_the_instances_present::a_content_type_with_two_owners_is_refused,_not_merged
  Scenario: A content type with two owners is refused, not merged
    Given instances "acme" and "other" both declaring a profile for "brochure"
    When the content-type translations are collected
    Then collection throws, saying there is a translation profile in both

  @test:schemas/library/translation-tools.test.ts::in_this_checkout::cat-harness_declares_only_its_own_docs-site_profile;_every_content_type_is_declared_by_its_owner
  Scenario: cat-harness declares only its own docs-site profile
    # Gap: only cat-harness's own profiles are checked, not that every other content type is declared by its owner
    Given the content-type translations collected in this checkout
    When those declared by the "cat-harness" directory are picked out
    Then their content types are exactly "docs"
