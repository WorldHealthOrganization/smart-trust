Alias: $colour = http://example.org/fhir/translations/CodeSystem/colour

RuleSet: Draft
* ^status = #draft
* ^experimental = true

CodeSystem: ColourCS
Id: colour
Title: "Colour"
Description: "Three colours. A Profile: line inside a string is not an entity."
* insert Draft
* ^caseSensitive = true
* #red "Red"
* #green "Green"
* #blue "Blue"
  * #navy "Navy"

/*
Profile: NotAProfile
Parent: Patient
*/

ValueSet: ColourVS
Id: colour-vs
Title: "Colours"
Description: "Not compiled by the check: only CodeSystems, Aliases and RuleSets are."
* include codes from system $colour
