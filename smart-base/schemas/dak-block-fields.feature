Feature: The DAK kinds carry WHO's DAK logical-model fields
  Each field of WHO's DAK logical models survives the kind's Zod schema, the
  fields are checked, and every field is optional so a block written before
  them still builds.

  @test:smart-base/schemas/dak-block-fields.test.ts::WHO_logical-model_fields_survive_the_schema::persona:_GenericPersona_/_Persona
  Scenario: a persona keeps its GenericPersona / Persona fields
    Given a persona with personaType "key", other name "Midwife" and ISCO code "2221"
    When the persona schema parses it
    Then personaType, otherNames and iscoCodes are kept

  @test:smart-base/schemas/dak-block-fields.test.ts::WHO_logical-model_fields_survive_the_schema::business-process:_BusinessProcessWorkflow
  Scenario: a business process keeps its BusinessProcessWorkflow fields
    Given a business process with objectives, a scenario and a task with identifier, name and description
    When the business-process schema parses it
    Then objectives, scenarios and tasks are kept

  @test:smart-base/schemas/dak-block-fields.test.ts::WHO_logical-model_fields_survive_the_schema::data-element:_CoreDataElement
  Scenario: a data element keeps its CoreDataElement fields
    Given a data element with cdeType "logicalmodel" and a canonical URL
    When the data-element schema parses it
    Then cdeType and canonical are kept

  @test:smart-base/schemas/dak-block-fields.test.ts::WHO_logical-model_fields_survive_the_schema::indicator:_ProgramIndicator
  Scenario: an indicator keeps its ProgramIndicator fields
    Given an indicator with an indicator id, definition, numerator, denominator, disaggregation and references
    When the indicator schema parses it
    Then indicatorId, numerator, denominator, disaggregation and references are kept

  @test:smart-base/schemas/dak-block-fields.test.ts::WHO_logical-model_fields_survive_the_schema::functional-requirement:_FunctionalRequirement
  Scenario: a functional requirement keeps its FunctionalRequirement fields
    Given a functional requirement with a requirement id, activity, actors, capability, benefit and classification
    When the functional-requirement schema parses it
    Then requirementId, actors, capability and benefit are kept

  @test:smart-base/schemas/dak-block-fields.test.ts::WHO_logical-model_fields_survive_the_schema::non-functional-requirement:_NonFunctionalRequirement
  Scenario: a non-functional requirement keeps its NonFunctionalRequirement fields
    Given a non-functional requirement with a requirement id, requirement and category
    When the non-functional-requirement schema parses it
    Then requirementId, requirement and category are kept

  @test:smart-base/schemas/dak-block-fields.test.ts::the_fields_are_checked::persona_type_is_SGPersonaTypesVS_only
  Scenario: a persona type outside SGPersonaTypesVS is refused
    When a persona is built with personaType "person"
    Then the builder throws

  @test:smart-base/schemas/dak-block-fields.test.ts::the_fields_are_checked::an_ISCO-08_code_is_one_to_four_digits
  Scenario: an ISCO-08 code that is not one to four digits is refused
    When a persona is built with ISCO code "nurse"
    Then the builder throws

  @test:smart-base/schemas/dak-block-fields.test.ts::the_fields_are_checked::a_core_data_element_type_is_CoreDataElementTypeVS_only
  Scenario: a core data element type outside CoreDataElementTypeVS is refused
    When a data element is built with cdeType "table"
    Then the builder throws

  @test:smart-base/schemas/dak-block-fields.test.ts::the_fields_are_checked::a_business-process_task_needs_identifier,_name_and_description
  Scenario: a business-process task with an empty name is refused
    When a business process is built with a task whose name is empty
    Then the builder throws

  @test:smart-base/schemas/dak-block-fields.test.ts::blocks_written_before_the_fields_still_build::a_bare_persona,_requirement_and_data_element
  Scenario: a bare persona, functional requirement and data element still build
    When each is built with only a label and no uses
    Then their kinds are "persona", "functional-requirement" and "data-element"
