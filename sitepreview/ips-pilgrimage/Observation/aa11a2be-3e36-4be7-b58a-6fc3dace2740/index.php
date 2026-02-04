<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Observation-aa11a2be-3e36-4be7-b58a-6fc3dace2740.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Observation-aa11a2be-3e36-4be7-b58a-6fc3dace2740.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Observation-aa11a2be-3e36-4be7-b58a-6fc3dace2740.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Observation-aa11a2be-3e36-4be7-b58a-6fc3dace2740.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Observation-aa11a2be-3e36-4be7-b58a-6fc3dace2740.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Observation-aa11a2be-3e36-4be7-b58a-6fc3dace2740.html');
else 
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Observation-aa11a2be-3e36-4be7-b58a-6fc3dace2740.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
