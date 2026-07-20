// Phase 2 recruitment application scaffold restored for review.
// Not wired into the static site; do not deploy or enable submissions in Phase 1.1.
'use strict';

// Magic-byte (file-signature) detection for the accepted CV formats. The backend must never
// trust the client-declared extension or MIME type alone; it validates the actual bytes.
//
// Signatures:
//   pdf            → "%PDF-"                     (25 50 44 46 2D)
//   oleCompoundFile→ D0 CF 11 E0 A1 B1 1A E1     (legacy .doc / OLE2)
//   zipDocx        → "PK\x03\x04" / "PK\x05\x06" / "PK\x07\x08" (ZIP, incl. .docx)

const SIGNATURES = {
  pdf: [[0x25, 0x50, 0x44, 0x46, 0x2d]],
  oleCompoundFile: [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  zipDocx: [
    [0x50, 0x4b, 0x03, 0x04],
    [0x50, 0x4b, 0x05, 0x06],
    [0x50, 0x4b, 0x07, 0x08]
  ]
};

function startsWith(bytes, prefix) {
  if (!bytes || bytes.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i += 1) {
    if (bytes[i] !== prefix[i]) return false;
  }
  return true;
}

// Return the signature identifier for a byte buffer, or null if none match.
function detectSignature(bytes) {
  const names = Object.keys(SIGNATURES);
  for (let n = 0; n < names.length; n += 1) {
    const variants = SIGNATURES[names[n]];
    for (let v = 0; v < variants.length; v += 1) {
      if (startsWith(bytes, variants[v])) return names[n];
    }
  }
  return null;
}

// Confirm that a buffer matches one of the acceptedSignatures declared in the manifest.
function matchesAccepted(bytes, acceptedSignatures) {
  const detected = detectSignature(bytes);
  if (!detected) return false;
  return Array.isArray(acceptedSignatures) && acceptedSignatures.indexOf(detected) !== -1;
}

module.exports = { detectSignature, matchesAccepted, SIGNATURES };
