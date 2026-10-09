<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('https://smart.who.int/trust/v1.7.1/Organization-GDHCNParticipant-XXA-UAT.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('https://smart.who.int/trust/v1.7.1/Organization-GDHCNParticipant-XXA-UAT.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('https://smart.who.int/trust/v1.7.1/Organization-GDHCNParticipant-XXA-UAT.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('https://smart.who.int/trust/v1.7.1/Organization-GDHCNParticipant-XXA-UAT.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('https://smart.who.int/trust/v1.7.1/Organization-GDHCNParticipant-XXA-UAT.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('https://smart.who.int/trust/v1.7.1/Organization-GDHCNParticipant-XXA-UAT.html');
else 
  Redirect('https://smart.who.int/trust/v1.7.1/Organization-GDHCNParticipant-XXA-UAT.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
