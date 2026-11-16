// The bad supplement, in a file named for Spanish: a code the base lacks, a
// ^language that is not the file's locale, and a designation in a third language.
CodeSystem: ColourEs
Id: colour-es
Title: "Colour (es)"
Description: "Spanish designations of the colours, with the mistakes the check catches."
* ^content = #supplement
* ^supplements = Canonical(ColourCS)
* ^language = #pt
* #red "Rojo"
* #red ^designation[0].language = #de
* #red ^designation[0].value = "Rot"
* #purple "Morado"
