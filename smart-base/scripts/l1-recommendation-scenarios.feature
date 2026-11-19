Feature: L1 recommendation scenario candidates
  Each L1 recommendation becomes an L2 user-scenario candidate that reuses the
  guide's persona and process vocabulary, falls back to generic personas, and
  refuses what neither vocabulary holds.

  @test:smart-base/scripts/l1-recommendation-scenarios.test.ts::a_scenario_per_recommendation,_in_L2's_own_shape::writesUserStory
  Scenario: writes the user story from persona, process, act and outcome
    Given scenarios built from recommendations R1 and C1 with a guide and a generic vocabulary
    Then scenario T.Measles.R1's description is "As a Health worker, during T.D Administer vaccine, I give MCV1 at 9 months so that the infant is protected."
    And a user story for "EPI Manager" with no process reads "As an EPI Manager, during [process not determined], I plan so that it works."

  @test:smart-base/scripts/l1-recommendation-scenarios.test.ts::a_scenario_per_recommendation,_in_L2's_own_shape::joinsWithThreeCandidateEdges
  Scenario: joins with the three licensed edges, every one a candidate
    Then the edges touching scenario T.Measles.R1 are implementedBy, involves and realises
    And every edge's review status is "candidate"

  @test:smart-base/scripts/l1-recommendation-scenarios.test.ts::a_scenario_per_recommendation,_in_L2's_own_shape::keepsL2PropertiesDomainOnEdge
  Scenario: keeps L2 node properties to those user-scenario declares; domain sits on the edge
    Then scenario T.Measles.R1's properties are exactly description, id, source and title
    And its implementedBy edge carries domain "public-health" with domain source "inferred"

  @test:smart-base/scripts/l1-recommendation-scenarios.test.ts::a_scenario_per_recommendation,_in_L2's_own_shape::fallsBackGenericThenGlossaryCandidate
  Scenario: falls back to the generic persona, then a glossary candidate, and warns only for the candidate
    Then C1's involves edges are of tier "generic" and "glossary-candidate"
    And the generic one targets "https://smart.who.int/base/persona/healthcare-provider"
    And the glossary candidate is "unresolved"
    And the counts by tier are 1 guide, 1 generic and 1 glossary-candidate

  @test:smart-base/scripts/l1-recommendation-scenarios.test.ts::a_scenario_per_recommendation,_in_L2's_own_shape::warnsNoProcessForCouldNotDetermine
  Scenario: warns and draws no process for could-not-determine
    Then no realises edge touches C1's scenario
    And the warnings are "persona-glossary-candidate C1" and "process-not-determined C1"
    And the process warning line starts "WARNING process-not-determined C1:" and mentions "catalogue absent"

  @test:smart-base/scripts/l1-recommendation-scenarios.test.ts::a_scenario_per_recommendation,_in_L2's_own_shape::mapsSourceToDerivation
  Scenario: maps a link's source onto smart-kg derivation: declared is decided
    Then declared maps to "decided", context to "inferred" and inferred to "inferred"

  @test:smart-base/scripts/l1-recommendation-scenarios.test.ts::a_scenario_per_recommendation,_in_L2's_own_shape::currentUpToGeneratedAt
  Scenario: is current up to generatedAt
    Then the scenario document is current against the same inputs built at another generatedAt

  @test:smart-base/scripts/l1-recommendation-scenarios.test.ts::refusals::refusesProcessTypo
  Scenario: a typo is not a new process
    Given a mapping whose R1 process is "T.DD"
    Then a refusal says 'process "T.DD" is not a smart-test process'
    And building the scenarios throws a refusal error

  @test:smart-base/scripts/l1-recommendation-scenarios.test.ts::refusals::refusesUnknownPersona
  Scenario: a persona id in neither vocabulary
    Given a mapping whose R1 persona is "nurse"
    Then a refusal says 'persona "nurse" is neither a smart-test persona nor a generic one'

  @test:smart-base/scripts/l1-recommendation-scenarios.test.ts::refusals::refusesUnmappedAndOrphanEntries
  Scenario: a recommendation with no entry, and an entry for no recommendation
    Given a recommendation R2 with no mapping entry and a mapping entry R9 with no recommendation
    Then the refusals include "R2: no mapping entry — coverage must be 100%"
    And "R9: mapped, but the L1 source has no such recommendation"

  @test:smart-base/scripts/l1-recommendation-scenarios.test.ts::refusals::refusesDeclaredLinkNamingNobody
  Scenario: a declared link that names nobody
    Given a mapping whose R1 process link is "declared" with no one named
    Then the mapping does not parse

  @test:smart-base/scripts/l1-recommendation-scenarios.test.ts::inputs::readsL1GraphRecommendations
  Scenario: reads an L1 3.0 graph document's recommendation nodes
    Given an L1 graph document with a recommendation A.1.1 and a publication
    Then reading it gives only A.1.1, with its IRI, statement "S." and location "p15"

  @test:smart-base/scripts/l1-recommendation-scenarios.test.ts::inputs::readsMeaslesYamlShape
  Scenario: reads the measles YAML shape, minting a url-identified publication
    Given a YAML L1 file with a publication url and recommendation R01 on page 220
    Then the first recommendation read is R01 with a url-who-int-x-measles publication IRI and location "p220"

  @test:smart-base/scripts/l1-recommendation-scenarios.test.ts::inputs::readsMarkdownTableAndHtmlRows
  Scenario: reads a markdown process table and HTML persona rows
    Then the markdown table's first "Process ID" is "IMMZ.D"
    And the HTML row's cells are "Caregiver" and "A parent"

  @test:smart-base/scripts/l1-recommendation-scenarios.test.ts::inputs::readsGenericPersonasFromFsh
  Scenario: reads generic personas from FSH ActorDefinitions
    Given an FSH ActorDefinition DAK.Persona.X
    Then it is read with title "X Person", description "Does x.", ISCO code "1342" and persona type "person"

  @test:smart-base/scripts/l1-recommendation-scenarios.test.ts::inputs::takesGuideIdentityFromDeclarations
  Scenario: takes a guide's identity from the checkout's own declarations, naming no guide
    Then the SUSHI canonical is read without its trailing comment
    And a checkout with only a sushi-config.yaml is guide "smart-x" from its remote repository
    And with an instance declaration "smart-y" added it is guide "smart-y" of repository "owner/smart-y"
    And a checkout with neither throws "guide checkout"

  @test:smart-base/scripts/l1-recommendation-scenarios.test.ts::inputs::emitsOnlyPinnedClasses
  Scenario: emits only classes the KG class lists hold
    Then there are no unpinned classes

  @test:smart-base/scripts/l1-recommendation-scenarios.test.ts::inputs::alwaysOnScriptsStayOffOptInSubgraphsAndL1CheckExits78WhenUnmounted
  Scenario: always-on scripts in smart-base/scripts/ never import into opt-in L1..L4 subgraphs, and smart-base:smart-kg-l1:check exits 78 when L1/ is unmounted
    Given the always-on scripts in smart-base/scripts/ and smart-base/package.json
    Then no file in smart-base/scripts/ imports from ../L1/, ../L2/, ../L2-bpmn/, ../L2-dmn/, ../L3/ or ../L4/
    And running smart-base:smart-kg-l1:check in a directory where smart-base/L1/ is absent exits 78 with "NOT APPLICABLE in this root"
