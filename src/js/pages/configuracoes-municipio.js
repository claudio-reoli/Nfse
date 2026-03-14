/**
 * NFS-e Freire — Configurações do Município
 * Certificado Digital, dados cadastrais e ambiente de operação
 */
import { toast } from '../toast.js';
import { notifyConfigSaved } from '../config-sync.js';
import { getBackendUrl } from '../api-service.js';
import { buscarMunicipiosPorUF, formatMunicipioDisplaySync } from '../municipios-ibge.js';
import {
  loadCertificateA1,
  getCertStore,
  setCertStore,
  clearCertStore,
  isCertificateValid,
} from '../digital-signature.js';
import { maskCNPJ } from '../fiscal-utils.js';

const MUN_CERT_STORE_KEY = 'nfse_mun_cert';

/** Retorna o token JWT da sessão ativa (município usa nfse_session, igual ao contribuinte) */
function getMunToken() {
  try {
    const s = localStorage.getItem('nfse_session');
    return s ? (JSON.parse(s).token || '') : '';
  } catch { return ''; }
}

/** Headers padrão com autenticação para chamadas ao backend */
function authHeaders(extra = {}) {
  return { 'Authorization': `Bearer ${getMunToken()}`, ...extra };
}

function loadLocalCert() {
  try { return JSON.parse(localStorage.getItem(MUN_CERT_STORE_KEY)) || null; } catch { return null; }
}
function saveLocalCert(data) {
  localStorage.setItem(MUN_CERT_STORE_KEY, JSON.stringify(data));
}
function clearLocalCert() {
  localStorage.removeItem(MUN_CERT_STORE_KEY);
}

let _munCertStore = null;
export function getMunCertStore() { return _munCertStore; }

