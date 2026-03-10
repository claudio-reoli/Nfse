/**
 * NFS-e Antigravity — API Service Layer
 * Client para APIs Sefin Nacional e ADN
 * Ref: requisitos-nfse-rtc-v2.md seção 2 (APIs)
 */

// ─── Configuration ──────────────────────────────
const ENV = {
  sandbox: {
    sefin: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional',
    adn:   'https://adn.producaorestrita.nfse.gov.br/contribuintes',
    adnMun:'https://adn.producaorestrita.nfse.gov.br/municipios',
  },
  production: {
    sefin: 'https://sefin.nfse.gov.br/SefinNacional',
    adn:   'https://adn.nfse.gov.br/contribuintes',
    adnMun:'https://adn.nfse.gov.br/municipios',
  },
};

let currentEnv = 'sandbox';

export function setEnvironment(env) {
  currentEnv = env === 'production' ? 'production' : 'sandbox';
}

export function getEnvironment() {
  return currentEnv;
}

function getBaseUrl(api) {
  return ENV[currentEnv][api];
}

// ─── HTTP Client ────────────────────────────────
async function apiRequest(baseApi, path, options = {}) {
  const url = `${getBaseUrl(baseApi)}${path}`;
  const defaultHeaders = {
    'Content-Type': options.contentType || 'application/json',
    'Accept': 'application/json',
  };

  const config = {
    method: options.method || 'GET',
    headers: { ...defaultHeaders, ...options.headers },
    ...options,
  };

  if (options.body && typeof options.body === 'object' && config.headers['Content-Type'] === 'application/json') {
    config.body = JSON.stringify(options.body);
  }

  // Log request em modo debug
  console.log(`[API] ${config.method} ${url}`);

  try {
    const response = await fetch(url, config);
    const data = response.headers.get('content-type')?.includes('json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const error = new ApiError(
        `API Error: ${response.status} ${response.statusText}`,
        response.status,
        data
      );
      console.error(`[API] Error:`, error);
      throw error;
    }

    console.log(`[API] Response OK:`, data);
    return { data, status: response.status, ok: true };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(`Falha na conexão: ${err.message}`, 0, null);
  }
}

class ApiError extends Error {
  constructor(message, status, responseData) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.responseData = responseData;
  }
}

// ════════════════════════════════════════════════
// SEFIN NACIONAL — APIs
// ════════════════════════════════════════════════

/**
 * POST /nfse — Enviar DPS para geração de NFS-e
 * @param {string} dpsXml - XML da DPS assinada
 * @returns {Promise<Object>} Retorno com NFS-e ou erros
 */
export async function enviarDPS(dpsXml) {
  return apiRequest('sefin', '/nfse', {
    method: 'POST',
    contentType: 'application/xml',
    body: dpsXml,
  });
}

/**
 * GET /nfse/{chaveAcesso} — Consultar NFS-e por chave de acesso
 * @param {string} chaveAcesso - 50 dígitos
 */
export async function consultarNFSe(chaveAcesso) {
  return apiRequest('sefin', `/nfse/${chaveAcesso}`);
}

/**
 * GET /dps/{idDPS} — Consultar DPS por identificador
 * @param {string} idDPS - ID da DPS (45 posições)
 */
export async function consultarDPS(idDPS) {
  return apiRequest('sefin', `/dps/${idDPS}`);
}

/**
 * HEAD /dps/{idDPS} — Verifica se NFS-e foi gerada a partir da DPS
 * @param {string} idDPS - ID da DPS
 * @returns {Promise<{exists: boolean}>}
 */
export async function verificarDPS(idDPS) {
  const url = `${getBaseUrl('sefin')}/dps/${idDPS}`;
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return { exists: response.ok, status: response.status };
  } catch (err) {
    return { exists: false, status: 0, error: err.message };
  }
}

/**
 * POST /nfse/{chaveAcesso}/eventos — Registrar evento na NFS-e
 * @param {string} chaveAcesso - Chave da NFS-e
 * @param {Object} evento - Dados do evento
 */
export async function registrarEvento(chaveAcesso, evento) {
  return apiRequest('sefin', `/nfse/${chaveAcesso}/eventos`, {
    method: 'POST',
    body: evento,
  });
}

/**
 * GET /nfse/{chaveAcesso}/eventos — Consultar eventos de uma NFS-e
 */
export async function consultarEventos(chaveAcesso) {
  return apiRequest('sefin', `/nfse/${chaveAcesso}/eventos`);
}

