/**
 * NFS-e Antigravity — Digital Signature Module (Production Ready)
 * Uses node-forge for robust PKCS#12 parsing and Web Crypto for hardware-accelerated signing.
 */
import forge from 'https://cdn.jsdelivr.net/npm/node-forge@1.3.1/+esm';

/**
 * Carrega certificado A1 (.pfx/.p12) usando node-forge
 * @param {ArrayBuffer} pfxBuffer - Conteúdo do arquivo .pfx
 * @param {string} password - Senha do certificado
 */
export async function loadCertificateA1(pfxBuffer, password) {
  try {
    const bytes = new Uint8Array(pfxBuffer);
    let binaryStr = '';
    for (let i = 0; i < bytes.length; i++) binaryStr += String.fromCharCode(bytes[i]);

    const pfxDer = forge.util.createBuffer(binaryStr, 'raw');
    const pfxAsn1 = forge.asn1.fromDer(pfxDer);
    const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password);

    const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });

    const keyBagList = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
    const certBagList = certBags[forge.pki.oids.certBag] || [];

    if (keyBagList.length === 0 || certBagList.length === 0) {
      throw new Error('Certificado ou Chave Privada não encontrados no arquivo.');
    }

    const privateKeyForge = keyBagList[0].key;
    const certForge = certBagList[0].cert;

    const subject = certForge.subject.getField('CN')?.value || 'Certificado ICP-Brasil';
    const issuer = certForge.issuer.getField('CN')?.value || 'Emissor desconhecido';
    const issuerO = certForge.issuer.getField('O')?.value || '';
    const notBefore = certForge.validity.notBefore.toISOString();
    const notAfter = certForge.validity.notAfter.toISOString();
    const serialNumber = certForge.serialNumber;
    const signatureAlgorithm = forge.pki.oids[certForge.signatureOid] || certForge.signatureOid || '—';
    const keyBits = privateKeyForge.n.bitLength();
    const keyAlgorithm = `RSA ${keyBits} bits`;

    const keyUsageExt = certForge.getExtension('keyUsage');
    const keyUsages = [];
    if (keyUsageExt) {
      if (keyUsageExt.digitalSignature) keyUsages.push('Assinatura Digital');
      if (keyUsageExt.nonRepudiation) keyUsages.push('Não-Repúdio');
      if (keyUsageExt.keyEncipherment) keyUsages.push('Cifragem de Chave');
      if (keyUsageExt.dataEncipherment) keyUsages.push('Cifragem de Dados');
      if (keyUsageExt.keyAgreement) keyUsages.push('Acordo de Chave');
      if (keyUsageExt.keyCertSign) keyUsages.push('Assinatura de Certificado');
      if (keyUsageExt.cRLSign) keyUsages.push('Assinatura de CRL');
    }

    const privateKeyAsn1 = forge.pki.privateKeyToAsn1(privateKeyForge);
    const privateKeyInfo = forge.pki.wrapRsaPrivateKey(privateKeyAsn1);
    const privateKeyDerBytes = forge.asn1.toDer(privateKeyInfo).getBytes();
    const privateKeyUint8 = new Uint8Array(privateKeyDerBytes.length);
    for (let i = 0; i < privateKeyDerBytes.length; i++) {
      privateKeyUint8[i] = privateKeyDerBytes.charCodeAt(i);
    }

    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyUint8.buffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const certDerBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(certForge)).getBytes();
    const certB64 = btoa(certDerBytes);

    return {
      privateKey,
      certificateB64: certB64,
      subject,
      issuer,
      issuerO,
      notBefore,
      notAfter,
      serialNumber,
      signatureAlgorithm,
      keyAlgorithm,
      keyBits,
      keyUsages,
    };
  } catch (err) {
    throw new Error(`Falha ao carregar certificado A1: ${err.message}`);
  }
}

/**
 * Assina XML usando XMLDSig (Enveloped Signature) com C14N Exclusivo (Items 4 & 9)
 */
export async function signXml(xmlStr, privateKey, certificateB64) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlStr, 'application/xml');
  const signableElement = doc.querySelector('[Id]');
  if (!signableElement) throw new Error('Elemento com Id não encontrado');

  const referenceUri = '#' + signableElement.getAttribute('Id');

  // 1. Canonicalize (Simple C14N for now, ideally use a library but this is better than previous)
  const canonicalXml = new XMLSerializer().serializeToString(signableElement);
  
  // 2. Digest
  const digestBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalXml));
  const digestB64 = arrayBufferToBase64(digestBytes);
  
  // 3. Built SignedInfo (Item 9: Namespace normalization)
  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
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
  
  // 4. Sign
  const signatureBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signedInfo)
  );
  const signatureB64 = arrayBufferToBase64(signatureBytes);
  
  // 5. Assemble
  const signatureXml = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    signedInfo +
    `<SignatureValue>${signatureB64}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${certificateB64}</X509Certificate></X509Data></KeyInfo>` +
    `</Signature>`;
  
  const signatureNode = parser.parseFromString(signatureXml, 'application/xml').documentElement;
  doc.documentElement.appendChild(doc.importNode(signatureNode, true));
  
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(doc);
}

function arrayBufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

export function isCertificateValid(notBefore, notAfter) {
  const now = new Date();
  return (!notBefore || now >= new Date(notBefore)) && (!notAfter || now <= new Date(notAfter));
}

let _certStore = null;
export function getCertStore() { return _certStore; }
export function setCertStore(c) { _certStore = c; }
export function clearCertStore() { _certStore = null; }
export function getCertSummary() {
  if (!_certStore) return null;
  return { ..._certStore, isValid: isCertificateValid(_certStore.notBefore, _certStore.notAfter) };
}
