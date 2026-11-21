Feature: the audit tools and their split by content type

  @test:scripts/tests/audit-tools.test.ts::registerAuditTools::registersAllAuditTools
  Scenario: registers all audit tools with handlers + descriptions
    When the audit tools are registered
    Then each expected tool has a handler and a description saying it is read-only
    And there are no others

  @test:scripts/tests/audit-tools.test.ts::the_audit_split_by_content_type::halvesPartition
  Scenario: the two halves partition the table — nothing lost, nothing duplicated
    When the document and paper halves are compared with the whole table
    Then they share nothing and together are the whole table

  @test:scripts/tests/audit-tools.test.ts::the_audit_split_by_content_type::texLeanMathPaperOnly
  Scenario: audits that read .tex, .lean or a math kind are paper-only
    When the audits that read .tex, .lean or a math kind are looked for
    Then each is in the paper half only

  @test:scripts/tests/audit-tools.test.ts::the_audit_split_by_content_type::agnosticForDocuments
  Scenario: content-agnostic audits stay available to a document folio
    When the content-agnostic audits are looked for
    Then each is available to a document folio
