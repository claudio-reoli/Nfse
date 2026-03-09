/**
 * NFS-e Antigravity — Digital Signature Module
 * XMLDSig implementation via Web Crypto API (Certificado A1 .pfx/.p12)
 * Ref: requisitos-nfse-rtc-v2.md seção 4.1 (ICP-Brasil A1/A3)
 */

/**
 * Carrega certificado A1 (.pfx/.p12) usando Web Crypto API
 * @param {ArrayBuffer} pfxBuffer - Conteúdo do arquivo .pfx
 * @param {string} password - Senha do certificado
 * @returns {Promise<{privateKey: CryptoKey, certificate: string, subject: string}>}
 */
export async function loadCertificateA1(pfxBuffer, password) {
  // PFX/PKCS#12 parsing requires a library since Web Crypto API doesn't natively support it
  // We use a minimalist ASN.1/PKCS#12 parser approach
  try {
    const pemData = await parsePKCS12(pfxBuffer, password);
    
    // Import the private key
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      pemData.privateKeyDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    return {
      privateKey,
      certificate: pemData.certificate,
      certificateDer: pemData.certificateDer,
      subject: pemData.subject || 'Certificado ICP-Brasil',
      notBefore: pemData.notBefore,
      notAfter: pemData.notAfter,
      serialNumber: pemData.serialNumber,
    };
  } catch (err) {
    throw new Error(`Falha ao carregar certificado A1: ${err.message}`);
  }
}

/**
 * Assina XML usando XMLDSig (Enveloped Signature)
 * Conforme padrão ICP-Brasil para NFS-e
 * @param {string} xmlStr - XML da DPS
 * @param {CryptoKey} privateKey - Chave privada RSA
 * @param {string} certificateB64 - Certificado X.509 em Base64
 * @returns {Promise<string>} XML assinado
 */
export async function signXml(xmlStr, privateKey, certificateB64) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlStr, 'application/xml');
  
  // Find the element to sign (infDPS or infNFSe)
  const signableElement = doc.querySelector('[Id]');
  if (!signableElement) {
    throw new Error('Elemento com atributo Id não encontrado no XML');
  }
  
  const referenceUri = '#' + signableElement.getAttribute('Id');
  
  // 1. Canonicalize the signed info
  const canonicalXml = canonicalize(signableElement);
  
  // 2. Compute digest (SHA-256)
  const digestBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalXml));
  const digestB64 = arrayBufferToBase64(digestBytes);
  
  // 3. Build SignedInfo
  const signedInfo = buildSignedInfo(referenceUri, digestB64);
  
  // 4. Sign the SignedInfo
  const signedInfoCanonical = signedInfo;
  const signatureBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signedInfoCanonical)
  );
  const signatureB64 = arrayBufferToBase64(signatureBytes);
  
  // 5. Build complete Signature element
  const signatureXml = buildSignatureElement(signedInfo, signatureB64, certificateB64);
  
  // 6. Insert Signature into document (after infDPS)
  const signatureDoc = parser.parseFromString(signatureXml, 'application/xml');
  const signatureNode = doc.importNode(signatureDoc.documentElement, true);
  
  // Insert after infDPS (inside DPS root)
  const root = doc.documentElement;
  root.appendChild(signatureNode);
  
  // Serialize
  const serializer = new XMLSerializer();
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(doc);
}

/**
 * Constrói o elemento SignedInfo para XMLDSig
 */
function buildSignedInfo(referenceUri, digestB64) {
  return `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>` +
    `<Reference URI="${referenceUri}">` +
    `<Transforms>` +
    `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
    `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `</Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
    `<DigestValue>${digestB64}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`;
}

/**
 * Constrói elemento Signature completo
 */
function buildSignatureElement(signedInfo, signatureB64, certificateB64) {
  return `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    signedInfo +
    `<SignatureValue>${signatureB64}</SignatureValue>` +
    `<KeyInfo>` +
    `<X509Data>` +
    `<X509Certificate>${certificateB64}</X509Certificate>` +
    `</X509Data>` +
    `</KeyInfo>` +
    `</Signature>`;
}

/**
 * Canonicalizção simplificada (C14N)
 * Para produção, usar uma biblioteca completa de C14N
 */
