# The computation-witness kind's two schemas, the permissive envelope that
# validates the kind and the strict producer contract, and the conformance
# report. The fixture shapes are the divergences measured over qou's
# witnesses (bean qou-qb6t). Each Scenario names the test that executes it.
Feature: Computation witness conformance

  @test:scripts/tests/witness-conformance.test.ts::the_envelope_(the_kind's_validator)::accepts_a_conforming_witness
  Scenario: The envelope accepts a conforming witness
    Given a witness with engine, version, time, script, hash, one passing assertion and allPassed
    Then the envelope accepts it

  @test:scripts/tests/witness-conformance.test.ts::the_envelope_(the_kind's_validator)::accepts_a_witness_with_%s
  Scenario Outline: The envelope accepts each divergence the corpus holds
    Given a witness with <divergence>
    Then the envelope accepts it

    Examples:
      | divergence                             |
      | no engine                              |
      | an engine outside the contract's list  |
      | a structured engine                    |
      | no assertions                          |
      | assertions keyed by name               |
      | a bare string among assertions         |
      | a boolean computed value               |
      | a list computed value                  |
      | auditOnly as a boolean                 |
      | a null optional field                  |
      | a foreign $schema spelling             |

  @test:scripts/tests/witness-conformance.test.ts::the_envelope_(the_kind's_validator)::rejects_a_present_field_of_the_wrong_type
  Scenario: The envelope rejects a present field of the wrong type
    Then a numeric scriptHash, a string allPassed, and an array instead of an object are each rejected

  @test:scripts/tests/witness-conformance.test.ts::the_producer_contract::accepts_a_conforming_witness
  Scenario: The producer contract accepts a conforming witness
    Given the conforming witness
    Then the producer contract accepts it

  @test:scripts/tests/witness-conformance.test.ts::the_producer_contract::rejects_a_witness_with_%s
  Scenario Outline: The producer contract rejects a corpus divergence
    Given a witness with <divergence>
    Then the producer contract rejects it

    Examples:
      | divergence                            |
      | no engine                             |
      | an engine outside the contract's list |
      | no assertions                         |
      | auditOnly as a boolean                |
      | a boolean computed value              |

  @test:scripts/tests/witness-conformance.test.ts::the_graph_typology::is_registered_as_derived,_with_the_envelope_as_its_validator
  Scenario: The computation-witness typology is registered as derived, validated by the envelope
    # Gap: without a composed content layer the test only checks that none is composed, and the registration is not checked
    Given a content layer is composed
    Then computation-witness is not a base typology, but a core one holding derived nodes
    And its validator is the envelope schema, with no node schemas

  @test:scripts/tests/witness-conformance.test.ts::checkWitnesses::counts_each_class,_and_only_reads_*.witness.json
  Scenario: The conformance report counts each class and reads only witness files
    Given a computations tree with a conforming witness, one with no engine in a subdirectory, one with a numeric scriptHash, one holding NaN, and a non-witness file
    When the witnesses are checked
    Then 4 witnesses are read, the NaN one is not strict JSON, the numeric-hash one is malformed and one conforms
    And the only finding is the missing engine and engineVersion, once, with the subdirectory witness as example
