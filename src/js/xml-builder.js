/**
 * NFS-e Antigravity — XML Builder
 * Gera DPS XML conforme XSD v1.01 (TCDPS → TCInfDPS)
 * Ref: tiposComplexos_v1.01.xsd linhas 736-847
 */
import { generateDPSId, formatDateTimeUTC } from './fiscal-utils.js';

const NS = 'http://www.sped.fazenda.gov.br/nfse';
const DS_NS = 'http://www.w3.org/2000/09/xmldsig#';
const VERSION = '1.00';

/**
 * Cria elemento XML com namespace
 */
function el(doc, tag, value, attrs = {}) {
  const node = doc.createElementNS(NS, tag);
  if (value !== undefined && value !== null && value !== '') {
    node.textContent = String(value);
  }
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, v);
  }
  return node;
}

/**
 * Adiciona elemento filho somente se o valor existir
 */
function addIf(parent, doc, tag, value) {
  if (value !== undefined && value !== null && value !== '') {
    parent.appendChild(el(doc, tag, value));
  }
}

/**
 * Lê formulário e gera XML da DPS conforme XSD TCInfDPS
 * @param {Object} formData - Dados do formulário
 * @returns {string} XML serializado
 */
export function buildDPSXml(formData) {
  const doc = document.implementation.createDocument(NS, 'DPS', null);
  const root = doc.documentElement;
  root.setAttribute('versao', VERSION);
  root.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns', NS);

  // ─── infDPS ─────────────────────────────────
  const dpsId = generateDPSId({
    codMun: formData.cLocEmi,
    tipoInscr: formData.prestTipoInscr || '1',
    inscFederal: (formData.prestDoc || '').replace(/\D/g, ''),
    serieDPS: formData.serie,
    numDPS: formData.nDPS,
  });

  const infDPS = el(doc, 'infDPS', null, { Id: dpsId });

  // Identificação
  infDPS.appendChild(el(doc, 'tpAmb', formData.tpAmb));
  infDPS.appendChild(el(doc, 'dhEmi', formatDhEmi(formData.dhEmi)));
  infDPS.appendChild(el(doc, 'verAplic', formData.verAplic || 'Antigravity-1.0'));
  infDPS.appendChild(el(doc, 'serie', String(formData.serie).padStart(5, '0')));
  infDPS.appendChild(el(doc, 'nDPS', String(formData.nDPS).padStart(15, '0')));
  infDPS.appendChild(el(doc, 'dCompet', formatDate(formData.dCompet)));
  infDPS.appendChild(el(doc, 'tpEmit', formData.tpEmit));

  addIf(infDPS, doc, 'cMotivoEmisTI', formData.cMotivoEmisTI);
  addIf(infDPS, doc, 'chNFSeRej', formData.chNFSeRej);

  infDPS.appendChild(el(doc, 'cLocEmi', String(formData.cLocEmi).padStart(7, '0')));

  // Substituição (se houver)
  if (formData.chSubstda) {
    const subst = el(doc, 'subst');
    subst.appendChild(el(doc, 'chSubstda', formData.chSubstda));
    subst.appendChild(el(doc, 'cMotivo', formData.cMotivoSubst || '99'));
    addIf(subst, doc, 'xMotivo', formData.xMotivoSubst);
    infDPS.appendChild(subst);
  }

  // ─── Prestador ──────────────────────────────
  const prest = el(doc, 'prest');
  const prestDocClean = (formData.prestDoc || '').replace(/\D/g, '');
  if (formData.prestTipoInscr === '2') {
    prest.appendChild(el(doc, 'CPF', prestDocClean.padStart(11, '0')));
  } else {
    prest.appendChild(el(doc, 'CNPJ', prestDocClean.padStart(14, '0')));
  }
  addIf(prest, doc, 'IM', formData.prestIM);
  addIf(prest, doc, 'xNome', formData.prestXNome);

  // Endereço do prestador
  if (formData.prestCEP || formData.prestXLgr) {
    const end = el(doc, 'end');
    const endNac = el(doc, 'endNac');
    addIf(endNac, doc, 'cMun', formData.prestCMun);
    addIf(endNac, doc, 'CEP', (formData.prestCEP || '').replace(/\D/g, ''));
    end.appendChild(endNac);
    addIf(end, doc, 'xLgr', formData.prestXLgr);
    addIf(end, doc, 'nro', formData.prestNro);
    addIf(end, doc, 'xCpl', formData.prestXCpl);
    addIf(end, doc, 'xBairro', formData.prestXBairro);
    prest.appendChild(end);
  }
  addIf(prest, doc, 'fone', (formData.prestFone || '').replace(/\D/g, ''));
  addIf(prest, doc, 'email', formData.prestEmail);

  // Regime tributário
  const regTrib = el(doc, 'regTrib');
  regTrib.appendChild(el(doc, 'opSimpNac', formData.opSimpNac || '1'));
  addIf(regTrib, doc, 'regApTribSN', formData.regApTribSN);
  regTrib.appendChild(el(doc, 'regEspTrib', formData.regEspTrib || '0'));
  prest.appendChild(regTrib);

  infDPS.appendChild(prest);

  // ─── Tomador ────────────────────────────────
  if (formData.tomaDoc) {
    const toma = el(doc, 'toma');
    const tomaDocClean = (formData.tomaDoc || '').replace(/\D/g, '');
    if (formData.tomaTipoDoc === 'CPF') {
      toma.appendChild(el(doc, 'CPF', tomaDocClean.padStart(11, '0')));
    } else if (formData.tomaTipoDoc === 'NIF') {
      toma.appendChild(el(doc, 'NIF', formData.tomaDoc));
    } else {
      toma.appendChild(el(doc, 'CNPJ', tomaDocClean.padStart(14, '0')));
    }
    addIf(toma, doc, 'IM', formData.tomaIM);
    toma.appendChild(el(doc, 'xNome', formData.tomaXNome));

    if (formData.tomaCEP || formData.tomaXLgr) {
      const end = el(doc, 'end');
      const endNac = el(doc, 'endNac');
      addIf(endNac, doc, 'cMun', formData.tomaCMun);
      addIf(endNac, doc, 'CEP', (formData.tomaCEP || '').replace(/\D/g, ''));
      end.appendChild(endNac);
      addIf(end, doc, 'xLgr', formData.tomaXLgr);
      addIf(end, doc, 'nro', formData.tomaNro);
      addIf(end, doc, 'xBairro', formData.tomaXBairro);
      toma.appendChild(end);
    }
    addIf(toma, doc, 'email', formData.tomaEmail);
    infDPS.appendChild(toma);
  }

  // ─── Serviço ────────────────────────────────
  const serv = el(doc, 'serv');
  addIf(serv, doc, 'cServ', el(doc, 'cTribNac', formData.cTribNac));
  // rebuild with correct structure
  serv.appendChild(el(doc, 'cTribNac', formData.cTribNac));
  addIf(serv, doc, 'cTribMun', formData.cTribMun);
  addIf(serv, doc, 'cNBS', formData.cNBS);
  serv.appendChild(el(doc, 'xDescServ', formData.xDescServ));
  serv.appendChild(el(doc, 'cLocPrest', String(formData.cLocPrest).padStart(7, '0')));

  // Bens móveis (99.04.01)
  if (formData.cTribNac === '99.04.01' && formData.bmNCM) {
    const locBM = el(doc, 'locBensMov');
    locBM.appendChild(el(doc, 'NCM', formData.bmNCM));
    addIf(locBM, doc, 'xNCM', formData.bmXNCM);
    locBM.appendChild(el(doc, 'qtd', formData.bmQtd || '1'));
    serv.appendChild(locBM);
  }

  infDPS.appendChild(serv);

  // ─── Valores ────────────────────────────────
  const valores = el(doc, 'valores');
  valores.appendChild(el(doc, 'vServ', formatDecimal(formData.vServ)));
  addIf(valores, doc, 'descIncond', formatDecimal(formData.descIncond));
  addIf(valores, doc, 'descCond', formatDecimal(formData.descCond));

  // Tributos municipais
  const tribMun = el(doc, 'tribMun');
  addIf(tribMun, doc, 'tribISSQN', formData.tribISSQN || '1');
  addIf(tribMun, doc, 'cExigSusp', formData.cExigSusp);
  addIf(tribMun, doc, 'pAliq', formatDecimal(formData.pAliq, 4));
  addIf(tribMun, doc, 'tpRetISSQN', formData.tpRetISSQN);
  valores.appendChild(tribMun);

  // PIS/COFINS Federation
  const tribFed = el(doc, 'tribFed');
  addIf(tribFed, doc, 'CST', formData.CSTPC);
  addIf(tribFed, doc, 'vPIS', formatDecimal(formData.vPIS));
  addIf(tribFed, doc, 'vCOFINS', formatDecimal(formData.vCofins));
  addIf(tribFed, doc, 'vINSS', formatDecimal(formData.vINSS));
  addIf(tribFed, doc, 'vIR', formatDecimal(formData.vIR));
  addIf(tribFed, doc, 'vCSLL', formatDecimal(formData.vCSLL));
  addIf(tribFed, doc, 'tpRetPisCofins', formData.tpRetPC);
  addIf(tribFed, doc, 'vRetCP', formatDecimal(formData.vRetCP));
  addIf(tribFed, doc, 'vRetIRRF', formatDecimal(formData.vRetIRRF));
  addIf(tribFed, doc, 'vRetCSLL', formatDecimal(formData.vRetCSLL));
  valores.appendChild(tribFed);

  infDPS.appendChild(valores);

  // ─── IBSCBS (Reforma Tributária) ────────────
  if (formData.ibsFinalNFSe !== undefined && formData.ibsFinalNFSe !== '') {
    const ibscbs = el(doc, 'IBSCBS');
    ibscbs.appendChild(el(doc, 'finNFSe', formData.ibsFinalNFSe));
    ibscbs.appendChild(el(doc, 'indFinal', formData.ibsIndFinal));
    ibscbs.appendChild(el(doc, 'cIndOp', formData.ibsCIndOp));
    ibscbs.appendChild(el(doc, 'indDest', formData.ibsIndDest));
    addIf(ibscbs, doc, 'indZFMALC', formData.ibsIndZFMALC);
    addIf(ibscbs, doc, 'tpOper', formData.ibsTpOper);

    // Tributação
    const trib = el(doc, 'trib');
    trib.appendChild(el(doc, 'CST', formData.ibsCST));
    trib.appendChild(el(doc, 'cClassTrib', formData.ibsCClassTrib));
    addIf(trib, doc, 'cCredPres', formData.ibsCCredPres);
    addIf(trib, doc, 'pRedAliqUF', formatDecimal(formData.ibsPRedAliqUF, 4));
    addIf(trib, doc, 'pRedAliqMun', formatDecimal(formData.ibsPRedAliqMun, 4));
    addIf(trib, doc, 'pRedAliqCBS', formatDecimal(formData.ibsPRedAliqCBS, 4));
    addIf(trib, doc, 'vCalcDedRedIBSCBS', formatDecimal(formData.ibsVCalcDedRed));
    ibscbs.appendChild(trib);

    // Compra Governamental
    if (formData.ibsTpOper) {
      const compGov = el(doc, 'compGov');
      addIf(compGov, doc, 'tpOper', formData.ibsTpOper);
      addIf(compGov, doc, 'tpEnteGov', formData.ibsTpEnteGov);
      addIf(compGov, doc, 'pRedutor', formatDecimal(formData.ibsPRedutor, 4));
      ibscbs.appendChild(compGov);
    }

    infDPS.appendChild(ibscbs);
  }

  root.appendChild(infDPS);

  // Serialize
  const serializer = new XMLSerializer();
  const xmlStr = serializer.serializeToString(doc);
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlStr;
}