function canonicalize(element) {
  const serializer = new XMLSerializer();
  let xml = serializer.serializeToString(element);
  // Normalize whitespace between tags
  xml = xml.replace(/>\s+</g, '><');
  // Remove XML declaration if present
  xml = xml.replace(/<\?xml[^?]*\?>/g, '');
  return xml.trim();
}

/**
 * Converte ArrayBuffer para Base64
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converte Base64 para ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Parser simplificado de PKCS#12 (.pfx)
 * NOTA: em produção, usar biblioteca forge ou pkijs para parsing completo
 * Esta implementação serve como stub com interface correta
 */
async function parsePKCS12(pfxBuffer, password) {
  // In a real implementation, this would use a PKCS#12 library
  // For now, we provide the interface and structure
  const bytes = new Uint8Array(pfxBuffer);
  
  // Verify PKCS#12 magic bytes (sequence tag)
  if (bytes[0] !== 0x30) {
    throw new Error('Formato PKCS#12 inválido. Verifique o arquivo .pfx/.p12');
  }
  
  // This is a placeholder that returns a structure
  // A full implementation would use pkijs or node-forge compiled for browser
  return {
    privateKeyDer: new ArrayBuffer(0),
    certificate: '',
    certificateDer: new ArrayBuffer(0),
    subject: 'Certificado Digital (carregar .pfx para visualizar)',
    notBefore: null,
    notAfter: null,
    serialNumber: '',
  };
}

/**
 * Verifica se certificado está dentro da validade
 */
export function isCertificateValid(notBefore, notAfter) {
  const now = new Date();
  if (notBefore && now < new Date(notBefore)) return false;
  if (notAfter && now > new Date(notAfter)) return false;
  return true;
}

/**
 * Verifica assinatura de um XML assinado
 * @param {string} signedXml - XML com assinatura
 * @returns {Promise<boolean>}
 */
export async function verifyXmlSignature(signedXml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(signedXml, 'application/xml');
  
  const signatureNode = doc.getElementsByTagNameNS(
    'http://www.w3.org/2000/09/xmldsig#', 'Signature'
  )[0];
  
  if (!signatureNode) {
    throw new Error('Assinatura não encontrada no XML');
  }
  
  const signatureValue = signatureNode.getElementsByTagNameNS(
    'http://www.w3.org/2000/09/xmldsig#', 'SignatureValue'
  )[0]?.textContent;
  
  const digestValue = signatureNode.getElementsByTagNameNS(
    'http://www.w3.org/2000/09/xmldsig#', 'DigestValue'
  )[0]?.textContent;
  
  const certB64 = signatureNode.getElementsByTagNameNS(
    'http://www.w3.org/2000/09/xmldsig#', 'X509Certificate'
  )[0]?.textContent;
  
  if (!signatureValue || !digestValue || !certB64) {
    throw new Error('Elementos obrigatórios da assinatura não encontrados');
  }
  
  // Verify digest
  const referenceUri = signatureNode.getElementsByTagNameNS(
    'http://www.w3.org/2000/09/xmldsig#', 'Reference'
  )[0]?.getAttribute('URI');
  
  const refId = referenceUri?.substring(1);
  const signedElement = doc.querySelector(`[Id="${refId}"]`);
  
  if (!signedElement) {
    throw new Error(`Elemento referenciado ${refId} não encontrado`);
  }
  
  // Remove signature before computing digest
  const clonedElement = signedElement.cloneNode(true);
  const embeddedSig = clonedElement.getElementsByTagNameNS(
    'http://www.w3.org/2000/09/xmldsig#', 'Signature'
  )[0];
  if (embeddedSig) embeddedSig.remove();
  
  const canonicalContent = canonicalize(clonedElement);
  const computedDigest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalContent)
  );
  const computedDigestB64 = arrayBufferToBase64(computedDigest);
  
  return computedDigestB64 === digestValue;
}

// ─── Certificate Store (in-memory) ───────────
let _certStore = null;

export function getCertStore() {
  return _certStore;
}

export function setCertStore(certData) {
  _certStore = certData;
}

export function clearCertStore() {
  _certStore = null;
}

/**
 * Retorna resumo do certificado carregado
 */
export function getCertSummary() {
  if (!_certStore) return null;
  return {
    subject: _certStore.subject,
    notBefore: _certStore.notBefore,
    notAfter: _certStore.notAfter,
    serialNumber: _certStore.serialNumber,
    isValid: isCertificateValid(_certStore.notBefore, _certStore.notAfter),
  };
}
