# Specifies PROPERTY_SKILLS (schemas/kg/property-skills.ts) against the skill
# files in every instance of the checkout.
Feature: Every skill PROPERTY_SKILLS names exists in the checkout

  @test:test/coordinator/property-skills-checkout.test.ts::PROPERTY_SKILLS::every_skill_named_exists
  Scenario: Every named skill has a skill file
    Given the skill names found under "<instance>/skills/" and "<instance>/<sub-graph>/skills/", SKILL.md packages by directory
    When every skill each property names is looked up
    Then none is missing
