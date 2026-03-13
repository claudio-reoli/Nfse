/**
 * NFS-e Freire — Municípios IBGE
 * Formatação de exibição: Nome (UF) — IBGE: código
 * Suporte a endereços estrangeiros (tomadores/intermediários)
 */

const IBGE_BASE = 'https://servicodados.ibge.gov.br/api/v1/localidades';
const cache = new Map(); // codigo -> { nome, uf }
let cacheEstados = null;

/**
 * Formata município para exibição: "Nome (UF) — IBGE: 1234567"
 * @param {string} codigo - Código IBGE 7 dígitos
 * @param {string} [nome] - Nome do município (opcional, busca na API se ausente)
 * @param {string} [uf] - Sigla UF (opcional)
 * @returns {Promise<string>} Texto formatado
 */
export async function formatMunicipioDisplay(codigo, nome, uf) {
  if (!codigo || String(codigo).replace(/\D/g, '').length < 7) return '—';
  const cod = String(codigo).replace(/\D/g, '').padStart(7, '0');
  if (nome && uf) return `${nome} (${uf}) — IBGE: ${cod}`;
  const cached = cache.get(cod);
  if (cached) return `${cached.nome} (${cached.uf}) — IBGE: ${cod}`;
  try {
    const m = await fetchMunicipioByCodigo(cod);
    if (m) return `${m.nome} (${m.uf}) — IBGE: ${cod}`;
  } catch (_) {}
  return `Código IBGE: ${cod}`;
}

/**
 * Versão síncrona — usa cache ou retorna formato simples
 */
export function formatMunicipioDisplaySync(codigo, nome, uf) {
  if (!codigo || String(codigo).replace(/\D/g, '').length < 7) return '—';
  const cod = String(codigo).replace(/\D/g, '').padStart(7, '0');
  if (nome && uf) return `${nome} (${uf}) — IBGE: ${cod}`;
  const cached = cache.get(cod);
  if (cached) return `${cached.nome} (${cached.uf}) — IBGE: ${cod}`;
  return `Código IBGE: ${cod}`;
}

/**
 * Formata endereço com município — trata estrangeiro (cPais != BR)
 */
export function formatEnderecoMunicipio(end, xLocEmissor) {
  if (!end) return '';
  const cPais = end.cPais || end.cPaisPrestacao;
  if (cPais && String(cPais).toUpperCase() !== 'BR') {
    return `Exterior — País: ${cPais}`;
  }
  const cMun = end.cMun || end.cLocIncid || end.cLocPrestacao || end.cLocEmi;
  if (cMun) return formatMunicipioDisplaySync(cMun, end.xMun || end.xLocIncid || xLocEmissor, end.UF || end.uf);
  return '';
}

/**
 * Formata para exibição quando é estrangeiro
 */
export function formatEstrangeiroDisplay(cPais, xCidade, xEstProv) {
  if (!cPais || String(cPais).toUpperCase() === 'BR') return null;
  const parts = [`Exterior — País: ${cPais}`];
  if (xCidade) parts.push(xCidade);
  if (xEstProv) parts.push(xEstProv);
  return parts.join(' / ');
}

/**
 * Busca município por código na API IBGE
 */
