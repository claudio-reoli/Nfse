/**
 * NFS-e Antigravity — Fiscal Utilities
 * Módulo de cálculos fiscais IBS/CBS/ISSQN e geração de IDs
 * Ref: requisitos-nfse-rtc-v2.md seções 3.4 e 5
 */

// ─── Gerador de ID NFS-e (53 posições) ─────────────────────
export function generateNFSeId({ codMun, ambGer, tipoInscr, inscFederal, nNFSe, anoMesEmis }) {
  const codAleat = String(Math.floor(Math.random() * 999999999)).padStart(9, '0');
  const numericPart =
    String(codMun).padStart(7, '0') +
    String(ambGer) +
    String(tipoInscr) +
    String(inscFederal).padStart(14, '0') +
    String(nNFSe).padStart(13, '0') +
    String(anoMesEmis).padStart(4, '0') +
    codAleat;

  const dv = calcMod11(numericPart);
  return 'NFS' + numericPart + dv;
}

// ─── Gerador de ID DPS (45 posições) ────────────────────────
export function generateDPSId({ codMun, tipoInscr, inscFederal, serieDPS, numDPS }) {
  const numericPart =
    String(codMun).padStart(7, '0') +
    String(tipoInscr) +
    String(inscFederal).padStart(14, '0') +
    String(serieDPS).padStart(5, '0') +
    String(numDPS).padStart(15, '0');

  return 'DPS' + numericPart;
}

// ─── Cálculo Módulo 11 (dígito verificador) ─────────────────
export function calcMod11(numStr) {
  let sum = 0;
  let weight = 2;

  for (let i = numStr.length - 1; i >= 0; i--) {
    sum += parseInt(numStr[i], 10) * weight;
    weight = weight >= 9 ? 2 : weight + 1;
  }

  const remainder = sum % 11;
  if (remainder === 0 || remainder === 1) return '0';
  return String(11 - remainder);
}

// ─── Cálculos IBS/CBS ──────────────────────────────────────
export function calculateIBSCBS({
  vServ,
  descIncond = 0,
  vCalcReeRepRes = 0,
  vCalcDedRedIBSCBS = 0,
  vISSQN = 0,
  vPIS = 0,
  vCOFINS = 0,
  pIBSUF,
  pRedAliqUF = 0,
  pIBSMun,
  pRedAliqMun = 0,
  pCBS,
  pRedAliqCBS = 0,
  pRedutor = 0,
  year = 2026,
}) {
  // Base de Cálculo
  let vBC;
  if (year <= 2026) {
    vBC = vServ - descIncond - vCalcReeRepRes - vCalcDedRedIBSCBS - vISSQN - vPIS - vCOFINS;
  } else {
    vBC = vServ - descIncond - vCalcReeRepRes - vCalcDedRedIBSCBS - vISSQN;
  }
  vBC = Math.max(0, vBC);

  // Alíquotas efetivas
  const pAliqEfetUF  = pIBSUF  * (1 - pRedAliqUF / 100)  * (1 - pRedutor / 100);
  const pAliqEfetMun = pIBSMun * (1 - pRedAliqMun / 100) * (1 - pRedutor / 100);
  const pAliqEfetCBS = pCBS    * (1 - pRedAliqCBS / 100)  * (1 - pRedutor / 100);

  // Valores calculados
  const vIBSUF  = bankersRound(vBC * pAliqEfetUF / 100, 2);
  const vIBSMun = bankersRound(vBC * pAliqEfetMun / 100, 2);
  const vIBSTot = bankersRound(vIBSUF + vIBSMun, 2);
  const vCBSCalc = bankersRound(vBC * pAliqEfetCBS / 100, 2);

  // Valor total NF
  let vTotNF;
  if (year <= 2026) {
    vTotNF = vServ - descIncond; // vLiq simplified
  } else {
    vTotNF = (vServ - descIncond) + vCBSCalc + vIBSTot;
  }

  return {
    vBC: bankersRound(vBC, 2),
    pAliqEfetUF:  bankersRound(pAliqEfetUF, 4),
    pAliqEfetMun: bankersRound(pAliqEfetMun, 4),
    pAliqEfetCBS: bankersRound(pAliqEfetCBS, 4),
    vIBSUF,
    vIBSMun,
    vIBSTot,
    vCBS: vCBSCalc,
    vTotNF: bankersRound(vTotNF, 2),
  };
}

// ─── Arredondamento Bancário (half-even) ────────────────────
export function bankersRound(value, decimals) {
  const factor = Math.pow(10, decimals);
  const shifted = value * factor;
  const truncated = Math.trunc(shifted);
  const remainder = shifted - truncated;

  if (Math.abs(remainder - 0.5) < Number.EPSILON) {
    // Exactly 0.5: round to even
    return truncated % 2 === 0 ? truncated / factor : (truncated + 1) / factor;
  }
  return Math.round(shifted) / factor;
}

