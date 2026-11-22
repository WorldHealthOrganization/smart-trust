# Specifies schemas/kg/property-skills.ts (issue #1146): PROPERTY_SKILLS, the
# map from each instance-declaration key to the skills that edit it.
Feature: Every declaration key has exactly one edit-skill row

  @test:schemas/kg/property-skills.test.ts::PROPERTY_SKILLS::the_schema_has_keys_to_check_(vacuity_guard)
  Scenario: The declaration schema has keys to check
    When the keys of the instance declaration schema are read
    Then there are more than ten

  @test:schemas/kg/property-skills.test.ts::PROPERTY_SKILLS::every_declaration_key_has_a_row:_a_skill_or_a_recorded_gap
  Scenario: Every declaration key has a row
    When each declaration key is looked up in PROPERTY_SKILLS
    Then none is missing

  @test:schemas/kg/property-skills.test.ts::PROPERTY_SKILLS::no_row_for_a_key_the_schema_does_not_have
  Scenario: No row names a key the schema does not have
    When each PROPERTY_SKILLS row is looked up among the declaration keys
    Then none is missing

  @test:schemas/kg/property-skills.test.ts::PROPERTY_SKILLS::a_row_with_no_skill_says_why
  Scenario: A row with no skill records a gap
    When each PROPERTY_SKILLS row with no skills is read
    Then its gap is a non-empty string
