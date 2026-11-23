# Specifies schemas/process/workshop.ts: parseWorkshop, which accepts a
# workshop only when every module, table, row, sheet and step it names is
# declared in the same workshop, and the shape of its presentation block.
Feature: A workshop names only its own modules, tables, rows and sheets

  @test:schemas/process/workshop.test.ts::workshop:_every_module,_table,_row_and_sheet_it_names_is_its_own::a_consistent_workshop_parses,_and_a_sheet_defaults_to_A3
  Scenario: A consistent workshop parses, and a sheet defaults to A3
    Given a workshop with one module, one table with one row, one sheet with no size and one step
    When it is parsed
    Then its sheet's size is "A3"

  @test:schemas/process/workshop.test.ts::workshop:_every_module,_table,_row_and_sheet_it_names_is_its_own::a_question_in_an_undeclared_module_is_refused
  Scenario: A question in an undeclared module is refused
    Given the workshop with a step asking a question in module "M9"
    When it is parsed
    Then it throws naming module "M9"

  @test:schemas/process/workshop.test.ts::workshop:_every_module,_table,_row_and_sheet_it_names_is_its_own::a_tag_on_an_unknown_row,_and_a_module_filling_an_unknown_sheet,_are_refused
  Scenario: A tag on an unknown row, and a module on an unknown sheet, are refused
    Given the workshop with a step tagging row "nobody", and the workshop with its module on sheet "s9"
    When each is parsed
    Then the first throws naming row "nobody"
    And the second throws naming sheet "s9"

  @test:schemas/process/workshop.test.ts::workshop:_every_module,_table,_row_and_sheet_it_names_is_its_own::the_presentation's_views,_notes,_IG_pages_and_device_demo_parse;_a_screen_with_no_step_is_refused
  Scenario: A presentation block parses; a screen with no step and an unknown note are refused
    Given a presentation with notes, a closing question, views, IG pages and a device demo screen
    When the workshop carrying it is parsed
    Then the parsed presentation equals it
    And a device demo screen with an empty step list throws
    And notes with an unknown key "overview" throw

  @test:schemas/process/workshop.test.ts::workshop:_every_module,_table,_row_and_sheet_it_names_is_its_own::the_same_step_twice_is_refused
  Scenario: The same step twice is refused
    Given the workshop with its one step listed twice
    When it is parsed
    Then it throws saying the step appears twice