// ─── Validadores ────────────────────────────────────────────
export function validateCNPJ(cnpj) {
  cnpj = cnpj.replace(/\D/g, '');
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  const calc = (slice, weights) =>
    weights.reduce((sum, w, i) => sum + parseInt(slice[i], 10) * w, 0);

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let r = calc(cnpj, w1) % 11;
  const d1 = r < 2 ? 0 : 11 - r;
  if (parseInt(cnpj[12], 10) !== d1) return false;

  r = calc(cnpj, w2) % 11;
  const d2 = r < 2 ? 0 : 11 - r;
  return parseInt(cnpj[13], 10) === d2;
}

export function validateCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (parseInt(cpf[9], 10) !== d1) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return parseInt(cpf[10], 10) === d2;
}

export function validateChaveNFSe(chave) {
  return /^[0-9]{50}$/.test(chave);
}

export function validateIdNFSe(id) {
  return /^NFS[0-9]{50}$/.test(id) && id.length === 53;
}

export function validateIdDPS(id) {
  return /^DPS[0-9]{42}$/.test(id) && id.length === 45;
}

// ─── Máscaras ───────────────────────────────────────────────
export function maskCNPJ(value) {
  return value
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function maskCPF(value) {
  return value
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1-$2');
}

export function maskCEP(value) {
  return value
    .replace(/\D/g, '')
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, '$1-$2');
}

export function maskPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

export function maskCurrency(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Formatadores ───────────────────────────────────────────
export function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR');
}

export function formatDateTimeUTC(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toISOString().replace(/\.\d{3}Z$/, '-03:00');
}

// ─── Enumerações ────────────────────────────────────────────
export const ENUMS = {
  tipoAmbiente: {
    '1': 'Produção',
    '2': 'Homologação',
  },
  tipoEmiteDPS: {
    '1': 'Prestador',
    '2': 'Tomador',
    '3': 'Intermediário',
  },
  finNFSe: {
    '0': 'Regular',
    '1': 'Crédito',
    '2': 'Débito',
  },
  indFinal: {
    '0': 'Não (uso comercial)',
    '1': 'Sim (uso/consumo pessoal)',
  },
  indDest: {
    '0': 'Destinatário é o próprio tomador',
    '1': 'Destinatário diferente do adquirente',
  },
  indZFMALC: {
    '0': 'Não',
    '1': 'Sim (Art. 451/466 LC 214)',
  },
  tpOper: {
    '1': 'Fornecimento c/ pagamento posterior',
    '2': 'Recebimento do pagamento c/ fornecimento já realizado',
    '3': 'Fornecimento c/ pagamento já realizado',
    '4': 'Recebimento do pagamento c/ fornecimento posterior',
    '5': 'Fornecimento e recebimento concomitantes',
  },
  tpEnteGov: {
    '1': 'União',
    '2': 'Estado',
    '3': 'Distrito Federal',
    '4': 'Município',
  },
  codJustCanc: {
    '1': 'Erro na Emissão',
    '2': 'Serviço não Prestado',
    '9': 'Outros',
  },
  codJustSubst: {
    '01': 'Desenquadramento de NFS-e do Simples Nacional',
    '02': 'Enquadramento de NFS-e no Simples Nacional',
    '03': 'Inclusão Retroativa de Imunidade/Isenção',
    '04': 'Exclusão Retroativa de Imunidade/Isenção',
    '05': 'Rejeição de NFS-e pelo tomador',
    '99': 'Outros',
  },
  tpRetPisCofins: {
    '0': 'PIS/COFINS/CSLL Não Retidos',
    '1': 'PIS/COFINS Retido (legado)',
    '2': 'PIS/COFINS Não Retido (legado)',
    '3': 'PIS/COFINS/CSLL Retidos',
    '4': 'PIS/COFINS Ret., CSLL Não Ret.',
    '5': 'PIS Ret., COFINS/CSLL Não Ret.',
    '6': 'COFINS Ret., PIS/CSLL Não Ret.',
    '7': 'PIS Não Ret., COFINS/CSLL Ret.',
    '8': 'PIS/COFINS Não Ret., CSLL Ret.',
    '9': 'COFINS Não Ret., PIS/CSLL Ret.',
  },
  novosFatosGeradores: {
    '99.01.01': 'Outros Serviços s/ incidência ISSQN/ICMS',
    '99.02.01': 'Operações c/ Bens Imateriais',
    '99.03.01': 'Locação de Bens Imóveis',
    '99.03.02': 'Cessão Onerosa de Bens Imóveis',
    '99.03.03': 'Arrendamento de Bens Imóveis',
    '99.03.04': 'Servidão/Cessão de Uso de Bens Imóveis',
    '99.03.05': 'Permissão de Uso de Bens Imóveis',
    '99.04.01': 'Locação de Bens Móveis',
  },
};
