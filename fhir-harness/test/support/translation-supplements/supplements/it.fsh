// A supplement of a CodeSystem the IG does not define: SUSHI cannot resolve
// the canonical, so the check fails on SUSHI's own error.
CodeSystem: ShapeIt
Id: shape-it
Title: "Shape (it)"
Description: "Italian designations of a CodeSystem that is not here."
* ^content = #supplement
* ^supplements = Canonical(ShapeCS)
* ^language = #it
* #circle "Cerchio"
