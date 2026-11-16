Instance: TrustNetworkAnchor
InstanceOf: $SGActor
Usage: #definition
* name = "Trust Network Anchor"
* title = "Trust Network Anchor"
* description = "Trust Anchor which receives and distributes PKI-material within a Trust Network"
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#system
// The API a Trust Network Anchor offers: the trust network gateway, published
// with this guide at openapi/ (smart-trust#146). A deployment of it is an
// mCSD Endpoint; this links the actor type to its API.
* reference = "http://smart.who.int/trust/openapi/openapi.json"

Instance: TrustNetworkParticipant
InstanceOf: $SGActor
Usage: #definition
* name = "Trust Network Participant"
* title = "Trust Network Participant"
* description = "Trust Network Participant which publishes and or receives PKI-material within a Trust Network"
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#system



Instance: Holder
InstanceOf: $SGActor
Usage: #definition
* name = "Holder"
* title = "Holder"
* description = "A Holder is an individual that has Verifiable Digtial Health Certificate in their possesion, received from an Issuer.  The Holder may choose to share the Verifiable Digital Health Certificate with a Receiver."
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#person

Instance: Issuer
InstanceOf: $SGActor
Usage: #definition
* name = "Issuer"
* title = "Issuer"
* description = "An Issuer a system authorized by a Trust Network Participant to generate Verifiable Digital Health Certificates which are provided to a Holder.   An Issuer is responsible for generating the content that is digitally signed within the Verifiable Digital Health Certificate.   In order to sign this content, an Issuer should either itself be a Document Signer or utilize a Document Signer service, as authorized by the jurisdicitonal policy."
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#system
* derivedFrom = Canonical(TrustNetworkParticipant)

Instance: Receiver
InstanceOf: $SGActor
Usage: #definition
* name = "Receiver"
* title = "Receiver"
* description = "A Reciever is a system authorized by a Trust Network Participant to receive from a Holder a Veritifable, verify and utilize the content within."
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#system
* derivedFrom = Canonical(TrustNetworkParticipant)

// Onboarding actors (owner, 2026-11-01, Q-OB-10 A). Each is named in the GDHCN
// Administrative and Operational Framework or the onboarding process page.

Instance: BusinessOwnerRepresentative
InstanceOf: $SGActor
Usage: #definition
* name = "BusinessOwnerRepresentative"
* title = "Business Owner Representative"
* description = "The Business Owner Representative of a GDHCN Participant, named in the Letter of Application (Framework IX). Sends the Statement of Interest and the Letter of Application, and may meet WHO in person to convey the Letter."
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#person

Instance: LegalRepresentative
InstanceOf: $SGActor
Usage: #definition
* name = "LegalRepresentative"
* title = "Legal Representative"
* description = "The Legal Representative of a GDHCN Participant, named in the Letter of Application (Framework IX). May meet WHO in person to convey the Letter, and receives notice of amendments (Framework XI.2)."
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#person

Instance: OfficialDelegate
InstanceOf: $SGActor
Usage: #definition
* name = "OfficialDelegate"
* title = "Official Delegate"
* description = "An official delegate of a GDHCN Participant at the World Health Assembly or another meeting of WHO's governing bodies, who may convey the Letter of Application in a face-to-face meeting (Framework IX)."
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#person

Instance: KeyMasterRepresentative
InstanceOf: $SGActor
Usage: #definition
* name = "KeyMasterRepresentative"
* title = "Key Master Representative"
* description = "The individual responsible for a GDHCN Participant's Public Key Infrastructure, including generating key pairs and managing the connections to the Trust Network Gateway (Letter of Application; Framework IX). Holds the GPG key named in the Letter."
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#person

Instance: TechnicalRepresentative
InstanceOf: $SGActor
Usage: #definition
* name = "TechnicalRepresentative"
* title = "Technical Representative"
* description = "The Technical Representative of a GDHCN Participant, named in the Letter of Application (Framework IX). Connects the Participant's systems to the Trust Network Gateway and runs the onboarding tests."
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#person

Instance: GDHCNSecretariat
InstanceOf: $SGActor
Usage: #definition
* name = "GDHCNSecretariat"
* title = "GDHCN Secretariat"
* description = "Authorized WHO staff working in the GDHCN Secretariat, which administers the GDHCN and oversees the Onboarding Process (Framework V, VI)."
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#person

Instance: WHOCountryRepresentative
InstanceOf: $SGActor
Usage: #definition
* name = "WHOCountryRepresentative"
* title = "WHO Country Representative"
* description = "The WHO Country Representative, or the WHO Country Office, who may meet a GDHCN Participant's representative in person and send the Letter of Application by diplomatic pouch to WHO Headquarters (Framework IX)."
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#person

Instance: OperationsTeam
InstanceOf: $SGActor
Usage: #definition
* name = "OperationsTeam"
* title = "Operations Team"
* description = "The operations team of the Trust Network Gateway's service provider, which registers a Participant's key material and verifies its pull requests (onboarding steps [30]-[50])."
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#person

Instance: OnboardingTeam
InstanceOf: $SGActor
Usage: #definition
* name = "OnboardingTeam"
* title = "Onboarding Team"
* description = "The onboarding team of the Trust Network Gateway's service provider, which checks a Participant's test results and confirms production readiness (onboarding steps [64]-[77])."
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#person

Instance: GitHubBot
InstanceOf: $SGActor
Usage: #definition
* name = "GitHubBot"
* title = "GitHub Bot"
* description = "The GitHub bot user of the Trust Network Gateway (one per environment), which is invited to a Participant's private repository, pulls its public key material and opens the onboarding pull request (onboarding steps [11]-[13], [34]-[38])."
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#system

Instance: TrustNetworkGateway
InstanceOf: $SGActor
Usage: #definition
* name = "TrustNetworkGateway"
* title = "Trust Network Gateway"
* description = "The Trust Network Gateway through which the GDHCN is operationalized (Framework V.1). It whitelists a Participant's certificates and accepts its connections."
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#system
