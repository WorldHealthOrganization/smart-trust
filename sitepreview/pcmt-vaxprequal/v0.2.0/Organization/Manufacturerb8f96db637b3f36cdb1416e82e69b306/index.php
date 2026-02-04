<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Manufacturerb8f96db637b3f36cdb1416e82e69b306.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Manufacturerb8f96db637b3f36cdb1416e82e69b306.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Manufacturerb8f96db637b3f36cdb1416e82e69b306.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Manufacturerb8f96db637b3f36cdb1416e82e69b306.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Manufacturerb8f96db637b3f36cdb1416e82e69b306.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Manufacturerb8f96db637b3f36cdb1416e82e69b306.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Manufacturerb8f96db637b3f36cdb1416e82e69b306.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