async function fetchMunicipioByCodigo(cod) {
  const codNum = parseInt(cod, 10);
  if (isNaN(codNum)) return null;
  try {
    const res = await fetch(`${IBGE_BASE}/municipios/${codNum}`);
    if (!res.ok) return null;
    const data = await res.json();
    const uf = data.microrregiao?.mesorregiao?.UF?.sigla || data['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla || '';
    const nome = data.nome || '';
    if (nome) cache.set(cod, { nome, uf });
    return { nome, uf };
  } catch (_) {
    return null;
  }
}

/**
 * Lista municípios por UF para componente de seleção
 * @param {string} ufSigla - Sigla do estado (ex: SP, BA)
 * @returns {Promise<Array<{id:string,nome:string,uf:string}>>}
 */
export async function listarMunicipiosPorUF(ufSigla) {
  if (!ufSigla || ufSigla.length !== 2) return [];
  const estados = await fetchEstados();
  const estado = estados.find(e => e.sigla === ufSigla.toUpperCase());
  if (!estado) return [];
  try {
    const res = await fetch(`${IBGE_BASE}/estados/${estado.id}/municipios`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(m => {
      const id = String(m.id);
      const uf = m.microrregiao?.mesorregiao?.UF?.sigla || ufSigla.toUpperCase();
      if (id && m.nome) cache.set(id.padStart(7, '0'), { nome: m.nome, uf });
      return { id: id.padStart(7, '0'), nome: m.nome, uf };
    }).sort((a, b) => a.nome.localeCompare(b.nome));
  } catch (_) {
    return [];
  }
}

/**
 * Busca municípios por UF (para select/datalist)
 * @param {string} ufSigla - Sigla do estado
 * @returns {Promise<Array<{id:string,nome:string,uf:string,display:string}>>}
 */
export async function buscarMunicipiosPorUF(ufSigla) {
  const lista = await listarMunicipiosPorUF(ufSigla);
  return lista.map(m => ({ ...m, display: `${m.nome} (${m.uf}) — IBGE: ${m.id}` }));
}

async function fetchEstados() {
  if (cacheEstados) return cacheEstados;
  const res = await fetch(`${IBGE_BASE}/estados`);
  if (!res.ok) return [];
  cacheEstados = await res.json();
  return cacheEstados;
}

/**
 * Popula cache com dados conhecidos (evita chamadas desnecessárias)
 */
export function preencherCache(items) {
  items.forEach(({ codigo, nome, uf }) => {
    const cod = String(codigo).replace(/\D/g, '').padStart(7, '0');
    if (cod && nome) cache.set(cod, { nome, uf: uf || '' });
  });
}

/**
 * Cria HTML para input de município com datalist (busca por Nome/UF)
 * @param {string} inputId - ID do input que armazena o código
 * @param {string} datalistId - ID do datalist
 * @param {string} [placeholder] - Placeholder
 * @param {boolean} [required] - Campo obrigatório
 */
export function createMunicipioSelectHTML(inputId, datalistId, placeholder = 'Buscar por nome ou UF...', required = false) {
  return `
    <div class="municipio-select-wrapper" data-input-id="${inputId}">
      <input type="text" class="form-input municipio-display" id="${inputId}-display"
        placeholder="${placeholder}" autocomplete="off" ${required ? 'required' : ''}
        list="${datalistId}" data-datalist="${datalistId}">
      <input type="hidden" id="${inputId}" name="${inputId}">
      <datalist id="${datalistId}"></datalist>
    </div>
  `;
}

/**
 * Inicializa componente de município: carrega opções por UF e vincula eventos
 * @param {string} inputId - ID do input hidden
 * @param {string} ufInputId - ID do input/select de UF (opcional)
 * @param {string} [ufFixo] - UF fixa quando não há seletor de UF
 */
export async function initMunicipioSelect(inputId, ufInputId, ufFixo) {
  const displayEl = document.getElementById(`${inputId}-display`);
  const hiddenEl = document.getElementById(inputId);
  const datalistEl = document.getElementById(displayEl?.dataset?.datalist || inputId.replace(/-/g, '') + '-list');
  if (!displayEl || !hiddenEl || !datalistEl) return;

  const loadOptions = async (uf) => {
    const ufVal = uf || (ufInputId && document.getElementById(ufInputId)?.value) || ufFixo;
    if (!ufVal || ufVal.length !== 2) return;
    const lista = await buscarMunicipiosPorUF(ufVal);
    datalistEl.innerHTML = lista.map(m => `<option value="${m.display}" data-code="${m.id}">`).join('');
  };

  displayEl.addEventListener('focus', () => loadOptions());
  displayEl.addEventListener('change', () => {
    const opt = Array.from(datalistEl.querySelectorAll('option')).find(o => o.value === displayEl.value);
    if (opt) hiddenEl.value = opt.dataset.code || '';
  });
  displayEl.addEventListener('input', () => {
    const opt = Array.from(datalistEl.querySelectorAll('option')).find(o => o.value === displayEl.value);
    hiddenEl.value = opt ? (opt.dataset.code || '') : displayEl.value.replace(/\D/g, '').slice(0, 7);
  });

  if (ufInputId) {
    document.getElementById(ufInputId)?.addEventListener('change', (e) => loadOptions(e.target.value));
  }
  if (ufFixo) loadOptions(ufFixo);
}

/**
 * Atualiza display do município a partir do código (para exibição de valor salvo)
 */
export async function setMunicipioDisplayFromCode(inputId, codigo) {
  const displayEl = document.getElementById(`${inputId}-display`);
  const hiddenEl = document.getElementById(inputId);
  if (!displayEl || !hiddenEl) return;
  if (codigo) {
    hiddenEl.value = String(codigo).replace(/\D/g, '').padStart(7, '0');
    displayEl.value = await formatMunicipioDisplay(codigo);
  }
}
