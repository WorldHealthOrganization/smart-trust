<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-DiphtheriaTetanusPertussProduct344e3ef97d8fe6c7d58c108f82a18dfb.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-DiphtheriaTetanusPertussProduct344e3ef97d8fe6c7d58c108f82a18dfb.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-DiphtheriaTetanusPertussProduct344e3ef97d8fe6c7d58c108f82a18dfb.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-DiphtheriaTetanusPertussProduct344e3ef97d8fe6c7d58c108f82a18dfb.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-DiphtheriaTetanusPertussProduct344e3ef97d8fe6c7d58c108f82a18dfb.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-DiphtheriaTetanusPertussProduct344e3ef97d8fe6c7d58c108f82a18dfb.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-DiphtheriaTetanusPertussProduct344e3ef97d8fe6c7d58c108f82a18dfb.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
