# Specifies resolvableSkillIndex and resolveSkillRef
# (scripts/known-skills.ts) over the skill references of the checkout: tools'
# satisfies, cat-harness's roles, every skill's inherits: and library
# summaries.
Feature: Every skill reference in the checkout resolves to one skill

  @test:test/coordinator/skill-refs-checkout.test.ts::the_corpus:_every_skill_reference_resolves_to_one_skill::the_corpus_is_non-empty,_so_the_assertions_below_are_not_vacuous
  Scenario: The skill index and the references are non-empty
    Given the resolvable skill index of cat-harness and the collected references
    When they are counted
    Then the index has more than 100 names
    And some reference is qualified with "/" and some is bare

  @test:test/coordinator/skill-refs-checkout.test.ts::the_corpus:_every_skill_reference_resolves_to_one_skill::no_bare_name_is_held_by_two_packages
  Scenario: No bare skill name is held by two packages
    Given the resolvable skill index
    When names held by more than one package are collected
    Then there are none

  @test:test/coordinator/skill-refs-checkout.test.ts::the_corpus:_every_skill_reference_resolves_to_one_skill::skill_inherits:_is_counted,_so_its_resolution_below_is_not_vacuous
  Scenario: At least seven inherits: references are collected
    Given the collected references
    When those from an "inherits:" line are counted
    Then there are at least 7

  @test:test/coordinator/skill-refs-checkout.test.ts::the_corpus:_every_skill_reference_resolves_to_one_skill::every_reference_resolves
  Scenario: Every reference resolves
    Given the collected references
    When each is resolved against the index
    Then every one resolves "ok"
