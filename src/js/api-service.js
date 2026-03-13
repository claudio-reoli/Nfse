/**
 * NFS-e Freire — API Service Layer (Production Ready)
 * Client para APIs Sefin Nacional, ADN e Backend Próprio
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
let demoMode = false;

export function setEnvironment(env) {
  currentEnv = env === 'production' ? 'production' : 'sandbox';
}

export function getEnvironment() {
  return currentEnv;
}

export function setDemoMode(mode) {
  demoMode = !!mode;
}

export function isDemoMode() {
  return demoMode;
}

const BACKEND_ORIGIN = (() => {
  const o = window.location.origin;
  if (o && o !== 'null' && !o.startsWith('file:')) return o;
  return 'http://localhost:3099';
})();

export function getBackendUrl() {
  return `${BACKEND_ORIGIN}/api`;
}

function getBaseUrl(api) {
  if (api === 'backend') return `${BACKEND_ORIGIN}/api`;
  return `${BACKEND_ORIGIN}/api/proxy/${api}`;
}

// ─── HTTP Client ────────────────────────────────
async function apiRequest(baseApi, path, options = {}) {
  const url = `${getBaseUrl(baseApi)}${path}`;
  
  // Auth Header from LocalStorage
  const session = JSON.parse(localStorage.getItem('nfse_session') || '{}');
  const token = session.token;

  const defaultHeaders = {
    'Content-Type': options.contentType || 'application/json',
    'Accept': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  const timeoutMs = options.timeout ?? 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const config = {
    ...options,
    method: options.method || 'GET',
    headers: { ...defaultHeaders, ...options.headers },
    signal: controller.signal
  };

  if (options.body && typeof options.body === 'object' && config.headers['Content-Type'] === 'application/json') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    clearTimeout(timeoutId);
    const data = response.headers.get('content-type')?.includes('json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new ApiError(`Error ${response.status}: ${data?.error || response.statusText}`, response.status, data);
    }
    return { data, status: response.status, ok: true };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof ApiError) throw err;
    if (err.name === 'AbortError') {
      throw new ApiError('Sistema não respondeu no prazo. Tente novamente.', 0, null);
    }
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
// BACKEND PROPRIO — APIs
// ════════════════════════════════════════════════

export async function login(cpf, password) {
  return apiRequest('backend', '/auth/login', { method: 'POST', body: { cpf, password } });
}

export async function loginByCertificate(certificateB64, subject, cnpj) {
  return apiRequest('backend', '/auth/login-cert', { method: 'POST', body: { certificateB64, subject, cnpj } });
}

export async function getDashboardStats(cnpj) {
  return apiRequest('backend', `/dashboard/stats?cnpj=${cnpj || ''}`);
}

export async function getHealthStatus() {
  return apiRequest('backend', '/health');
}

export async function getConfigAmbiente() {
  return apiRequest('backend', '/config/ambiente');
}

/** Busca ambiente do município com fallback para /municipio/config. Retorna { ambiente, urlSefin, urlAdn } ou null. */
export async function fetchConfigAmbiente() {
  const base = getBackendUrl();
  const tryFetch = async (path) => {
    const res = await fetch(`${base}${path}?t=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
    const ct = res.headers.get('content-type') || '';
    return res.ok && ct.includes('json') ? await res.json() : null;
  };
  let data = await tryFetch('/config/ambiente');
  if (!data || !(data.ambiente || data.urlSefin || data.urlAdn)) {
    const full = await tryFetch('/municipio/config');
    if (full?.ambiente) {
      const amb = full.ambiente;
      data = {
        ambiente: amb,
        urlSefin: amb === 'production' ? 'sefin.nfse.gov.br' : 'sefin.producaorestrita.nfse.gov.br',
        urlAdn: amb === 'production' ? 'adn.nfse.gov.br' : 'adn.producaorestrita.nfse.gov.br',
      };
    }
  }
  return data;
}

export async function getUsers(filter = {}) {
  const qs = filter.type ? `?type=${encodeURIComponent(filter.type)}` : '';
  return apiRequest('backend', `/users${qs}`);
}

export async function createUser(userData) {
  return apiRequest('backend', '/users', { method: 'POST', body: userData });
}

export async function updateUser(cpf, data) {
  return apiRequest('backend', `/users/${encodeURIComponent(cpf)}`, { method: 'PUT', body: data });
}

export async function deleteUser(cpf) {
  return apiRequest('backend', `/users/${cpf}`, { method: 'DELETE' });
}

// ════════════════════════════════════════════════
// SEFIN NACIONAL — APIs
// ════════════════════════════════════════════════

export async function enviarDPS(dpsXml) {
  return apiRequest('sefin', '/nfse', { method: 'POST', contentType: 'application/xml', body: dpsXml });
}

/** Consulta NFS-e no banco local (evita 403 da Sefin sem certificado) */
export async function consultarNFSeLocal(chaveAcesso) {
  return apiRequest('backend', `/nfse/${encodeURIComponent(chaveAcesso.replace(/\D/g, ''))}`);
}

export async function consultarNFSe(chaveAcesso) {
  return apiRequest('sefin', `/nfse/${chaveAcesso}`);
}

export async function registrarEvento(chaveAcesso, evento) {
  return apiRequest('sefin', `/nfse/${chaveAcesso}/eventos`, { method: 'POST', body: evento });
}

// ════════════════════════════════════════════════
// ADN — Ambiente de Dados Nacional
// ════════════════════════════════════════════════

export async function consultarDPS(dpsId) {
  return apiRequest('sefin', `/dps/${dpsId}`);
}

export async function distribuicaoDFe(nsu) {
  return apiRequest('adn', `/DFe/${nsu}`);
}

export async function ultimoNSU() {
  return apiRequest('adn', '/DFe');
}

export async function adnEventos(chaveAcesso) {
  return apiRequest('adn', `/eventos/${chaveAcesso}`);
}

export async function downloadDANFSe(chaveAcesso) {
  const url = `${getBaseUrl('adn')}/danfse/${chaveAcesso}`;
  const response = await fetch(url, { headers: { 'Accept': 'application/pdf' } });
  if (!response.ok) throw new ApiError('Falha ao baixar DANFSe', response.status, null);
  return await response.blob();
}

// ════════════════════════════════════════════════
// SIMULAÇÃO (Demo Mode / SafeFetch)
// ════════════════════════════════════════════════

export async function safeFetch(apiFn, ...args) {
  if (demoMode) {
    return getDemoResponse(apiFn.name, args);
  }
  // No demo mode, we strictly try the real API.
  // We only fallback to demo if the API is known to be a simulation (like in production-stage testing)
  // But here we'll throw the real error to avoid masking Production bugs.
  try {
    return await apiFn(...args);
  } catch (err) {
    console.error(`[API] Erro Real em ${apiFn.name}:`, err.message);
    throw err; // REQUISITO AUDITORIA ITEM 5: Não mascarar erro em produção
  }
}

function getDemoResponse(fnName, args) {
  const demoData = {
    enviarDPS: { data: { cStat: '100', xMotivo: 'Autorizado (Simulado)', nfse: { nNFSe: '123', chaveAcesso: '35...', dhProc: new Date().toISOString() } }, status: 200, ok: true },
    getDashboardStats: { data: { emitidas: 15, aprovadas: 15, pendentes: 0, canceladas: 0, recentes: [] }, status: 200, ok: true }
  };
  return demoData[fnName] || { data: { error: 'Mock not found' }, status: 200, ok: true };
}

// ════════════════════════════════════════════════
// BUSCA CNPJ (Externo)
// ════════════════════════════════════════════════
export async function consultarCNPJ(cnpj) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj.replace(/\D/g, '')}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error('Falha na consulta do CNPJ');
    const data = await res.json();
    return { razaoSocial: data.razao_social, fantasia: data.nome_fantasia || data.razao_social, logradouro: data.logradouro, numero: data.numero, municipio: data.municipio, uf: data.uf, codigoIbge: data.codigo_municipio };
  } catch (e) {
    clearTimeout(t);
    if (e.name === 'AbortError') throw new Error('Consulta CNPJ não respondeu no prazo.');
    throw e;
  }
}