function validateMunCertificate(cfg) {
  const results = [];

  if (!cfg.certLoadedAt && !cfg.certSubject) {
    results.push({ field: 'Certificado', status: 'error', message: 'Nenhum certificado do município carregado no sistema' });
    return results;
  }
  results.push({ field: 'Carga', status: 'ok', message: `Carregado em ${cfg.certLoadedAt ? new Date(cfg.certLoadedAt).toLocaleString('pt-BR') : '—'}` });

  if (cfg.certSubject && cfg.certSubject.length > 3) {
    results.push({ field: 'Titular', status: 'ok', message: cfg.certSubject });
  } else {
    results.push({ field: 'Titular', status: 'warning', message: 'Nome do titular não identificado' });
  }

  if (cfg.certSerialNumber) {
    results.push({ field: 'Nº Série', status: 'ok', message: cfg.certSerialNumber });
  } else {
    results.push({ field: 'Nº Série', status: 'warning', message: 'Número de série não disponível' });
  }

  if (cfg.certNotBefore) {
    const nb = new Date(cfg.certNotBefore);
    const now = new Date();
    if (now >= nb) {
      results.push({ field: 'Válido desde', status: 'ok', message: nb.toLocaleDateString('pt-BR') });
    } else {
      results.push({ field: 'Válido desde', status: 'error', message: `Certificado ainda não é válido (início: ${nb.toLocaleDateString('pt-BR')})` });
    }
  } else {
    results.push({ field: 'Válido desde', status: 'warning', message: 'Data de início não disponível' });
  }

  if (cfg.certNotAfter) {
    const na = new Date(cfg.certNotAfter);
    const now = new Date();
    const diffDays = Math.ceil((na.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      results.push({ field: 'Validade', status: 'error', message: `EXPIRADO em ${na.toLocaleDateString('pt-BR')} (há ${Math.abs(diffDays)} dias)` });
    } else if (diffDays <= 5) {
      results.push({ field: 'Validade', status: 'warning', message: `Vence em ${diffDays} dia(s) — ${na.toLocaleDateString('pt-BR')}` });
    } else if (diffDays <= 30) {
      results.push({ field: 'Validade', status: 'warning', message: `Vence em ${diffDays} dias — ${na.toLocaleDateString('pt-BR')}` });
    } else {
      results.push({ field: 'Validade', status: 'ok', message: `Válido por ${diffDays} dias — até ${na.toLocaleDateString('pt-BR')}` });
    }
  } else {
    results.push({ field: 'Validade', status: 'warning', message: 'Data de expiração não disponível' });
  }

  results.push({ field: 'Tipo', status: 'ok', message: 'Certificado A1 — ICP-Brasil (e-CNPJ)' });

  if (_munCertStore && _munCertStore.privateKey) {
    results.push({ field: 'Chave Privada', status: 'ok', message: 'Chave privada RSA carregada em memória (sessão atual)' });
  } else if (cfg.certKeyAlgorithm) {
    results.push({ field: 'Chave Privada', status: 'warning', message: 'Chave em memória indisponível — recarregue o certificado para assinar' });
  } else {
    results.push({ field: 'Chave Privada', status: 'error', message: 'Chave privada não encontrada — recarregue o certificado' });
  }

  if (cfg.certKeyAlgorithm) {
    const isStrong = cfg.certKeyAlgorithm.includes('2048') || cfg.certKeyAlgorithm.includes('4096');
    results.push({ field: 'Algoritmo', status: isStrong ? 'ok' : 'warning', message: cfg.certKeyAlgorithm });
  }

  if (cfg.certIssuer) {
    results.push({ field: 'Autoridade Emissora', status: 'ok', message: cfg.certIssuer });
  }

  if (cfg.certFileName) {
    results.push({ field: 'Arquivo PFX', status: 'ok', message: cfg.certFileName });
  }

  const cnpjFromSubject = cfg.certSubject?.match(/\d{14}/)?.[0];
  const cnpjConfig = (cfg.cnpj || '').replace(/\D/g, '');
  if (cnpjFromSubject && cnpjConfig) {
    if (cnpjFromSubject === cnpjConfig) {
      results.push({ field: 'CNPJ Certificado x Cadastro', status: 'ok', message: `CNPJ ${cnpjFromSubject} confere com o cadastro do município` });
    } else {
      results.push({ field: 'CNPJ Certificado x Cadastro', status: 'error', message: `CNPJ do certificado (${cnpjFromSubject}) diverge do cadastro (${cnpjConfig})` });
    }
  }

  return results;
}

async function fetchConfig() {
  const res = await fetch(`${getBackendUrl()}/municipio/config`, {
    headers: authHeaders()
  });
  if (!res.ok) throw new Error(`Erro ao carregar configurações (HTTP ${res.status})`);
  return res.json();
}

async function saveConfig(data) {
  const res = await fetch(`${getBackendUrl()}/municipio/config`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Erro ao salvar configurações (HTTP ${res.status})`);
  return res.json();
}

export function renderConfiguracoesMunicipio(container) {
  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">Configurações do Município</h1>
        <p class="page-description">Certificado digital, dados cadastrais e ambiente de operação</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-success" id="cfg-mun-salvar-geral">Salvar Configurações</button>
      </div>
    </div>

    <!-- Certificado Digital -->
    <div class="card animate-slide-up mb-6">
      <div class="card-header">
        <h3 class="card-title">🔒 Certificado Digital ICP-Brasil (Município)</h3>
        <div style="display: flex; gap: var(--space-2);">
          <button class="btn btn-ghost btn-sm" id="cfg-mun-cert-validar">✅ Validar Certificado</button>
          <button class="btn btn-ghost btn-sm" id="cfg-mun-cert-remover">🗑 Remover</button>
        </div>
      </div>
      <div class="card-body">
        <div id="mun-cert-status-panel" style="padding: var(--space-4); background: var(--surface-glass); border-radius: var(--radius-lg); border: 1px solid var(--surface-glass-border); margin-bottom: var(--space-6);">
          <div style="display: flex; align-items: center; gap: var(--space-4);">
            <div style="width: 48px; height: 48px; border-radius: var(--radius-lg); background: rgba(239, 68, 68, 0.1); display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;">🔓</div>
            <div>
              <div style="font-weight: 600; color: var(--color-neutral-300);">Carregando...</div>
            </div>
          </div>
        </div>

        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Arquivo do Certificado (.pfx / .p12)</label>
            <input class="form-input" type="file" accept=".pfx,.p12" id="cfg-mun-cert-file">
          </div>
          <div class="form-group">
            <label class="form-label">Senha do Certificado</label>
            <div style="position: relative;">
              <input class="form-input" type="password" id="cfg-mun-cert-senha" placeholder="••••••••" autocomplete="off" style="padding-right: 40px;">
              <button type="button" id="cfg-mun-toggle-senha" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--color-neutral-500); cursor: pointer; font-size: 16px;" title="Mostrar/ocultar senha">👁</button>
            </div>
          </div>
        </div>
        <button class="btn btn-primary" id="cfg-mun-cert-carregar">🔐 Carregar Certificado</button>

        <!-- Resultado de validação -->
        <div id="mun-cert-validation-result" class="hidden" style="margin-top: var(--space-6);">
          <div class="section-title" style="font-size: var(--text-sm);">
            <span class="icon" style="width: 24px; height: 24px; font-size: var(--text-sm);">📋</span>Resultado da Validação
          </div>
          <div id="mun-cert-validation-body"></div>
        </div>
      </div>
    </div>

    <!-- Dados do Município -->
    <div class="card animate-slide-up mb-6">
      <div class="card-header">
        <h3 class="card-title">Dados Cadastrais do Município</h3>
      </div>
      <div class="card-body">

        <!-- Brasão + identificação principal -->
        <div class="form-row mb-4" style="align-items:flex-start;gap:20px;">
          <!-- Upload do Brasão -->
          <div style="display:flex;flex-direction:column;align-items:center;gap:8px;min-width:110px;">
            <div id="brasao-preview-wrap" style="width:90px;height:90px;border:2px dashed var(--surface-glass-border);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--surface-glass);">
              <img id="brasao-preview" src="" alt="" style="max-width:86px;max-height:86px;object-fit:contain;display:none;">
              <span id="brasao-placeholder" style="font-size:28px;">🏛️</span>
            </div>
            <label class="btn btn-ghost btn-sm" style="cursor:pointer;font-size:0.75rem;padding:3px 10px;">
              📂 Carregar Brasão
              <input type="file" id="cfg-mun-brasao-file" accept="image/*" style="display:none;">
            </label>
            <button class="btn btn-ghost btn-sm" id="btn-brasao-remover" style="font-size:0.72rem;padding:2px 8px;display:none;">✕ Remover</button>
            <input type="hidden" id="cfg-mun-brasao">
            <span class="form-help" style="text-align:center;font-size:0.7rem;">PNG/JPG/SVG recomendado</span>
          </div>
          <!-- Nome e Prefeitura -->
          <div style="flex:1;display:flex;flex-direction:column;gap:12px;">
            <div class="form-group" style="margin:0;">
              <label class="form-label">Nome do Município <span class="required">*</span></label>
              <input class="form-input" id="cfg-mun-nome" type="text" maxlength="100" placeholder="Ex: MUNICIPIO DE UTINGA - BA">
              <span class="form-help">Usado no cabeçalho do DANFSe</span>
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label">Nome da Prefeitura</label>
              <input class="form-input" id="cfg-mun-prefeitura" type="text" maxlength="150" placeholder="Ex: PREFEITURA MUNICIPAL DE UTINGA - BA">
              <span class="form-help">Linha complementar no cabeçalho do DANFSe</span>
            </div>
          </div>
        </div>

        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">CNPJ do Município</label>
            <input class="form-input form-input-mono" id="cfg-mun-cnpj" type="text" maxlength="18" placeholder="00.000.000/0000-00">
          </div>
          <div class="form-group">
            <label class="form-label">UF</label>
            <input class="form-input" id="cfg-mun-uf" type="text" maxlength="2" placeholder="BA" style="text-transform: uppercase;">
          </div>
        </div>
        <div class="form-row mb-4">
          <div class="form-group" style="flex: 1;">
            <label class="form-label">Município (IBGE)</label>
            <div class="municipio-select-wrapper">
              <input type="text" class="form-input municipio-display" id="cfg-mun-ibge-display"
                placeholder="Selecione UF e busque por nome..." list="cfg-mun-ibge-list" autocomplete="off">
              <input type="hidden" id="cfg-mun-ibge">
              <datalist id="cfg-mun-ibge-list"></datalist>
            </div>
            <span class="form-help">Exibição: Nome (UF) — IBGE: código — facilita busca pelo nome</span>
          </div>
        </div>
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Inscrição Estadual</label>
            <input class="form-input form-input-mono" id="cfg-mun-ie" type="text" maxlength="15">
          </div>
          <div class="form-group">
            <label class="form-label">E-mail Institucional</label>
            <input class="form-input" id="cfg-mun-email" type="email" maxlength="100" placeholder="sefin@municipio.ba.gov.br">
          </div>
        </div>
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Telefone</label>
            <input class="form-input" id="cfg-mun-telefone" type="text" maxlength="20" placeholder="(00) 0000-0000">
          </div>
          <div class="form-group">
            <label class="form-label">Endereço</label>
            <input class="form-input" id="cfg-mun-endereco" type="text" maxlength="200">
          </div>
        </div>
      </div>
    </div>

    <!-- Ambiente -->
    <div class="card animate-slide-up mb-6">
      <div class="card-header">
        <h3 class="card-title">Ambiente de Operação</h3>
      </div>
      <div class="card-body">
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Ambiente</label>
            <select class="form-select" id="cfg-mun-ambiente">
              <option value="sandbox">Produção Restrita (Sandbox)</option>
              <option value="production">Produção</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">URL Sefin Nacional</label>
            <input class="form-input form-input-mono" id="cfg-mun-url-sefin" type="text" readonly>
          </div>
        </div>
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">URL ADN (Ambiente de Dados Nacional)</label>
            <input class="form-input form-input-mono" id="cfg-mun-url-adn" type="text" readonly>
          </div>
        </div>
        <div class="form-row mb-4">
          <div class="form-group flex-1">
            <label class="form-label">URL ADN Municípios (override)</label>
            <input class="form-input form-input-mono" id="cfg-mun-url-adn-mun" type="text" placeholder="Ex: https://adn.nfse.gov.br ou https://adn.nfse.gov.br/dfe (deixe vazio para padrão)">
            <small class="form-hint">Se 404 persistir, tente: Produção <code>https://adn.nfse.gov.br</code> ou Sandbox <code>https://adn.producaorestrita.nfse.gov.br</code></small>
          </div>
        </div>
      </div>
    </div>
  `;

  // ═══ LOAD CONFIG FROM BACKEND ═══════════════
  let _lastLoadedConfig = null;
  (async () => {
    try {
      const config = await fetchConfig();
      _lastLoadedConfig = config;
      populateForm(config);
      renderCertPanel(config);
    } catch (err) {
      toast.error('Falha ao carregar configurações do município.');
    }
  })();

  function populateForm(cfg) {
    const el = (id) => document.getElementById(id);
    if (cfg.cnpj) el('cfg-mun-cnpj').value = maskCNPJ(cfg.cnpj);
    if (cfg.nome) el('cfg-mun-nome').value = cfg.nome;
    if (cfg.prefeitura) el('cfg-mun-prefeitura').value = cfg.prefeitura;
    if (cfg.ibge) {
      el('cfg-mun-ibge').value = cfg.ibge;
      const displayEl = el('cfg-mun-ibge-display');
      if (displayEl) displayEl.value = formatMunicipioDisplaySync(cfg.ibge, cfg.nome, cfg.uf);
    }
    if (cfg.uf) el('cfg-mun-uf').value = cfg.uf;
    if (cfg.inscEstadual) el('cfg-mun-ie').value = cfg.inscEstadual;
    if (cfg.email) el('cfg-mun-email').value = cfg.email;
    if (cfg.telefone) el('cfg-mun-telefone').value = cfg.telefone;
    if (cfg.endereco) el('cfg-mun-endereco').value = cfg.endereco;
    if (cfg.ambiente) el('cfg-mun-ambiente').value = cfg.ambiente;
    if (el('cfg-mun-url-adn-mun')) el('cfg-mun-url-adn-mun').value = cfg.urlAdnMun || '';
    updateAmbUrls(cfg.ambiente || 'sandbox');
    // Brasão
    if (cfg.brasao) {
      el('cfg-mun-brasao').value = cfg.brasao;
      const img = el('brasao-preview');
      const ph  = el('brasao-placeholder');
      const btn = el('btn-brasao-remover');
      if (img) { img.src = cfg.brasao; img.style.display = 'block'; }
      if (ph)  ph.style.display = 'none';
      if (btn) btn.style.display = '';
    }
  }

  function updateAmbUrls(amb) {
    const sefin = amb === 'production' ? 'sefin.nfse.gov.br' : 'sefin.producaorestrita.nfse.gov.br';
    const adn = amb === 'production' ? 'adn.nfse.gov.br' : 'adn.producaorestrita.nfse.gov.br';
    const elSefin = document.getElementById('cfg-mun-url-sefin');
    const elAdn = document.getElementById('cfg-mun-url-adn');
    if (elSefin) elSefin.value = sefin;
    if (elAdn) elAdn.value = adn;
  }

  document.getElementById('cfg-mun-ambiente')?.addEventListener('change', (e) => {
    updateAmbUrls(e.target.value);
  });

  document.getElementById('cfg-mun-cnpj')?.addEventListener('input', (e) => {
    e.target.value = maskCNPJ(e.target.value);
  });

  // ── Upload do Brasão (com compressão automática via canvas) ────
  document.getElementById('cfg-mun-brasao-file')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const original = new Image();
      original.onload = () => {
        // Redimensiona para no máximo 160×160 px mantendo proporção
        const MAX = 160;
        let w = original.width;
        let h = original.height;
        if (w > MAX || h > MAX) {
          if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
          else        { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(original, 0, 0, w, h);
        // PNG para brasões com fundo transparente, qualidade razoável
        const dataUrl = canvas.toDataURL('image/png');
        document.getElementById('cfg-mun-brasao').value = dataUrl;
        const img = document.getElementById('brasao-preview');
        const ph  = document.getElementById('brasao-placeholder');
        const btn = document.getElementById('btn-brasao-remover');
        if (img) { img.src = dataUrl; img.style.display = 'block'; }
        if (ph)  ph.style.display = 'none';
        if (btn) btn.style.display = '';
      };
      original.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btn-brasao-remover')?.addEventListener('click', () => {
    document.getElementById('cfg-mun-brasao').value = '';
    const img = document.getElementById('brasao-preview');
    const ph  = document.getElementById('brasao-placeholder');
    const btn = document.getElementById('btn-brasao-remover');
    if (img) { img.src = ''; img.style.display = 'none'; }
    if (ph)  ph.style.display = '';
    if (btn) btn.style.display = 'none';
    const fileInput = document.getElementById('cfg-mun-brasao-file');
    if (fileInput) fileInput.value = '';
  });

  // Município: carrega lista por UF e vincula seleção
  const ufEl = document.getElementById('cfg-mun-uf');
  const displayEl = document.getElementById('cfg-mun-ibge-display');
  const hiddenEl = document.getElementById('cfg-mun-ibge');
  const datalistEl = document.getElementById('cfg-mun-ibge-list');
  const nomeEl = document.getElementById('cfg-mun-nome');

  const loadMunOptions = async () => {
    const uf = ufEl?.value?.trim().toUpperCase();
    if (!uf || uf.length !== 2 || !datalistEl) return;
    try {
      const lista = await buscarMunicipiosPorUF(uf);
      datalistEl.innerHTML = lista.map(m => `<option value="${m.display}" data-code="${m.id}" data-nome="${(m.nome || '').replace(/"/g, '&quot;')}">`).join('');
    } catch (_) {}
  };

  ufEl?.addEventListener('change', loadMunOptions);
  ufEl?.addEventListener('blur', loadMunOptions);

  displayEl?.addEventListener('change', () => {
    const opt = Array.from(datalistEl?.querySelectorAll('option') || []).find(o => o.value === displayEl.value);
    if (opt) {
      hiddenEl.value = opt.dataset.code || '';
      if (nomeEl) nomeEl.value = opt.dataset.nome || nomeEl.value;
    }
  });
  displayEl?.addEventListener('input', () => {
    const opt = Array.from(datalistEl?.querySelectorAll('option') || []).find(o => o.value === displayEl.value);
    hiddenEl.value = opt ? (opt.dataset.code || '') : displayEl.value.replace(/\D/g, '').slice(0, 7);
  });

  // ═══ CERT PANEL RENDER ═══════════════════════
  function renderCertPanel(cfg) {
    const panel = document.getElementById('mun-cert-status-panel');
    if (!panel) return;

    if (!cfg.certSubject) {
      panel.innerHTML = `
        <div style="display: flex; align-items: center; gap: var(--space-4);">
          <div style="width: 48px; height: 48px; border-radius: var(--radius-lg); background: rgba(239, 68, 68, 0.1); display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;">🔓</div>
          <div>
            <div style="font-weight: 600; color: var(--color-neutral-300);">Nenhum certificado do município carregado</div>
            <div style="font-size: var(--text-xs); color: var(--color-neutral-500);">Carregue o e-CNPJ do município (.pfx/.p12) para habilitar a importação ADN</div>
          </div>
        </div>`;
      return;
    }

    const na = cfg.certNotAfter ? new Date(cfg.certNotAfter) : null;
    const now = new Date();
    const diffDays = na ? Math.ceil((na.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

    let statusColor, statusBg, statusIcon, statusText;
    if (diffDays !== null && diffDays <= 0) {
      statusColor = 'var(--color-danger-400)'; statusBg = 'rgba(239, 68, 68, 0.1)';
      statusIcon = '🚫'; statusText = `EXPIRADO há ${Math.abs(diffDays)} dias`;
    } else if (diffDays !== null && diffDays <= 30) {
      statusColor = 'var(--color-warning-400)'; statusBg = 'rgba(245, 158, 11, 0.1)';
      statusIcon = '⚠️'; statusText = `Vence em ${diffDays} dias`;
    } else {
      statusColor = 'var(--color-accent-400)'; statusBg = 'rgba(16, 185, 129, 0.1)';
      statusIcon = '✅'; statusText = diffDays ? `Válido por ${diffDays} dias` : 'Carregado';
    }

    panel.innerHTML = `
      <div style="display: flex; align-items: center; gap: var(--space-4);">
        <div style="width: 48px; height: 48px; border-radius: var(--radius-lg); background: ${statusBg}; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;">${statusIcon}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 700; color: ${statusColor}; margin-bottom: 2px;">${statusText}</div>
          <div style="font-size: var(--text-sm); color: var(--color-neutral-300);">${cfg.certSubject}</div>
          <div style="font-size: var(--text-xs); color: var(--color-neutral-500); margin-top: 2px;">Nº Série: ${cfg.certSerialNumber || '—'}</div>
        </div>
        <div style="padding: var(--space-3); background: var(--surface-glass); border-radius: var(--radius-md); border: 1px solid var(--surface-glass-border); min-width: 200px; flex-shrink: 0;">
          <div style="font-size: var(--text-xs); color: var(--color-neutral-500); text-transform: uppercase; margin-bottom: var(--space-2); font-weight: 600;">Validade</div>
          <div style="display: flex; flex-direction: column; gap: var(--space-1); font-size: var(--text-xs);">
            <div style="display: flex; justify-content: space-between; gap: var(--space-4);">
              <span style="color: var(--color-neutral-500);">Início</span>
              <span style="color: var(--color-neutral-300); font-weight: 500;">${cfg.certNotBefore ? new Date(cfg.certNotBefore).toLocaleDateString('pt-BR') : '—'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: var(--space-4);">
              <span style="color: var(--color-neutral-500);">Fim</span>
              <span style="color: ${statusColor}; font-weight: 600;">${cfg.certNotAfter ? new Date(cfg.certNotAfter).toLocaleDateString('pt-BR') : '—'}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ═══ TOGGLE SENHA ═══════════════════════════
  document.getElementById('cfg-mun-toggle-senha')?.addEventListener('click', () => {
    const inp = document.getElementById('cfg-mun-cert-senha');
    const btn = document.getElementById('cfg-mun-toggle-senha');
    if (inp) {
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      if (btn) btn.textContent = show ? '🙈' : '👁';
    }
  });

  // ═══ VALIDAR CERTIFICADO ═══════════════════
  document.getElementById('cfg-mun-cert-validar')?.addEventListener('click', async () => {
    let cfg = _lastLoadedConfig;
    if (!cfg) {
      try { cfg = await fetchConfig(); } catch { /* ignore */ }
    }
    if (!cfg) {
      toast.error('Não foi possível carregar a configuração do município.');
      return;
    }

    const results = validateMunCertificate(cfg);

    const container = document.getElementById('mun-cert-validation-result');
    const body = document.getElementById('mun-cert-validation-body');
    if (!container || !body) return;

    container.classList.remove('hidden');

    const statusIcon = { ok: '✅', warning: '⚠️', error: '❌' };
    const statusColor = {
      ok: 'var(--color-accent-400)',
      warning: 'var(--color-warning-400)',
      error: 'var(--color-danger-400)',
    };

    body.innerHTML = `
      <table class="data-table">
        <thead>
          <tr><th>Verificação</th><th>Status</th><th>Detalhe</th></tr>
        </thead>
        <tbody>
          ${results.map(r => `
            <tr>
              <td style="font-weight: 600;">${r.field}</td>
              <td style="text-align: center;">${statusIcon[r.status]}</td>
              <td style="color: ${statusColor[r.status]}; font-size: var(--text-sm);">${r.message}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="margin-top: var(--space-4); padding: var(--space-3); border-radius: var(--radius-md); background: ${
        results.every(r => r.status === 'ok')
          ? 'rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.15); color: var(--color-accent-400);'
          : results.some(r => r.status === 'error')
            ? 'rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.15); color: var(--color-danger-400);'
            : 'rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.15); color: var(--color-warning-400);'
      } font-size: var(--text-sm); font-weight: 600; text-align: center;">
        ${results.every(r => r.status === 'ok')
          ? '✅ Todas as verificações passaram — Certificado válido e pronto para uso'
          : results.some(r => r.status === 'error')
            ? '❌ Certificado com problemas críticos — Corrija antes de usar'
            : '⚠️ Certificado com alertas — Verifique os itens acima'}
      </div>
    `;

    const hasErrors = results.some(r => r.status === 'error');
    const hasWarnings = results.some(r => r.status === 'warning');
    if (hasErrors) toast.error('Certificado com problemas críticos!');
    else if (hasWarnings) toast.warning('Certificado validado com alertas.');
    else toast.success('✅ Certificado válido e pronto para uso!');
  });

  // ═══ CARREGAR CERTIFICADO ═══════════════════
  document.getElementById('cfg-mun-cert-carregar')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('cfg-mun-cert-file');
    const senha = document.getElementById('cfg-mun-cert-senha')?.value;

    if (!fileInput?.files?.length) {
      toast.error('Selecione o arquivo do certificado (.pfx / .p12).');
      return;
    }
    if (!senha) {
      toast.error('Informe a senha do certificado.');
      return;
    }

    toast.info('Carregando certificado do município...');

    try {
      const file = fileInput.files[0];
      const buffer = await file.arrayBuffer();
      const certData = await loadCertificateA1(buffer, senha);

      _munCertStore = certData;

      const now = new Date().toISOString();
      const certPayload = {
        certSubject: certData.subject,
        certSerialNumber: certData.serialNumber,
        certNotBefore: certData.notBefore,
        certNotAfter: certData.notAfter,
        certLoadedAt: now,
        certFileName: file.name,
        certKeyAlgorithm: certData.keyAlgorithm || '',
        certIssuer: certData.issuer || '',
      };

      const uploadRes = await fetch(`${getBackendUrl()}/municipio/upload-cert`, {
        method: 'POST',
        headers: authHeaders({
          'Content-Type': 'application/octet-stream',
          'X-Cert-Passphrase': senha
        }),
        body: new Uint8Array(buffer)
      });
      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        throw new Error(errData.error || `Upload falhou (HTTP ${uploadRes.status})`);
      }

      const result = await saveConfig(certPayload);
      if (result.sucesso) {
        _lastLoadedConfig = result.config;
        renderCertPanel(result.config);
        saveLocalCert({ subject: certData.subject, serialNumber: certData.serialNumber });
        document.getElementById('mun-cert-validation-result')?.classList.add('hidden');
        toast.success('Certificado do município carregado e disponível para integração ADN!');
      }
    } catch (err) {
      toast.error(`Falha ao carregar certificado: ${err.message}`);
    }
  });

  // ═══ REMOVER CERTIFICADO ════════════════════
  document.getElementById('cfg-mun-cert-remover')?.addEventListener('click', async () => {
    if (!confirm('Deseja remover o certificado do município?')) return;

    _munCertStore = null;
    clearLocalCert();

    try {
      const result = await saveConfig({
        certSubject: '', certSerialNumber: '', certNotBefore: '', certNotAfter: '',
        certLoadedAt: '', certFileName: '', certKeyAlgorithm: '', certIssuer: ''
      });
      if (result.sucesso) renderCertPanel(result.config);
      toast.info('Certificado do município removido.');
    } catch {
      toast.error('Falha ao remover certificado.');
    }
  });

  // ═══ SALVAR CONFIGURAÇÕES GERAIS ═══════════
  document.getElementById('cfg-mun-salvar-geral')?.addEventListener('click', async () => {
    const val = (id) => document.getElementById(id)?.value?.trim() || '';

    const payload = {
      cnpj: val('cfg-mun-cnpj'),
      nome: val('cfg-mun-nome'),
      prefeitura: val('cfg-mun-prefeitura'),
      brasao: document.getElementById('cfg-mun-brasao')?.value || '',
      ibge: val('cfg-mun-ibge'),
      uf: val('cfg-mun-uf').toUpperCase(),
      inscEstadual: val('cfg-mun-ie'),
      email: val('cfg-mun-email'),
      telefone: val('cfg-mun-telefone'),
      endereco: val('cfg-mun-endereco'),
      ambiente: val('cfg-mun-ambiente'),
      urlAdnMun: val('cfg-mun-url-adn-mun'),
    };

    if (!payload.ibge) {
      toast.warning('O código IBGE é obrigatório.');
      return;
    }

    try {
      const result = await saveConfig(payload);
      if (result.sucesso) {
        toast.success('Configurações do município salvas com sucesso!');
        notifyConfigSaved();
      }
    } catch {
      toast.error('Falha ao salvar configurações.');
    }
  });
}
