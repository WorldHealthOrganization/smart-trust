//probably should be in smart-core

Alias: $TNGContracts = http://worldhealthorganization.github.io/smart-trust/TrustNetworkGatewayContracts
CodeSystem: TrustNetworkGatewayContracts
Id: TrustNetworkGatewayContracts
Title: "Trust Domains for WHO's GDHCN"
Description: "List of codes to describe the Trust Domains defined by WHO's Global Digital Health Certification Network (GDHCN).  Each  "
* ^url = $TNGContracts


//SMART Core
* #"MCSD" "Trusted Services for health facility, organization, health worker and service infofmation following IHE mCSD profile"
* #"SVCM" "Trusted Services for terminology service infofmation following IHE SVCM profile"
* #"PCMT" "Trusted Services for WHO Product Catalogue Management Tool"


//SMART Trust Network Gateway and Trust Domains
* #"TNG" "Trusted Services for Verifiable Digial Health Certificates for WHO Global Digital Health Certification Network"
* #"TNG-PKI-DID" "Trusted Services for retrieval of DID document containg Public Key Material of the Trust Network Gateway"
* #"TNG-PKI-EU-DCC" "Trusted Services for management of PKI following EU-DCC specification for the Trust Network Gateway"
* #"TNG-BR" "Trust Services for executable busines rules that operate on Verifiable Digital Health Certificates"   


//SMART Guidelines
* #"SG-IMM" "Trusted Services for Immununzation SMART Guidelines domain"
* #"SG-OT" "Trusted Services for Outbreak Toolkit domain"



