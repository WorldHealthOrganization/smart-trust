<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Observation-6e39ccf3-f997-4a2b-8f28-b4b71c778c79.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Observation-6e39ccf3-f997-4a2b-8f28-b4b71c778c79.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Observation-6e39ccf3-f997-4a2b-8f28-b4b71c778c79.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Observation-6e39ccf3-f997-4a2b-8f28-b4b71c778c79.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Observation-6e39ccf3-f997-4a2b-8f28-b4b71c778c79.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Observation-6e39ccf3-f997-4a2b-8f28-b4b71c778c79.html');
else 
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Observation-6e39ccf3-f997-4a2b-8f28-b4b71c778c79.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
