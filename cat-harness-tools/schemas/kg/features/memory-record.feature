# Specifies schemas/kg/memory-record.ts (cat-harness#991 §4.14, Q17): the
# memory-record kind, the core it shares with the bean, and an entry written
# as one body line.
Feature: A memory record holds structured entries, and a bean is one with more structure

  @test:schemas/kg/memory-record.test.ts::the_layers::a_bean_is_a_memory_record_with_more_structure:_it_inherits_the_shared_core
  Scenario: The bean and the memory record both inherit the shared core
    When the inheritance orders of the bean kind and the memory-record kind are read
    Then each contains the memory-record core kind

  @test:schemas/kg/memory-record.test.ts::the_layers::the_bean's_fields_are_exactly_what_they_were:_the_core_plus_its_own
  Scenario: The bean kind has exactly the bean front-matter fields
    When the bean kind's schema fields, less $schema, are listed
    Then they equal the fields of the bean front-matter schema

  @test:schemas/kg/memory-record.test.ts::the_layers::a_memory_record_on_its_own:_scope_required,_entries_structured
  Scenario: A memory record's scope and entries are checked
    Given a memory record with scope "shared" and one well-formed entry
    When it is parsed with the memory-record kind's schema
    Then it parses
    And the same record with no scope is refused
    And the same record with scope "everyone" is refused
    And a record whose entry has the kind "gossip" is refused

  @test:schemas/kg/memory-record.test.ts::an_entry_as_a_body_line::round-trips,_metadata_included
  Scenario: An entry round-trips through its body line
    Given an entry with time, author, kind, text, process, step, instance and role
    When it is rendered as a line and parsed back
    Then the same entry is returned

  @test:schemas/kg/memory-record.test.ts::an_entry_as_a_body_line::is_one_line,_whatever_the_text_holds
  Scenario: An entry renders as one line whatever its text holds
    Given an entry whose text holds blank lines, "]" and "·"
    When it is rendered
    Then the line holds no newline
    And an entry with text "a\n\nb" parses back with text "a b"

  @test:schemas/kg/memory-record.test.ts::an_entry_as_a_body_line::is_found_after_a_Tool's_own_stamp,_and_a_Tool's_signature_is_not_the_text
  Scenario: An entry line is found after a Tool's stamp and before its signature
    Given the rendered entry preceded by "_2026-11-03 07:00_ — " and followed by " (agent-1)"
    When the line is parsed
    Then the original entry is returned

  @test:schemas/kg/memory-record.test.ts::an_entry_as_a_body_line::prose_in_a_body_is_not_an_entry
  Scenario: Prose in a body is not an entry
    Given a body of prose, one rendered entry line, and a prose line containing "[memory?]"
    When its entries are read
    Then only the one entry is returned
