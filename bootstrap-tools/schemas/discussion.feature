Feature: the generated bootstrap discussion schemas, against the contract they replace

  Background:
    Given the generated discussion input and output JSON Schemas read from bootstrap/schemas
    And a corpus of output documents and a corpus of input documents, each labelled with whether it must validate

  @test:schemas/discussion.test.ts::the_generated_bootstrap_schemas::keepsPublishedSchemaIds
  Scenario: keep their published `$id` — it is a contract, cited from five languages' catalogues
    Then the input schema's $id is "https://litlfred.github.io/bootstrap/v0/schemas/discussion.input.schema.json"
    And the output schema's $id is "https://litlfred.github.io/bootstrap/v0/schemas/discussion.output.schema.json"

  @test:schemas/discussion.test.ts::the_generated_bootstrap_schemas::carriesTwoConditionals
  Scenario: carry the two conditionals Zod cannot export
    Then the output schema's allOf holds exactly 2 entries

  @test:schemas/discussion.test.ts::the_generated_bootstrap_schemas::strictAtEveryDepth
  Scenario: ARE strict, at every depth — bean `z634`, decided 2026-09-21
    When the occurrences of additionalProperties false are counted in each schema
    Then the input schema has 3
    And the output schema has 4

  @test:schemas/discussion.test.ts::the_generated_bootstrap_schemas::zodRejectsUnknownKeys
  Scenario: the Zod is strict too, or the two forms disagree about what validates
    Given the Zod schemas RepositoryRefSchema, ParticipantSchema, DiscussionInputSchema, ExchangeEntrySchema and DiscussionOutputObjectSchema
    When each parses an object carrying only a key it does not declare
    Then each reports an unrecognized_keys issue

  @test:schemas/discussion.test.ts::the_generated_bootstrap_schemas::output_corpus::outputCorpusVerdict[${c.why.replace(/\s+/g,_"_")}]
  Scenario Outline: output corpus > accepts or REJECTS: <why>
    Given the output case "<why>"
    When it is validated against the generated output JSON Schema
    Then the verdict is <valid>

    Examples:
      | why | valid |
      | the ordinary settled answer | true |
      | assumed WITH its documented default named | true |
      | THE CONDITIONAL: assumed with no assumption — a guess wearing a default's clothes | false |
      | unsettled WITH what remains open, so the next actor resumes | true |
      | THE CONDITIONAL: unsettled with nothing open — the next actor restarts instead of resuming | false |
      | an empty exchange is not an exchange | false |
      | answeredBy is required — an answer nobody gave is not evidence | false |
      | STRICTNESS: a typo'd key is rejected rather than ignored | false |
      | ...and the same document with the key spelled right is accepted | true |
      | STRICTNESS reaches NESTED objects too — a participant with a stray key | false |

  @test:schemas/discussion.test.ts::the_generated_bootstrap_schemas::input_corpus::inputCorpusVerdict[${c.why.replace(/\s+/g,_"_")}]
  Scenario Outline: input corpus > accepts or REJECTS: <why>
    Given the input case "<why>"
    When it is validated against the generated input JSON Schema
    Then the verdict is <valid>

    Examples:
      | why | valid |
      | the minimum a Bootstrapping Agent can populate | true |
      | with everything it might have narrowed from context | true |
      | nothing open means there is nothing to ask | false |
      | askedOf is required — the kind is recorded, never inferred | false |
      | a repository must say which part it plays | false |
      | STRICTNESS: an extra top-level key is rejected rather than ignored | false |

  @test:schemas/discussion.test.ts::the_generated_bootstrap_schemas::the_Zod_and_the_JSON_Schema_agree::zodAgreesWithOutputSchema[${c.why.replace(/\s+/g,_"_")}]
  Scenario Outline: output — <why>
    Given the output case "<why>"
    When it is parsed with the Zod DiscussionOutputSchema and validated against the generated output JSON Schema
    Then both reach the same verdict

    Examples:
      | why |
      | the ordinary settled answer |
      | assumed WITH its documented default named |
      | THE CONDITIONAL: assumed with no assumption — a guess wearing a default's clothes |
      | unsettled WITH what remains open, so the next actor resumes |
      | THE CONDITIONAL: unsettled with nothing open — the next actor restarts instead of resuming |
      | an empty exchange is not an exchange |
      | answeredBy is required — an answer nobody gave is not evidence |
      | STRICTNESS: a typo'd key is rejected rather than ignored |
      | ...and the same document with the key spelled right is accepted |
      | STRICTNESS reaches NESTED objects too — a participant with a stray key |

  @test:schemas/discussion.test.ts::the_generated_bootstrap_schemas::the_Zod_and_the_JSON_Schema_agree::zodAgreesWithInputSchema[${c.why.replace(/\s+/g,_"_")}]
  Scenario Outline: input — <why>
    Given the input case "<why>"
    When it is parsed with the Zod DiscussionInputSchema and validated against the generated input JSON Schema
    Then both reach the same verdict

    Examples:
      | why |
      | the minimum a Bootstrapping Agent can populate |
      | with everything it might have narrowed from context |
      | nothing open means there is nothing to ask |
      | askedOf is required — the kind is recorded, never inferred |
      | a repository must say which part it plays |
      | STRICTNESS: an extra top-level key is rejected rather than ignored |
