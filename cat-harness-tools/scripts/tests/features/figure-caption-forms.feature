# The figure-caption patterns in scripts/pdf-vector-labels.py, scripts/pdf-vector-figures.py and declaredFigureCaptions in scripts/check-l1-complete.ts
# accept captions written "Fig 1." with no dot after "Fig". Each Scenario names the test that executes it.
Feature: Figure captions written "Fig N." are found

  @test:scripts/tests/figure-caption-forms.test.ts::caption_patterns_accept_`Fig_N.`::the_Python_arms_find_`Fig_1.`_and_still_refuse_non-captions
  Scenario: The Python caption patterns accept "Fig 1." and refuse non-captions
    # Skipped: when PyMuPDF is not installed
    Given text lines "Fig 1. …", "Fig. 5. …", "Fig. 13 …", "Figure 2.13. …", "Fight the stock-outs", "Figs 3 and 4 show" and a "Fig 7." table-of-contents line with dot leaders
    When the Python caption candidates and labels are read
    Then the candidates are the first four lines only
    And their labels are "1", "5", "13" and "2.13"

  @test:scripts/tests/figure-caption-forms.test.ts::caption_patterns_accept_`Fig_N.`::declaredFigureCaptions_reads_`Fig_1.`_captions
  Scenario: declaredFigureCaptions reads "Fig 1." captions
    Given page-011.md with an in-text "(Fig. 1)" reference and the caption "Fig 1. Public health supply chain partners and processes"
    And page-014.md with the caption "Fig 4. The stepwise approach used in this handbook" and the line "Fighting stock-outs"
    When the declared figure captions are read
    Then figure "1" is "Public health supply chain partners and processes"
    And figure "4" is "The stepwise approach used in this handbook"
    And no other figure is found
