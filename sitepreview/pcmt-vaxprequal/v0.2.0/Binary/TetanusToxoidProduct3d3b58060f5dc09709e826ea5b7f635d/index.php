<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-TetanusToxoidProduct3d3b58060f5dc09709e826ea5b7f635d.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-TetanusToxoidProduct3d3b58060f5dc09709e826ea5b7f635d.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-TetanusToxoidProduct3d3b58060f5dc09709e826ea5b7f635d.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-TetanusToxoidProduct3d3b58060f5dc09709e826ea5b7f635d.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-TetanusToxoidProduct3d3b58060f5dc09709e826ea5b7f635d.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-TetanusToxoidProduct3d3b58060f5dc09709e826ea5b7f635d.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-TetanusToxoidProduct3d3b58060f5dc09709e826ea5b7f635d.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
