<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/Organization-45a5c5b1-4ec1-4d60-b4b2-ff5a84a41fd6.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/Organization-45a5c5b1-4ec1-4d60-b4b2-ff5a84a41fd6.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/Organization-45a5c5b1-4ec1-4d60-b4b2-ff5a84a41fd6.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/Organization-45a5c5b1-4ec1-4d60-b4b2-ff5a84a41fd6.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/Organization-45a5c5b1-4ec1-4d60-b4b2-ff5a84a41fd6.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/Organization-45a5c5b1-4ec1-4d60-b4b2-ff5a84a41fd6.html');
else 
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/Organization-45a5c5b1-4ec1-4d60-b4b2-ff5a84a41fd6.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