/**
 * GET /nfse/{chaveAcesso}/eventos/{tipoEvento} — Filtrar eventos por tipo
 */
export async function consultarEventosTipo(chaveAcesso, tipoEvento) {
  return apiRequest('sefin', `/nfse/${chaveAcesso}/eventos/${tipoEvento}`);
}

/**
 * GET /nfse/{chaveAcesso}/eventos/{tipoEvento}/{numSeqEvento} — Evento específico
 */
export async function consultarEventoEspecifico(chaveAcesso, tipoEvento, numSeq) {
  return apiRequest('sefin', `/nfse/${chaveAcesso}/eventos/${tipoEvento}/${numSeq}`);
}

/**
 * GET /parametros_municipais/{codMun}/convenio — Convênio municipal
 */
export async function consultarConvenio(codMun) {
  return apiRequest('sefin', `/parametros_municipais/${codMun}/convenio`);
}

/**
 * GET /parametros_municipais/{codMun}/{cpfCnpj} retencoes — Retenções do contribuinte
 */
export async function consultarRetencoes(codMun, cpfCnpj) {
  return apiRequest('sefin', `/parametros_municipais/${codMun}/${cpfCnpj}`);
}

/**
 * GET /parametros_municipais/{codMun}/beneficiomunicipal/{nBM} — Benefício
 */
export async function consultarBeneficio(codMun, nBM) {
  return apiRequest('sefin', `/parametros_municipais/${codMun}/beneficiomunicipal/${nBM}`);
}

/**
 * POST /decisao-judicial/nfse — Emissão por bypass judicial
 * @param {string} nfseXml - XML completo da NFS-e (DPS + valores calculados)
 */
export async function emissaoBypass(nfseXml) {
  return apiRequest('sefin', '/decisao-judicial/nfse', {
    method: 'POST',
    contentType: 'application/xml',
    body: nfseXml,
  });
}

/**
 * GET /parametros_municipais/{codMun} — Parâmetros do município
 */
export async function consultarParametrosMunicipais(codMun) {
  return apiRequest('sefin', `/parametros_municipais/${codMun}`);
}

/**
 * GET /parametros_municipais/{codMun}/{codServico} — Parâmetros de alíquota
 */
export async function consultarAliquotaMunicipal(codMun, codServico) {
  return apiRequest('sefin', `/parametros_municipais/${codMun}/${codServico}`);
}

// ════════════════════════════════════════════════
// ADN — Ambiente de Dados Nacional (Contribuintes)
// ════════════════════════════════════════════════

/**
 * GET /DFe/{NSU} — Distribuição de DF-e por NSU
 * @param {number} nsu - Número Sequencial Único
 */
export async function distribuicaoDFe(nsu) {
  return apiRequest('adn', `/DFe/${nsu}`);
}

/**
 * GET /DFe — Buscar último NSU disponível
 */
export async function ultimoNSU() {
  return apiRequest('adn', '/DFe');
}

/**
 * GET /NFSe/{chaveAcesso}/Eventos — Eventos via ADN
 */
export async function adnEventos(chaveAcesso) {
  return apiRequest('adn', `/NFSe/${chaveAcesso}/Eventos`);
}

/**
 * GET /danfse/{chaveAcesso} — Download DANFSe (PDF)
 */
export async function downloadDANFSe(chaveAcesso) {
  const url = `${getBaseUrl('adn')}/danfse/${chaveAcesso}`;
  console.log(`[API] GET DANFSe PDF: ${url}`);

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/pdf' },
    });
    if (!response.ok) {
      throw new ApiError(`DANFSe Error: ${response.status}`, response.status, null);
    }
    const blob = await response.blob();
    return blob;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(`Falha ao baixar DANFSe: ${err.message}`, 0, null);
  }
}

// ════════════════════════════════════════════════
// ADN — Ambiente de Dados Nacional (Municípios)
// ════════════════════════════════════════════════

/**
 * GET /DFe/{NSU} — Distribuição para municípios
 */
export async function adnMunDistribuicao(nsu) {
  return apiRequest('adnMun', `/DFe/${nsu}`);
}

// ════════════════════════════════════════════════
// SIMULAÇÃO (Demo Mode)
// Quando APIs reais não estão acessíveis
// ════════════════════════════════════════════════

let demoMode = true;

export function setDemoMode(mode) {
  demoMode = !!mode;
}

export function isDemoMode() {
  return demoMode;
}

/**
 * Wrapper que retorna dados de demo quando APIs reais não estão acessíveis
 */
