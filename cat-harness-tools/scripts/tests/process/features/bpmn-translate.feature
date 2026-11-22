# BPMN label extraction and injection, on the harness's own diagrams: what a
# reader sees is offered for translation; ids, skill refs and bean ops are not
# touched.
Feature: BPMN labels are extracted and injected, and structure is never translated

  @test:scripts/tests/process/bpmn-translate.test.ts::extractBpmn::finds_the_labels_a_reader_sees
  Scenario: Extraction finds the labels a reader sees
    Given processes/process/crdm-requirements.bpmn
    When its labels are extracted
    Then the msgids include "BA / Feature Requestor" and "Detect feature request (crdm-detect skill)"
    And there are more than 20 entries

  @test:scripts/tests/process/bpmn-translate.test.ts::extractBpmn::authored_line_breaks_become_spaces,_because_a_translator_never_sees_them
  Scenario: An authored line break in a label becomes a space
    Given the label "Describe the need&#10;(chat, issue, discussion)"
    When it is decoded
    Then it is "Describe the need (chat, issue, discussion)"

  @test:scripts/tests/process/bpmn-translate.test.ts::extractBpmn::never_offers_an_id,_a_skill_ref_or_a_bean_op_for_translation
  Scenario: Ids, skill refs and bean ops are never offered for translation
    Given crdm-requirements.bpmn
    When its labels are extracted
    Then none of the ids BA_Submit, A_Detect, Process_CRDM, Lane_Agent is a msgid
    And none of the skill refs crdm-detect, crdm-requirements-workflow, todo-manager is a msgid
    And none of the bean ops note, claim, resolve is a msgid

  @test:scripts/tests/process/bpmn-translate.test.ts::extractBpmn::de-duplicates,_because_a_repeated_label_is_one_translation
  Scenario: Extracted msgids are unique
    Given crdm-requirements.bpmn
    When its labels are extracted
    Then no msgid appears twice

  @test:scripts/tests/process/bpmn-translate.test.ts::injectBpmn::translates_a_label_and_leaves_the_structure_alone
  Scenario: Injection translates a label and leaves structural handles alone
    Given crdm-requirements.bpmn and a translation of "BA / Feature Requestor" to "BA / Demandeur"
    When the translation is injected
    Then the output has name="BA / Demandeur"
    And it still has id="Lane_BA", the flowNodeRef BA_Submit and the skill ref "crdm-detect"
    And injecting a translation into sdlc/processes/merge-refusal.bpmn keeps its bean op "note"

  @test:scripts/tests/process/bpmn-translate.test.ts::injectBpmn::an_untranslated_msgid_keeps_its_source_text
  Scenario: An untranslated label keeps its source text
    Given crdm-requirements.bpmn and a translation of "BA / Feature Requestor" only
    When the translation is injected
    Then the output still has name="Agent"

  @test:scripts/tests/process/bpmn-translate.test.ts::injectBpmn::round-trips:_inject_then_re-extract_sees_the_translation
  Scenario: Re-extracting an injected diagram sees the translation
    Given translations "Agent" to "Agent (fr)" and "Stakeholders" to "Parties prenantes"
    When they are injected into crdm-requirements.bpmn and into crdm-deliver.bpmn, and each is re-extracted
    Then the first offers "Agent (fr)"
    And the second offers "Parties prenantes"

  @test:scripts/tests/process/bpmn-translate.test.ts::injectBpmn::escapes_a_translation_containing_XML_metacharacters
  Scenario: A translation with XML metacharacters is escaped
    Given a translation of "Agent" to 'A & B "quoted" <tag>'
    When it is injected into crdm-requirements.bpmn
    Then the output has name="A &amp; B &quot;quoted&quot; &lt;tag&gt;"
    And it still has id="Lane_Agent"
