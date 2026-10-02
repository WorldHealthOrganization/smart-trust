<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/trust/1.2.0/Requirements-ReceiveBusinessRulesCertLogic.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/trust/1.2.0/Requirements-ReceiveBusinessRulesCertLogic.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/trust/1.2.0/Requirements-ReceiveBusinessRulesCertLogic.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/trust/1.2.0/Requirements-ReceiveBusinessRulesCertLogic.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/trust/1.2.0/Requirements-ReceiveBusinessRulesCertLogic.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/trust/1.2.0/Requirements-ReceiveBusinessRulesCertLogic.html');
else 
  Redirect('http://smart.who.int/trust/1.2.0/Requirements-ReceiveBusinessRulesCertLogic.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
