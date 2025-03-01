
Instance:   RequestVDHC
InstanceOf: SGRequirements
Usage: #definition
* name = "Request VDHC"
* experimental = true
* title = "Request Verifiable Digital Health Certificate"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Request a Verifiable Digital Health Certificate from an Issuer"
* actor[+] = Canonical(Holder)


Instance:   IssuerVDHC
InstanceOf: SGRequirements
Usage: #definition
* name = "Issue VDHC"
* experimental = true
* title = "Issue Verifiable Digital Health Certificate"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Issue a Verifiable Digital Health Certificate to a Holder"
* actor[+] = Canonical(Issuer)
* statement[+].key = "IssuerVDHC-generate"
* statement[=].label = "Generate Verifiable Digital Health Certificate"
* statement[=].requirement = "Generate the content that will be signed as part of a Verifiable Digital Health Certificate"
* statement[+].key = "IssuerVDHC-sign"
* statement[=].label = "Sign Verifiable Digital Health Certificate"
* statement[=].requirement = "Sign content to produce a Verifiable Digital Health Certificate."


Instance:   ReceiveVDHC
InstanceOf: SGRequirements
Usage: #definition
* name = "Receive VDHC"
* experimental = true
* title = "Receive Verifiable Digital Health Certificate"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Receive a Verifiable Digital Health Certificate from an Issuer"
* actor[+] = Canonical(Holder)

Instance:   ProvideVDHC
InstanceOf: SGRequirements
Usage: #definition
* name = "Provide VDHC"
* experimental = true
* title = "Provide Verifiable Digital Health Certificate"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Provide a Verifiable Digital Health Certificate to a Receiver"
* actor[+] = Canonical(Holder)



Instance:   UtilizeVDHC
InstanceOf: SGRequirements
Usage: #definition
* name = "Utilize VDHC"
* experimental = true
* title = "Utilize a Verifiable Digital Health Certificate"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Utilize a Verifiable Digital Health Certificate that was provided by a Holder"
* actor[+] = Canonical(Receiver)
* statement[+].key = "UtilizeVDHC-reveive"
* statement[=].label = "Ingest VDHC"
* statement[=].requirement = "A user of a Receiver system receives a Verfiable Digital Health Certificate from a Holder. The user ingests the Verifiable Digital Health Certificate into the Receiver system.  The means of conveyance and how the Verifiable Digital Health Certificate is rendered is depedent on the use context."
* statement[+].key = "UtilizeVDHC-retreive-keys"
* statement[=].label = "Retrieve matching keys"
* statement[=].requirement = "Retrieve and/or filter from an apporopriate PKI material distribution endpoint the set of public keys that match the key identifier (kid), trust domain code, participant code, and/or key usage code as applicable to the context of use of the Verfiable Digital Health Certificate."
* statement[+].key = "UtilizeVDHC-validate-hash"
* statement[=].label = "Compute Hash"
* statement[=].requirement = "As appropriate  to the content type of the Verfiable Digtial Health Certificate, compute the hash of the content, and use the retrieved public keys(s) to try to verify the signature against the hashed value."
* statement[+].key = "UtilizeVDHC-display-verified-content"
* statement[=].label = "Display verified content"
* statement[=].requirement = "Display verified cotent to the user of the Reciever system."
* statement[+].key = "UtilizeVDHC-execute-business-rule"
* statement[=].label = "Execute business rules"
* statement[=].requirement = "Execute zero or more business rules against the Verifiable Digital Health Certificate that was provided by a Holder.  Results of the execution of the business rules are displayed to the user of the Receiver system."


Instance:   PublishBusinessRules
InstanceOf: SGRequirements
Usage: #definition
* name = "Publish Rules"
* experimental = true
* title = "Publish business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Publish business rules to a Trust Anchor"
* actor[+] = Canonical(Issuer)


Instance:   PublishBusinessRulesCertLogic
InstanceOf: SGRequirements
Usage: #definition
* name = "Publish CertLogic Business Rules"
* experimental = true
* title = "Publish Cert Logic business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Publish Cert Logic business rules to a Trust Anchor"
* actor[+] = Canonical(Issuer)
* extension[satisfies].valueReference = Reference(PublishBusinessRules)

