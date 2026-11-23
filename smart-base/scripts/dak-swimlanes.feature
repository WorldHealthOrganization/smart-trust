Feature: dak-swimlanes crosswalks a DAK's personas and its process swimlanes
  Personas and enumerated business processes are read from a DAK's pages,
  lane titles from its Visio figures, and the two are linked through a
  declared swimlane map, with QA naming each gap.

  @test:smart-base/scripts/dak-swimlanes.test.ts::dak-swimlanes::readsPersonasProcessesAndLaneTitles
  Scenario: reads personas, enumerated processes with their figure, and Visio lane titles
    Given a personas page table and a processes page with headings "A. Register" and "F . Trace", each followed by a figure
    Then the personas are "Health worker (HW)", "Community health worker", "Client" and "Caregiver"
    And the processes are A "Register" (anchor "a--register", figure a.svg) and F "Trace" (anchor "f---trace", figure f.svg)
    And the lanes of a.svg include "Vaccination location Health worker"

  @test:smart-base/scripts/dak-swimlanes.test.ts::dak-swimlanes::resolvesLaneThroughAliases
  Scenario: a lane resolves through declared aliases; pools and header lanes are accounted for; the rest is reported
    Given a swimlane map with persona aliases and declared non-personas
    Then "Vaccination location Health worker" resolves to "Health worker (HW)" with nothing left over
    And "Community CHW" resolves to "Community health worker" with nothing left over
    And "PCPOSS" resolves to no persona, with "PCPOSS" left over

  @test:smart-base/scripts/dak-swimlanes.test.ts::dak-swimlanes::crosswalkLinksBothWaysQaNamesGaps
  Scenario: the crosswalk links both ways and its QA names each gap
    Given the crosswalk of the personas, the processes and their figures' lanes
    Then "Client", which appears twice in a.svg, is one row
    And the personas markdown links "Health worker (HW)" to "A. Register" and says "Caregiver | _no swimlane in any process_"
    And the processes markdown links "Community health worker" to its persona anchor and lists "**not a declared persona:** PCPOSS"
    And the swimlane QA reports "Caregiver" as a persona without swimlane, one swimlane without persona, and 2 in total