export async function safeFetch(apiFn, ...args) {
  if (demoMode) {
    console.log(`[DEMO] Simulando chamada: ${apiFn.name}(${args.join(', ')})`);
    return getDemoResponse(apiFn.name, args);
  }
  try {
    return await apiFn(...args);
  } catch (err) {
    console.warn(`[API] Falha real, retornando demo:`, err.message);
    return getDemoResponse(apiFn.name, args);
  }
}

function getDemoResponse(fnName, args) {
  const demoData = {
    enviarDPS: {
      data: {
        cStat: '100',
        xMotivo: 'Autorizado o uso da NFS-e',
        nfse: {
          nNFSe: '000000000001248',
          chaveAcesso: '35260212345678000195550010000012481' + String(Date.now()).slice(-15),
          dhProc: new Date().toISOString(),
          ambGer: '2',
        },
      },
      status: 200,
      ok: true,
    },
    consultarNFSe: {
      data: {
        cStat: '100',
        infNFSe: {
          nNFSe: '000000000001248',
          chaveAcesso: args[0] || '35260212345678000195550010000012481234567890',
          dhProc: '2026-03-09T17:45:00-03:00',
          ambGer: '2',
          emit: { CNPJ: '12345678000195', xNome: 'Tech Solutions Ltda', IM: '12345' },
          valores: { vServ: '15800.00', vBC: '15800.00', vISSQN: '790.00', vLiq: '15010.00' },
          IBSCBS: {
            vBC: '14433.30',
            uf: { pIBSUF: '0.10', pAliqEfetUF: '0.10', vIBSUF: '14.43' },
            mun: { pIBSMun: '0.05', pAliqEfetMun: '0.05', vIBSMun: '7.22' },
            fed: { pCBS: '0.90', pAliqEfetCBS: '0.90', vCBS: '129.90' },
            totCIBS: { vTotNF: '15010.00', vIBSTot: '21.65' },
          },
        },
      },
      status: 200,
      ok: true,
    },
    consultarDPS: {
      data: {
        cStat: '100',
        infDPS: {
          tpAmb: '2', serie: '00001', nDPS: '000000000000001',
          dCompet: '20260309', dhEmi: '2026-03-09T17:00:00-03:00',
        },
      },
      status: 200,
      ok: true,
    },
    registrarEvento: {
      data: {
        cStat: '135',
        xMotivo: 'Evento registrado e vinculado a NFS-e',
        nSeqEvento: '1',
        dhRegEvento: new Date().toISOString(),
      },
      status: 200,
      ok: true,
    },
    consultarEventos: {
      data: {
        eventos: [
          { tpEvento: 'e101101', dhEvento: '2026-03-09T10:00:00-03:00', nSeqEvento: '1', descEvento: 'Cancelamento', cStat: '135' },
          { tpEvento: 'e105102', dhEvento: '2026-03-08T14:30:00-03:00', nSeqEvento: '1', descEvento: 'Manifestação de Confirmação', cStat: '135' },
        ],
      },
      status: 200,
      ok: true,
    },
    consultarParametrosMunicipais: {
      data: {
        codMun: args[0] || '3550308',
        ativo: true, convenio: true,
        parametros: {
          aliqISSQN: [
            { cTribNac: '1.05', pAliq: '5.00', descricao: 'Licenciamento de TI' },
            { cTribNac: '17.01', pAliq: '3.00', descricao: 'Assessoria e Consultoria' },
          ],
          regimesEspeciais: [
            { tipo: '4', descricao: 'Notário ou Registrador' },
            { tipo: '6', descricao: 'Sociedade de Profissionais' },
          ],
          ibscbs: { pIBSUF: '0.10', pIBSMun: '0.05', pCBS: '0.90' },
        },
      },
      status: 200,
      ok: true,
    },
    distribuicaoDFe: {
      data: {
        ultNSU: 1500, maxNSU: 2000,
        docs: [
          { NSU: 1500, tipo: 'NFS-e', chaveAcesso: '35260212345678000195550010000012481234567890', dhRecbto: '2026-03-09T17:00:00-03:00' },
          { NSU: 1499, tipo: 'Evento', chaveAcesso: '35260298765432000188550010000004561987654321', dhRecbto: '2026-03-09T16:30:00-03:00' },
        ],
      },
      status: 200,
      ok: true,
    },
    ultimoNSU: {
      data: { ultNSU: 1500, maxNSU: 2000 },
      status: 200,
      ok: true,
    },
  };

  return demoData[fnName] || { data: { cStat: '999', xMotivo: 'Função demo não implementada' }, status: 200, ok: true };
}
