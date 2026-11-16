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
* sourceCanonical = Canonical(Participants)
* targetCanonical = Canonical(WHORegionalOffices)

// ── AFRO ──────────────────────────────────────────────────────────────────────
* group[+]
  * source = "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY"
  * target = "http://smart.who.int/trust/CodeSystem/WHORegionalOffices"
  * element[+]
    * code = #BEN
    * display = "Benin"
    * target[+]
      * code = #AFRO
      * equivalence = #relatedto
  * element[+]
    * code = #TGO
    * display = "Togo"
    * target[+]
      * code = #AFRO
      * equivalence = #relatedto

// ── AMRO ──────────────────────────────────────────────────────────────────────
* group[+]
  * source = "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY"
  * target = "http://smart.who.int/trust/CodeSystem/WHORegionalOffices"
  * element[+]
    * code = #BRA
    * display = "Brazil"
    * target[+]
      * code = #AMRO
      * equivalence = #relatedto

// ── EMRO ──────────────────────────────────────────────────────────────────────
* group[+]
  * source = "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY"
  * target = "http://smart.who.int/trust/CodeSystem/WHORegionalOffices"
  * element[+]
    * code = #OMN
    * display = "Oman"
    * target[+]
      * code = #EMRO
      * equivalence = #relatedto

// ── EURO ──────────────────────────────────────────────────────────────────────
* group[+]
  * source = "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY"
  * target = "http://smart.who.int/trust/CodeSystem/WHORegionalOffices"
  * element[+]
    * code = #ALB
    * display = "Albania"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #AND
    * display = "Andorra"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #ARM
    * display = "Armenia"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #BEL
    * display = "Belgium"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #CYP
    * display = "Cyprus"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #CZE
    * display = "Czechia"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #EST
    * display = "Estonia"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #FIN
    * display = "Finland"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #FRA
    * display = "France"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #ISL
    * display = "Iceland"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #IRL
    * display = "Ireland"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #LVA
    * display = "Latvia"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #LTU
    * display = "Lithuania"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #MLT
    * display = "Malta"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #MCO
    * display = "Monaco"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #NLD
    * display = "Netherlands (Kingdom of the)"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #POL
    * display = "Poland"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #PRT
    * display = "Portugal"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #SMR
    * display = "San Marino"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #SVK
    * display = "Slovakia"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #SVN
    * display = "Slovenia"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #ESP
    * display = "Spain"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #SWE
    * display = "Sweden"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto
  * element[+]
    * code = #TUR
    * display = "Türkiye"
    * target[+]
      * code = #EURO
      * equivalence = #relatedto

// ── SEARO ─────────────────────────────────────────────────────────────────────
* group[+]
  * source = "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY"
  * target = "http://smart.who.int/trust/CodeSystem/WHORegionalOffices"
  * element[+]
    * code = #IDN
    * display = "Indonesia"
    * target[+]
      * code = #SEARO
      * equivalence = #relatedto
  * element[+]
    * code = #THA
    * display = "Thailand"
    * target[+]
      * code = #SEARO
      * equivalence = #relatedto

// ── WPRO ──────────────────────────────────────────────────────────────────────
* group[+]
  * source = "http://smart.who.int/refmart/CodeSystems/REF_COUNTRY"
  * target = "http://smart.who.int/trust/CodeSystem/WHORegionalOffices"
  * element[+]
    * code = #MYS
    * display = "Malaysia"
    * target[+]
      * code = #WPRO
      * equivalence = #relatedto
  * element[+]
    * code = #NZL
    * display = "New Zealand"
    * target[+]
      * code = #WPRO
      * equivalence = #relatedto
  * element[+]
    * code = #SGP
    * display = "Singapore"
    * target[+]
      * code = #WPRO
      * equivalence = #relatedto

// ── No mapping (Other Participants) ───────────────────────────────────────────
// FRO (Faroe Islands) - not a WHO Member State or State Party
// WHO - the WHO organization itself, not a Member State or State Party
