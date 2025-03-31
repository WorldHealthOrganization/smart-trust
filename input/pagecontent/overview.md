
### Summary
  
  
<a name="scope">  </a>


    
#### Overview
<a name="Overview"> </a>

    
<p>
      This guide describes the specifications and on-boarding procedures for WHO's Global Digital Health Certification Network (GDHCN).  The GDHCN is a mechanism to support verification of health documents and certifications that are exchanged between participants of the GDHCN.  These health certifications may include COVID-19 certificates, routine immunization cards, and home-based records consistent with International Patient Summary standards. This mechanism provides means of harmonizing global health protocol standards and establishing a system for recognition of digital certificates for continuity of care and at point of entry.  The GDHCN is designed to leverage existing investments by jurisdictions that were made under the COVID-19 response and provide the digital health infrastructure needed for resiliency in future epidemic and pandemic responses.
    </p>


    
<p>
      The GDHCN is a digital reflection of the trust WHO already has with Member States. The GDHCN is a digital trust network is based on proven <a href="concepts.html"> concepts</a> which are used to describe the specifications and mechanisms for establishing trust, which allow eligible participants to establish new <a href="concepts.html#trust-domain">trust domains</a> for exchange of verifiable digital health records. Eligible participants of the trust network may apply to join by following an <a href="concepts_onboarding.html">on-boarding process</a>.   The GDHCN is operated under the <a href="GDHCN_Administrative_and_Operational_Framework.pdf">GDHCN Administrative and Operational Framework</a>.
    </p>

    
{% include img.html img="trust_network.png" caption="Trust Network" width="70%" %}    

    
#### Background &amp; Purpose
<a name="Background"> </a>
    
    
<p>
      In response to COVID-19, Governments and organizations across the world have developed and adopted standards and technologies to create, present, and verify digital vaccination and test credentials. However, a global technical framework to enable convenient use and interoperability of these credentials between systems – while also allowing domestic autonomy over their use – does not exist yet and is critically needed.      
    </p>

    
<p>
      The WHO Global Digital Health Certification Network is a collection of components that are used to verify interoperable digital health documents or certificates.  This system of comprised of three main features:
    </p>

    
<ul>
      <li>A collection of well defined digital health documents that are issued and verified by members of the GDHCN </li>
      <li>A Public Key Infrastructure (PKI) that is used for the publishing and distribution of public keys used for verification of digital signatures of the digital health documents.
      </li>

      <li>A Knowledge Library used to maintain metadata including terminology codings, product codes and business rules that are used to provide semantic interoperability of these digital health documents</li>

    </ul>

    
    
<p>In addition to verifying and validating COVID-19 certificates, a global digital health trust network such as the GDHCN can:</p>

    
<ul class="">
        <li>Establish trust of digitally signed clinical algorithms published by WHO through the SMART Guidelines work.</li>
        <li>Allow for a global product catalogue of trusted medical products and devices.</li>
        <li>Ensure information about a patient can be accessed and trusted regardless of one is in the world.</li>
        <li>Support health systems resiliency to address future outbreaks in a world.</li>
        <li>Empower individuals to manage their own health and well-being.</li>
    </ul>


    
<p>The interoperable exchange of health information in a trusted environment is a complex task with an increasingly large number of stakeholders (e.g. public health agencies, accredited labs, border control organizations, institutions authorized to verify) that need to ensure that data is transferred safely and securely, that the health content is interoperable, and that information is understandable and actionable. This guide details how to utilize a global technical framework to allow interoperability of health credentials between
systems, while preserving domestic autonomy over their use. </p>


    
<p>Achieving global interoperability of health certificates does not require that all jurisdictions use the same standard. Interoperability can also be achieved when there are pre-arranged mechanisms in place so that certificates issued by one jurisdiction are accepted in another. A number of services and technical artifacts have been developed to address particular criteria for establishing interoperability and a system of trust including:</p>

    
<ul class="">
        <li>Data models, transformations and vocabulary definitions that allow exchange of health data between various standards formats, preserving a jurisdiction's autonomy regarding domestic processes while allowing re-issuance and mutual recognition of credentials between jurisdictions</li>
        <li>Standard specifications for exchanging public keys between various networks for verifying digital signatures on health credentials</li>
        <li>A global trust registry and federated public key infrastructure solution that provides technical interoperability and technical governance between regional trust networks</li>
        <li>Workflows for creating, sharing and executing business rules that evaluate public health policies against health data for cross-border or port of entry requirements</li>
        <li>Open source tools and technical guidance to reduce the burden of implementing the technical infrastructure to participate in the federated trust network, including open source trust network infrastructure for jurisdictions to implement their own regional trust networks</li>
    </ul>

    
#### Audience
<a name="Audience"> </a>

    
<p>This guide describes expected workflows for potential actors in a trust ecosystem, namely:</p>

    
<ul class="">
        <li>Issuers that provide verifiable health credentials to individuals,</li>
        <li>Verifiers that consume verifiable health credentials provided by individuals, and</li>
        <li>Trust Networks that establish trust relationships and policies between issuers and verifiers.</li>
    </ul>

    
<p>The audience for this guide includes decision makers, analysts and technical assets at potential individual issuers,
existing trust networks or potential verifiers who may participate in the federated trust network. Stakeholders include Member States, regional networks, and standards development organizations.</p>





  
#### Participants
 
<a name="participants"> </a>

<div style="display:block">
  ![Latest Status](./Participant_Onboarding_Status.jpg){:width="850em"}
</div>

  
<br/>


  
#### Available Trust Domains


<p>The codes for the GDHCN Trust Domains are contained in the <a href="ValueSet-WHO.TRUST.DOMAIN.html">GDHCN Trust Domain Value Set</a>.
  </p>
<a href="ValueSet-WHO.TRUST.DOMAIN.html">GDHCN Trust Domain Value Set</a>
  
  
#### Ethical Considerations and Data Protection Principles

  
<p>As with any digital solution, there are ethical considerations, such as potential impacts on equity and on equitable access, and data protection principles that need to inform the design of the technical specifications, as well as provide guidance on how resulting solutions can be ethically implemented. The following <a href="ethical_principles.html">page</a> discusses some key ethical considerations and data protection principles that Member States are encouraged to – and, where they have legal obligations, must – include in their respective deployments of digital solutions. These ethical considerations and data protection principles have also informed the design criteria for WHO’s SMART Guidelines and for the utilization of the WHO’s Global Digital Health Certification Network. </p>

  
    
  
#### Providing Feedback
  
<a name="feedback"> </a>

  {% include feedback.md %}

  
#### Community
  
<a name="Community"/>


<p>Sign up on <a href="https://chat.fhir.org/">chat.fhir.org</a> community and follow the stream who-smart-guidelines for questions, queries and chats related to WHO SMART Guidelines</p>
<a href="https://chat.fhir.org/">chat.fhir.org</a>
<p>WHO also hosts weekly calls on authoring and implementing WHO SMART Guidelines where participation is welcome. Please send an email at <a href="mailto:gdhcn-support@who.int?subject = SMART Trust FHIR IG">gdhcn-support@who.int</a> in order to get invited.</p>
<a href="mailto:gdhcn-support@who.int?subject = SMART Trust FHIR IG">gdhcn-support@who.int</a>
