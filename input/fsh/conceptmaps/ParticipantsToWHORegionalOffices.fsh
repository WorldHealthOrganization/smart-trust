Instance:       ParticipantsToWHORegionalOffices
InstanceOf:     ConceptMap
Usage:          #definition
Title:          "GDHCN Participants to WHO Regional Offices"
Description:    """
ConceptMap from GDHCN Trust Network Production Participants to WHO Regional Offices.
Participants that are not WHO Member States or State Parties (e.g. international organizations
or non-member territories) have no mapping and are grouped under Other Participants.
"""

* name = "ParticipantsToWHORegionalOffices"
* status = #active
* experimental = true
* sourceScopeCanonical = Canonical(Participants)
* targetScopeCanonical = Canonical(WHORegionalOffices)

// ── AFRO ──────────────────────────────────────────────────────────────────────
* group[+]
  * source = "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY"
  * target = "http://smart.who.int/trust/CodeSystem/WHORegionalOffices"
  * element[+]
    * code = #BEN
    * display = "Benin"
    * target[+]
      * code = #AFRO
      * relationship = #related-to
  * element[+]
    * code = #TGO
    * display = "Togo"
    * target[+]
      * code = #AFRO
      * relationship = #related-to

// ── AMRO ──────────────────────────────────────────────────────────────────────
* group[+]
  * source = "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY"
  * target = "http://smart.who.int/trust/CodeSystem/WHORegionalOffices"
  * element[+]
    * code = #BRA
    * display = "Brazil"
    * target[+]
      * code = #AMRO
      * relationship = #related-to

// ── EMRO ──────────────────────────────────────────────────────────────────────
* group[+]
  * source = "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY"
  * target = "http://smart.who.int/trust/CodeSystem/WHORegionalOffices"
  * element[+]
    * code = #OMN
    * display = "Oman"
    * target[+]
      * code = #EMRO
      * relationship = #related-to

// ── EURO ──────────────────────────────────────────────────────────────────────
* group[+]
  * source = "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY"
  * target = "http://smart.who.int/trust/CodeSystem/WHORegionalOffices"
  * element[+]
    * code = #ALB
    * display = "Albania"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #AND
    * display = "Andorra"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #ARM
    * display = "Armenia"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #BEL
    * display = "Belgium"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #CYP
    * display = "Cyprus"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #CZE
    * display = "Czechia"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #EST
    * display = "Estonia"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #FIN
    * display = "Finland"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #FRA
    * display = "France"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #ISL
    * display = "Iceland"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #IRL
    * display = "Ireland"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #LVA
    * display = "Latvia"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #LTU
    * display = "Lithuania"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #MLT
    * display = "Malta"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #MCO
    * display = "Monaco"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #NLD
    * display = "Netherlands (Kingdom of the)"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #POL
    * display = "Poland"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #PRT
    * display = "Portugal"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #SMR
    * display = "San Marino"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #SVK
    * display = "Slovakia"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #SVN
    * display = "Slovenia"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #ESP
    * display = "Spain"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #SWE
    * display = "Sweden"
    * target[+]
      * code = #EURO
      * relationship = #related-to
  * element[+]
    * code = #TUR
    * display = "Türkiye"
    * target[+]
      * code = #EURO
      * relationship = #related-to

// ── SEARO ─────────────────────────────────────────────────────────────────────
* group[+]
  * source = "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY"
  * target = "http://smart.who.int/trust/CodeSystem/WHORegionalOffices"
  * element[+]
    * code = #IDN
    * display = "Indonesia"
    * target[+]
      * code = #SEARO
      * relationship = #related-to
  * element[+]
    * code = #THA
    * display = "Thailand"
    * target[+]
      * code = #SEARO
      * relationship = #related-to

// ── WPRO ──────────────────────────────────────────────────────────────────────
* group[+]
  * source = "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY"
  * target = "http://smart.who.int/trust/CodeSystem/WHORegionalOffices"
  * element[+]
    * code = #MYS
    * display = "Malaysia"
    * target[+]
      * code = #WPRO
      * relationship = #related-to
  * element[+]
    * code = #NZL
    * display = "New Zealand"
    * target[+]
      * code = #WPRO
      * relationship = #related-to
  * element[+]
    * code = #SGP
    * display = "Singapore"
    * target[+]
      * code = #WPRO
      * relationship = #related-to

// ── No mapping (Other Participants) ───────────────────────────────────────────
// FRO (Faroe Islands) - not a WHO Member State or State Party
// WHO - the WHO organization itself, not a Member State or State Party
