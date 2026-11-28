Feature: l1-transcription-verbatim checks L1 transcriptions against their source
  An L1 file's recommendations must be verbatim from its transcriptions, and
  its transcriptions corroborated by the library entry's text layer or image
  narratives.

  @test:smart-base/L1/scripts/l1-transcription-verbatim.test.ts::l1-transcription-verbatim::normDropsPrivateUseGlyphs
  Scenario: drops private-use glyphs when normalising
    When "Hepatitis" followed by a private-use glyph and " B" is normalised
    Then it is "Hepatitis B"

  @test:smart-base/L1/scripts/l1-transcription-verbatim.test.ts::l1-transcription-verbatim::passesVerbatimAndCorroborated
  Scenario: passes verbatim statements and corroborated transcriptions
    Given a library poster whose text layer reads "Birth Polio Tuberculosis Hepatitis B Weeks" and an image narrated "BCG 1 at birth"
    And an L1 file transcribing "Birth: Polio, Tuberculosis, Hepatitis B" with a statement "Birth: Polio" from it and a statement "BCG 1 at birth" from the image
    When the file is checked
    Then there are no findings

  @test:smart-base/L1/scripts/l1-transcription-verbatim.test.ts::l1-transcription-verbatim::reportsNonVerbatimUncorroboratedDuplicate
  Scenario: reports a non-verbatim statement, an uncorroborated word and a duplicate key
    Given the library poster
    And an L1 file transcribing "Birth: Polio, Measles", with a statement "Birth: Polio and BCG" from it and a second statement with the same key P01
    When the file is checked
    Then a finding says "T1: words not in the text layer: measles"
    And a finding says "P01: recommendation is not verbatim"
    And a finding says "P01: duplicate key"

  @test:smart-base/L1/scripts/l1-transcription-verbatim.test.ts::l1-transcription-verbatim::allowsInspectionOnlyWord
  Scenario: an inspectionOnly word is allowed
    Given the library poster
    And an L1 file transcribing "Birth Measles" that marks "measles" as inspectionOnly
    When the file is checked
    Then there are no findings
