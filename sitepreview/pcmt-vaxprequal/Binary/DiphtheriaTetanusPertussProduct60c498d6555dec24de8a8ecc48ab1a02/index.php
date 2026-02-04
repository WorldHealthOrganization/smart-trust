<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-DiphtheriaTetanusPertussProduct60c498d6555dec24de8a8ecc48ab1a02.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-DiphtheriaTetanusPertussProduct60c498d6555dec24de8a8ecc48ab1a02.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-DiphtheriaTetanusPertussProduct60c498d6555dec24de8a8ecc48ab1a02.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-DiphtheriaTetanusPertussProduct60c498d6555dec24de8a8ecc48ab1a02.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-DiphtheriaTetanusPertussProduct60c498d6555dec24de8a8ecc48ab1a02.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-DiphtheriaTetanusPertussProduct60c498d6555dec24de8a8ecc48ab1a02.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-DiphtheriaTetanusPertussProduct60c498d6555dec24de8a8ecc48ab1a02.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
