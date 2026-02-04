<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/ra/v0.1.0/ActorDefinition-FacilityRegistry.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/ra/v0.1.0/ActorDefinition-FacilityRegistry.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/ra/v0.1.0/ActorDefinition-FacilityRegistry.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/ra/v0.1.0/ActorDefinition-FacilityRegistry.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/ra/v0.1.0/ActorDefinition-FacilityRegistry.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/ra/v0.1.0/ActorDefinition-FacilityRegistry.html');
else 
  Redirect('http://smart.who.int/ra/v0.1.0/ActorDefinition-FacilityRegistry.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
