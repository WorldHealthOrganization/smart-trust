<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-DiphtheriaTetanusPertussProduct4e2900c73c70158b90a240513998895d.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-DiphtheriaTetanusPertussProduct4e2900c73c70158b90a240513998895d.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-DiphtheriaTetanusPertussProduct4e2900c73c70158b90a240513998895d.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-DiphtheriaTetanusPertussProduct4e2900c73c70158b90a240513998895d.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-DiphtheriaTetanusPertussProduct4e2900c73c70158b90a240513998895d.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-DiphtheriaTetanusPertussProduct4e2900c73c70158b90a240513998895d.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-DiphtheriaTetanusPertussProduct4e2900c73c70158b90a240513998895d.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
