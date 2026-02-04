<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/Patient-2b90dd2b-2dab-4c75-9bb9-a355e07401e7.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/Patient-2b90dd2b-2dab-4c75-9bb9-a355e07401e7.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/Patient-2b90dd2b-2dab-4c75-9bb9-a355e07401e7.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/Patient-2b90dd2b-2dab-4c75-9bb9-a355e07401e7.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/Patient-2b90dd2b-2dab-4c75-9bb9-a355e07401e7.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/Patient-2b90dd2b-2dab-4c75-9bb9-a355e07401e7.html');
else 
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/Patient-2b90dd2b-2dab-4c75-9bb9-a355e07401e7.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