/**
 * Coleta dados do formulário de DPS
 * @returns {Object} formData
 */
export function collectDPSFormData() {
  const val = (id) => document.getElementById(id)?.value?.trim() || '';
  return {
    // Identificação
    tpAmb: val('dps-tpAmb'),
    dhEmi: val('dps-dhEmi'),
    verAplic: val('dps-verAplic'),
    serie: val('dps-serie'),
    nDPS: val('dps-nDPS'),
    dCompet: val('dps-dCompet'),
    tpEmit: val('dps-tpEmit'),
    cLocEmi: val('dps-cLocEmi'),
    procEmi: val('dps-procEmi'),
    // Prestador
    prestTipoInscr: val('prest-tipoInscr'),
    prestDoc: val('prest-doc'),
    prestIM: val('prest-IM'),
    prestXNome: val('prest-xNome'),
    prestCEP: val('prest-CEP'),
    prestXLgr: val('prest-xLgr'),
    prestNro: val('prest-nro'),
    prestXCpl: val('prest-xCpl'),
    prestXBairro: val('prest-xBairro'),
    prestCMun: val('prest-cMun'),
    prestFone: val('prest-fone'),
    prestEmail: val('prest-email'),
    opSimpNac: '1', // default
    regEspTrib: '0',
    // Tomador
    tomaTipoDoc: val('toma-tipoDoc'),
    tomaDoc: val('toma-doc'),
    tomaIM: val('toma-IM'),
    tomaXNome: val('toma-xNome'),
    tomaCEP: val('toma-CEP'),
    tomaXLgr: val('toma-xLgr'),
    tomaNro: val('toma-nro'),
    tomaXBairro: val('toma-xBairro'),
    tomaCMun: val('toma-cMun'),
    tomaEmail: val('toma-email'),
    // Serviço
    cTribNac: val('serv-cTribNac'),
    cTribMun: val('serv-cTribMun'),
    cNBS: val('serv-cNBS'),
    xDescServ: val('serv-xDescServ'),
    cLocPrest: val('serv-cLocPrest'),
    bmNCM: val('bm-NCM'),
    bmXNCM: val('bm-xNCM'),
    bmQtd: val('bm-qtd'),
    // Valores
    vServ: val('val-vServ'),
    descIncond: val('val-descIncond'),
    descCond: val('val-descCond'),
    CSTPC: val('val-CSTPC'),
    tpRetPC: val('val-tpRetPC'),
    vPIS: val('val-vPIS'),
    vCofins: val('val-vCofins'),
    vRetCSLL: val('val-vRetCSLL'),
    tpRetISSQN: val('val-tpRetISSQN'),
    vRetCP: val('val-vRetCP'),
    vRetIRRF: val('val-vRetIRRF'),
    // IBS/CBS
    ibsFinalNFSe: val('ibs-finNFSe'),
    ibsIndFinal: val('ibs-indFinal'),
    ibsCIndOp: val('ibs-cIndOp'),
    ibsIndDest: val('ibs-indDest'),
    ibsIndZFMALC: val('ibs-indZFMALC'),
    ibsTpOper: val('ibs-tpOper'),
    ibsCST: val('ibs-CST'),
    ibsCClassTrib: val('ibs-cClassTrib'),
    ibsCCredPres: val('ibs-cCredPres'),
  };
}

