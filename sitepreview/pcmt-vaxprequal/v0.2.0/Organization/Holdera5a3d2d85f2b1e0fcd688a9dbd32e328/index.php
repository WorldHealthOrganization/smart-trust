<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Holdera5a3d2d85f2b1e0fcd688a9dbd32e328.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Holdera5a3d2d85f2b1e0fcd688a9dbd32e328.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Holdera5a3d2d85f2b1e0fcd688a9dbd32e328.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Holdera5a3d2d85f2b1e0fcd688a9dbd32e328.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Holdera5a3d2d85f2b1e0fcd688a9dbd32e328.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Holdera5a3d2d85f2b1e0fcd688a9dbd32e328.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Holdera5a3d2d85f2b1e0fcd688a9dbd32e328.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
