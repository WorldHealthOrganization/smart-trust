// Owner, 2026-11-01 (Q-VC-3 A): drafted from the IPS Pilgrimage IG and marked
// "no annex yet", because the GDHCN Administrative and Operational Framework
// 1.2 has only Annex I (DDCC). The Hajj consents are this domain's terms of use.
Instance: TrustDomain-IPS-PILGRIMAGE
InstanceOf: TrustDomain
Title: "Trust Domain: IPS for Pilgrimage"
Description: "The IPS for Pilgrimage Trust Domain. No annex yet: the GDHCN Administrative and Operational Framework 1.2 has no annex for it, so this is drafted from the IPS Pilgrimage IG."
Usage: #example
* code = #IPS-PILGRIMAGE
* name = "IPS for Pilgrimage"
* description = "**No Framework annex yet.** The GDHCN Administrative and Operational Framework 1.2 defines only the DDCC Trust Domain (Annex I). This instance is drafted from the [IPS Pilgrimage IG](http://smart.who.int/ips-pilgrimage), where data exchange is mediated by the pilgrim on the basis of consent."
* useCase[0].title = "Issuance of a health document at the origin country"
* useCase[0].description = "A health check and counselling at origin, with the pilgrim's consent recorded, and a health link issued to the pilgrim."
* useCase[0].dakComponent[0].component = #generic-business-processes-and-workflows
* useCase[0].dakComponent[0].reference = "http://smart.who.int/ips-pilgrimage/business-processes.html"
* useCase[0].dakComponent[1].component = #user-scenarios
* useCase[0].dakComponent[1].reference = "http://smart.who.int/ips-pilgrimage/scenarios.html"
* useCase[1].title = "Clinical encounter for unplanned care"
* useCase[1].description = "Care during Hajj, in which the receiving facility retrieves the pilgrim's IPS through a health link."
* useCase[1].dakComponent[0].component = #generic-business-processes-and-workflows
* useCase[1].dakComponent[0].reference = "http://smart.who.int/ips-pilgrimage/business-processes.html"
* useCase[1].dakComponent[1].component = #user-scenarios
* useCase[1].dakComponent[1].reference = "http://smart.who.int/ips-pilgrimage/scenarios.html"
* technicalSpecification[0] = "http://smart.who.int/ips-pilgrimage"
* technicalSpecification[1] = "http://smart.who.int/trust-phw"
* policyStandard[0].text = "Data exchange is mediated by the pilgrim on the basis of consent, recorded as a Hajj consent (IPS.HAJJ.CONSENT) in the pilgrim's IPS (IPS Pilgrimage IG, trust domain policy)."
* termsOfUse.valueSet = "http://smart.who.int/ips-pilgrimage/ValueSet/IPS.HAJJ.CONSENT"
* termsOfUse.process[0] = "http://smart.who.int/ips-pilgrimage/business-processes.html"
* termsOfUse.process[1] = "http://smart.who.int/trust-phw/business-processes.html"