/**
 * Valida campos obrigatórios da DPS
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDPSForm(data) {
  const errors = [];
  if (!data.tpAmb) errors.push('Ambiente (tpAmb) é obrigatório');
  if (!data.serie) errors.push('Série da DPS é obrigatória');
  if (!data.nDPS) errors.push('Número da DPS é obrigatório');
  if (!data.dCompet) errors.push('Data de Competência é obrigatória');
  if (!data.dhEmi) errors.push('Data/Hora de Emissão é obrigatória');
  if (!data.tpEmit) errors.push('Tipo do Emitente é obrigatório');
  if (!data.cLocEmi) errors.push('Município Emissor (IBGE) é obrigatório');
  if (!data.prestDoc) errors.push('CNPJ/CPF do Prestador é obrigatório');
  if (!data.cTribNac) errors.push('Código de Tributação Nacional é obrigatório');
  if (!data.xDescServ) errors.push('Descrição do Serviço é obrigatória');
  if (!data.cLocPrest) errors.push('Local da Prestação é obrigatório');
  if (!data.vServ) errors.push('Valor do Serviço é obrigatório');

  return { valid: errors.length === 0, errors };
}

// ─── Helpers ──────────────────────────────────
function formatDhEmi(dateTimeLocal) {
  if (!dateTimeLocal) return '';
  return dateTimeLocal.replace('T', 'T') + ':00-03:00';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return dateStr.replace(/-/g, '');
}

function formatDecimal(value, decimals = 2) {
  if (!value && value !== 0) return '';
  const num = typeof value === 'string'
    ? parseFloat(value.replace(/\./g, '').replace(',', '.'))
    : value;
  return isNaN(num) ? '' : num.toFixed(decimals);
}

/**
 * Faz download do XML gerado
 */
export function downloadXml(xmlStr, filename) {
  const blob = new Blob([xmlStr], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'DPS.xml';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exibe XML formatado em um modal
 */
export function prettyPrintXml(xmlStr) {
  // Simple indentation
  let formatted = '';
  let indent = 0;
  const lines = xmlStr.replace(/(>)(<)/g, '$1\n$2').split('\n');
  for (const line of lines) {
    if (line.match(/^<\//)) indent--;
    formatted += '  '.repeat(Math.max(0, indent)) + line.trim() + '\n';
    if (line.match(/^<[^/?!]/) && !line.match(/\/>$/)) indent++;
  }
  return formatted;
}
