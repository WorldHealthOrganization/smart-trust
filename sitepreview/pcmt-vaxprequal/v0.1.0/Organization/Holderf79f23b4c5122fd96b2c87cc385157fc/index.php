<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Organization-Holderf79f23b4c5122fd96b2c87cc385157fc.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Organization-Holderf79f23b4c5122fd96b2c87cc385157fc.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Organization-Holderf79f23b4c5122fd96b2c87cc385157fc.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Organization-Holderf79f23b4c5122fd96b2c87cc385157fc.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Organization-Holderf79f23b4c5122fd96b2c87cc385157fc.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Organization-Holderf79f23b4c5122fd96b2c87cc385157fc.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Organization-Holderf79f23b4c5122fd96b2c87cc385157fc.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