Instance:   PublishBusinessRulesFHIR
InstanceOf: SGRequirements
Usage: #definition
* name = "Publish FHIR Business Rules"
* experimental = true
* title = "Publish HL7 FHIR business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Publish business rules to a Trust Anchor using HL7 FHIR"
* actor[+] = Canonical(Issuer)
* extension[satisfies].valueReference = Reference(PublishBusinessRules)



Instance:   ReceiveBusinessRules
InstanceOf: SGRequirements
Usage: #definition
* name = "Receive Business Rules"
* experimental = true
* title = "Receive business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Receive business rules from a Trust Network Participant, for distribution within the Trust Network"
* actor[+] = Canonical(TrustNetworkAnchor)

Instance:   ReceiveBusinessRulesCertLogic
InstanceOf: SGRequirements
Usage: #definition
* name = "Receive CertLogic Business Rules"
* experimental = true
* title = "Receive CertLogic business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Receive CertLogic business rules from a Trust Network Participant, for distribution within the Trust Network"
* actor[+] = Canonical(TrustNetworkAnchor)
* extension[satisfies].valueReference = Reference(ReceiveBusinessRules)

Instance:   ReceiveBusinessRulesFHIR
InstanceOf: SGRequirements
Usage: #definition
* name = "Receive FHIR Business Rules"
* experimental = true
* title = "Receive HL7 FHIR business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Receive business rules from a Trust Network Participant, for distribution within the Trust Network using HL7 FHIR standard"
* actor[+] = Canonical(TrustNetworkAnchor)
* extension[satisfies].valueReference = Reference(ReceiveBusinessRules)




Instance:   DistributeBusinessRules
InstanceOf: SGRequirements
Usage: #definition
* name = "Distribute Business Rules"
* experimental = true
* title = "Distribute business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Make received business rules available through a distrubution point to a Receiver"
* actor[+] = Canonical(TrustNetworkAnchor)

Instance:   DistributeBusinessRulesCertLogic
InstanceOf: SGRequirements
Usage: #definition
* name = "Distribute CertLogic Business Rules"
* experimental = true
* title = "Distribute CertLogic business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Make received CertLoigc business rules available through a distrubution point to a Receiver"
* actor[+] = Canonical(TrustNetworkAnchor)
* extension[satisfies].valueReference = Reference(DistributeBusinessRules)

Instance:   DistributeBusinessRulesFHIR
InstanceOf: SGRequirements
Usage: #definition
* name = "Distribute FHIR Business Rules"
* experimental = true
* title = "Distribute FHIR business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Make received business rules available through a distrubution point to a Receiver through HL7 FHIR standards"
* actor[+] = Canonical(TrustNetworkAnchor)
* extension[satisfies].valueReference = Reference(DistributeBusinessRules)




Instance:   RetrieveBusinessRules
InstanceOf: SGRequirements
Usage: #definition
* name = "Retrieve Business Rules"
* experimental = true
* title = "Retrieve business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Retrieve business rules from a distribution point using"
* actor[+] = Canonical(Receiver)
* extension[satisfies].valueReference = Reference(RetrieveBusinessRules)

Instance:   RetrieveBusinessRulesCertLogic
InstanceOf: SGRequirements
Usage: #definition
* name = "Retrieve CertLogic Business Rules"
* experimental = true
* title = "Retrieve Cert Logic compatible business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Retrieve Cert Logic business rules from a distribution point "
* actor[+] = Canonical(Receiver)
* extension[satisfies].valueReference = Reference(RetrieveBusinessRules)

Instance:   RetrieveBusinessRulesFHIR
InstanceOf: SGRequirements
Usage: #definition
* name = "Retrieve FHIR Business Rules"
* experimental = true
* title = "Retrieve HL7 FHIR compatible business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Retrieve business rules from a distribution point using HL7 FHIR standards"
* actor[+] = Canonical(Receiver)
* extension[satisfies].valueReference = Reference(RetrieveBusinessRules)





Instance:   PublishPKIMaterial
InstanceOf: SGRequirements
Usage: #definition
* name = "Publish Public Keys"
* experimental = true
* title = "Publish PKI material"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Publish trust material to a Trust Anchor"
* actor[+] = Canonical(TrustNetworkParticipant)

