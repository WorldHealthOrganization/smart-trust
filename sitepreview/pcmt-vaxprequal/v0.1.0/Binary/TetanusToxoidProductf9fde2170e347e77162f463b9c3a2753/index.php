<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-TetanusToxoidProductf9fde2170e347e77162f463b9c3a2753.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-TetanusToxoidProductf9fde2170e347e77162f463b9c3a2753.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-TetanusToxoidProductf9fde2170e347e77162f463b9c3a2753.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-TetanusToxoidProductf9fde2170e347e77162f463b9c3a2753.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-TetanusToxoidProductf9fde2170e347e77162f463b9c3a2753.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-TetanusToxoidProductf9fde2170e347e77162f463b9c3a2753.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-TetanusToxoidProductf9fde2170e347e77162f463b9c3a2753.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
