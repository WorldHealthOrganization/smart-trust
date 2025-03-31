
 

  
<h3>Trust Network Specifications</h3>
 
<a name="trust-specfications"> </a>


  
  
<h4>EU DCC </h4>

  
<ul>
    <li><a href="https://ec.europa.eu/health/sites/health/files/ehealth/docs/trust-framework_interoperability_certificates_en.pdf">Interoperability of health certificates – Trust Framework – v. 1.0 – 12.03.2021 – eHealth Network</a>  - last accessed 27.04.2021</li>
    <li><a href="https://ec.europa.eu/health/sites/health/files/ehealth/docs/digital-green-certificates_v1_en.pdf">Technical Specifications for Digital COVID Certificates Volume 1 V1.0.5  - eHealth Network</a> - last accessed 27.04.2021</li>
    <li><a href="https://www.etsi.org/deliver/etsi_en/319100_319199/31910201/01.01.01_60/en_31910201v010101p.pdf">ETSI EN 319 102-1: Electronic Signatures and Infrastructures (ESI); Procedures for Creation and Validation of AdES Digital Signatures; Part 1: Creation and Validation – version 1.1.1, 2016</a>  – last accessed 23.04.2021</li>
    <li><a href="https://health.ec.europa.eu/publications/technical-specifications-eu-digital-covid-certificates-volumes-1-5_en">Technical specifications for EU Digital COVID Certificates - Volumes 1-5 </a> </li>
    <li><a href="https://health.ec.europa.eu/system/files/2022-02/digital-covid-certificates_v1_en.pdf">Volume 1: Formats and trust management available at  references "Implementing Decision (EU) 2021/1073, Annex I"</a></li>
    <li><a href="https://eur-lex.europa.eu/legal-content/EN/TXT/uri=uriserv%3AOJ.L_.2021.230.01.0032.01.ENG)">Implementing Decision (EU) 2021/1073, Annex I can be found at , along with other relevant Annexes.</a></li>
  </ul>


  
<h4> DIVOC </h4>

  
<ul>
    <li>Elements are defined by JSON-LD. As of 2023-02-12, the most current <a href="https://github.com/egovernments/DIVOC/blob/icmr/vaccination-context/vaccination-context.js">JSON-LD context for vaccines</a> and for <a href="https://github.com/egovernments/DIVOC/blob/icmr/test-certificate-context/test-certificate-context.js">test results</a> is here . Note that the URIs for the DIVOC-specific JSON-LD contexts embedded in the certificates do not resolve.</li>
    <li> DIVOC's <a href="https://divoc.digit.org">documentation</a> is here  but this does not include element-level descriptions (e.g., terminology bindings at a per-element level).</li>
    <li> Terminology bindings at the element level must be inferred from more <a href="https://divoc.digit.org/platform/divocs-verifiable-certificate-features/what-information-goes-into-a-qr-code">general documentation</a>.  The `v2` JSON-LD context introduces the `evidence.icd11Code` element for vaccines, but there is no documentation on which codes this element is bound to or whether this is used in production. There is no other computable representation of vaccine type/product.</li>
  </ul>


  
<h4>ICAO </h4>

  
<ul>
    <li> ICAO <a href="https://www.icao.int/vdsnc-spec">VDS NC</a></li>
  </ul>


  
<h4>SMART Health Cards </h4>

  
<ul>
    <li>General SMART Health Card <a href="https://spec.smarthealth.cards">specification</a> </li>
    <li>COVID-19 <a href="http://build.fhir.org/ig/HL7/fhir-shc-vaccination-ig">vaccine and testing-specific specification</a> </li>
  </ul>

    

  
  
<h4>WHO SMART Guideline Development </h4>
  
<a name="smart-guidelines"> </a>

  
<ul>
    <li>WHO <a href="https://www.who.int/teams/digital-health-and-innovation/smart-guidelines">SMART Guidelines</a> overviews the SMART Guidelines approach</li>
    <li>WHO <a href="https://www.who.int/publications/i/item/9789241548960">Handbook for guideline development</a> provides an overview of the WHO guideline development and publication process</li>
  </ul>



  
