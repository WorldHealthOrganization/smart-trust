/*
 * VENDORED THIRD-PARTY FILE — do not edit.
 *
 * qrcode-generator's UTF-8 shim, by Kazuhiko Arase, MIT licensed (see
 * qrcode.LICENSE.txt). Source: js/dist/qrcode_UTF8.js, vendored 2026-09-15.
 *
 * Load this AFTER qrcode.js. It replaces the default `stringToBytes`, which
 * is single-byte: without it, a URL carrying a non-ASCII character in its
 * path or fragment encodes to mojibake and the QR silently resolves to the
 * wrong address. Caught by scripts/tests/qr.test.js, whose decoder read
 * "héllo wörld — ünicode" back as "h?llo w?rld  ?nicode".
 */
//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript UTF8 Support (optional)
//
// Copyright (c) 2011 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

!function(qrcode) {

  //---------------------------------------------------------------------
  // overwrite qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

}(qrcode);
