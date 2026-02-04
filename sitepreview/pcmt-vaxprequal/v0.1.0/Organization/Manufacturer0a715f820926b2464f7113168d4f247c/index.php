<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Organization-Manufacturer0a715f820926b2464f7113168d4f247c.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Organization-Manufacturer0a715f820926b2464f7113168d4f247c.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Organization-Manufacturer0a715f820926b2464f7113168d4f247c.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Organization-Manufacturer0a715f820926b2464f7113168d4f247c.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Organization-Manufacturer0a715f820926b2464f7113168d4f247c.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Organization-Manufacturer0a715f820926b2464f7113168d4f247c.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Organization-Manufacturer0a715f820926b2464f7113168d4f247c.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
