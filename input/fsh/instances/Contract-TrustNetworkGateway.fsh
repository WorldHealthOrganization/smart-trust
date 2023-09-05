
//perahps this should really be in smart-core

Alias: $TrustNetworkGatewayContracts = http://worldhealthorganization.github.io/smart-trust/ValueSet/TrustNetworkGatewayContracts


Profile:        TrustNetworkGatewayContract
Parent:         Contract
Id:             TrustNetworkGatewayContract
Title:          "TNG Trusted Service"
Description:    """representation of relationship established in a TNG Trusted Service between actors within a Trust Domain 

Should have a mCSD-compliant Jursidcition Organization as subject at at least one authority

"""


* subject only Reference(MCSDJurisdictionOrganization) 
* authority only Reference(MCSDJurisdictionOrganization)
* authority 1.. MS
* type from $TrustNetworkGatewayContracts (extensible)