Instance:   PublishPKIMaterialAPI
InstanceOf: SGRequirements
Usage: #definition
* name = "Publish Public Keys via API"
* experimental = true
* title = "Publish PKI material via API"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Publish trust material to a Trust Anchor via API"
* actor[+] = Canonical(TrustNetworkParticipant)
* extension[satisfies].valueReference = Reference(PublishPKIMaterial)

Instance:   PublishPKIMaterialDID
InstanceOf: SGRequirements
Usage: #definition
* name = "Publish Public Keys as DID"
* experimental = true
* title = "Publish PKI material as DID"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Publish trust material to a Trust Anchor as DID"
* actor[+] = Canonical(TrustNetworkParticipant)
* extension[satisfies].valueReference = Reference(PublishPKIMaterial)

Instance:   ReceivePKUMaterial
InstanceOf: SGRequirements
Usage: #definition
* name = "Receive Public Keys"
* experimental = true
* title = "Receive PKI material"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Receive trust material from a Trust Network Participant, for distribution within the Trust Network"
* actor[+] = Canonical(TrustNetworkAnchor)

Instance:   ReceivePKUMaterialAPI
InstanceOf: SGRequirements
Usage: #definition
* name = "Receive Public Keys via API"
* experimental = true
* title = "Receive PKI material via API"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Receive trust material from a Trust Network Participant, for distribution within the Trust Network via API"
* actor[+] = Canonical(TrustNetworkAnchor)
* extension[satisfies].valueReference = Reference(ReceivePKUMaterial)

Instance:   ReceivePKUMaterialDID
InstanceOf: SGRequirements
Usage: #definition
* name = "Receive Public Keys as DID"
* experimental = true
* title = "Receive PKI material as DID"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Receive trust material from a Trust Network Participant, for distribution within the Trust Network as DID"
* actor[+] = Canonical(TrustNetworkAnchor)
* extension[satisfies].valueReference = Reference(ReceivePKUMaterial)


Instance:   DistributePKIMaterial
InstanceOf: SGRequirements
Usage: #definition
* name = "Distribute Public Keys"
* experimental = true
* title = "Distribute PKI material"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Make received trust material available through a distrubution point to a Trust Network Participant"
* actor[+] = Canonical(TrustNetworkAnchor)

Instance:   DistributePKIMaterialAPI
InstanceOf: SGRequirements
Usage: #definition
* name = "Distribute Public Keys via API"
* experimental = true
* title = "Distribute PKI material via API"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Make received trust material available through a distrubution point to a Trust Network Participant via API"
* actor[+] = Canonical(TrustNetworkAnchor)
* extension[satisfies].valueReference = Reference(DistributePKIMaterial)

Instance:   DistributePKIMaterialDID
InstanceOf: SGRequirements
Usage: #definition
* name = "Distribute Public Keys as DID" 
* experimental = true
* title = "Distribute PKI material as DID"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Make received trust material available through a distrubution point to a Trust Network Participant as DID"
* actor[+] = Canonical(TrustNetworkAnchor)
* extension[satisfies].valueReference = Reference(DistributePKIMaterial)

Instance:   RetrievePKIMaterial
InstanceOf: SGRequirements
Usage: #definition
* name = "Retrieve Public Keys"
* experimental = true
* title = "Retrieve PKI material"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Retrieve PKI material from a distribution point"
* actor[+] = Canonical(TrustNetworkParticipant)
* actor[+] = Canonical(TrustNetworkAnchor)

Instance:   RetrievePKIMaterialAPI
InstanceOf: SGRequirements
Usage: #definition
* name = "Retrieve Public Keys via API"
* experimental = true
* title = "Retrieve PKI material via API"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Retrieve PKI material from a distribution point via API"
* actor[+] = Canonical(TrustNetworkParticipant)
* actor[+] = Canonical(TrustNetworkAnchor)
* extension[satisfies].valueReference = Reference(RetrievePKIMaterial)

Instance:   RetrievePKIMaterialDID
InstanceOf: SGRequirements
Usage: #definition
* name = "Retrieve Public Keys as DID"
* experimental = true
* title = "Retrieve PKI material as DID"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Retrieve PKI material from a distribution point as DID"
* actor[+] = Canonical(TrustNetworkParticipant)
* actor[+] = Canonical(TrustNetworkAnchor)
* extension[satisfies].valueReference = Reference(RetrievePKIMaterial)
 
