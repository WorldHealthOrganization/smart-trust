<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-RubellaProduct0bb48b4861045ee347f5539609d92bbd.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-RubellaProduct0bb48b4861045ee347f5539609d92bbd.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-RubellaProduct0bb48b4861045ee347f5539609d92bbd.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-RubellaProduct0bb48b4861045ee347f5539609d92bbd.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-RubellaProduct0bb48b4861045ee347f5539609d92bbd.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-RubellaProduct0bb48b4861045ee347f5539609d92bbd.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-RubellaProduct0bb48b4861045ee347f5539609d92bbd.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
