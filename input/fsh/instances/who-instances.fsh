Instance: GDHCNParticipant-WHO
InstanceOf: IHE.mCSD.Organization
Usage: #definition
* name = "WHO"
* type = $orgType#govt


Instance: GDHCNParticipantDID-WHO
InstanceOf: IHE.mCSD.Endpoint
Usage: #definition
* name = "WHO Trust List (DID v2) "
// * description = "WHO Trust List (DID v2) production environment"
* managingOrganization = Reference(Organization/GDHCNParticipant-WHO)
* status = #active
* connectionType = $ConnectionTypes#http-get
* payloadMimeType = #application/did
* payloadType = $PayloadTypes#urn:who:trust:trustlist:v2
* address = "http://tng-cdn.who.int/v2/trustlist/-/WHO/did.json"


Instance: GDHCNParticipantDID-WHO-UAT
InstanceOf: IHE.mCSD.Endpoint
Usage: #definition
* name = "WHO Trust List (DID v2) - UAT "
// * description = "WHO Trust List (DID v2) User-Acceptance-Testing (UAT) environment"
* managingOrganization = Reference(Organization/GDHCNParticipant-WHO)
* status = #active
* connectionType = $ConnectionTypes#http-get
* payloadMimeType = #application/did
* payloadType = $PayloadTypes#urn:who:trust:trustlist:v2
* address = "http://tng-cdn-uat.who.int/v2/trustlist/-/WHO/did.json"

Instance: GDHCNParticipantDID-WHO-DEV
InstanceOf: IHE.mCSD.Endpoint
Usage: #definition
* name = "WHO Trust List (DID v2) - DEV "
// * description = "WHO Trust List (DID v2) Development (DEV) environment"
* managingOrganization = Reference(Organization/GDHCNParticipant-WHO)
* status = #active
* connectionType = $ConnectionTypes#http-get
* payloadMimeType = #application/did
* payloadType = $PayloadTypes#urn:who:trust:trustlist:v2
* address = "http://tng-cdn-dev.who.int/v2/trustlist/-/WHO/did.json"
