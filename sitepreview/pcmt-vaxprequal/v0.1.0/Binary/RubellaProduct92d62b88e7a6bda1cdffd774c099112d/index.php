<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-RubellaProduct92d62b88e7a6bda1cdffd774c099112d.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-RubellaProduct92d62b88e7a6bda1cdffd774c099112d.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-RubellaProduct92d62b88e7a6bda1cdffd774c099112d.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-RubellaProduct92d62b88e7a6bda1cdffd774c099112d.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-RubellaProduct92d62b88e7a6bda1cdffd774c099112d.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-RubellaProduct92d62b88e7a6bda1cdffd774c099112d.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-RubellaProduct92d62b88e7a6bda1cdffd774c099112d.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
