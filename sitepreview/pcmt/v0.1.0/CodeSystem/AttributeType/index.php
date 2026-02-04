<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt/v0.1.0/CodeSystem-AttributeType.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt/v0.1.0/CodeSystem-AttributeType.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt/v0.1.0/CodeSystem-AttributeType.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt/v0.1.0/CodeSystem-AttributeType.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt/v0.1.0/CodeSystem-AttributeType.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt/v0.1.0/CodeSystem-AttributeType.html');
else 
  Redirect('http://smart.who.int/pcmt/v0.1.0/CodeSystem-AttributeType.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
