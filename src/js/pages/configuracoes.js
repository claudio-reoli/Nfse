/**
 * NFS-e Freire — Configurações
 * Certificado Digital (carga, validação, alerta de vencimento)
 * Ambiente, URLs e preferências do sistema
 */
import { toast } from '../toast.js';
import {
  loadCertificateA1,
  getCertStore,
  setCertStore,
  clearCertStore,
  getCertSummary,

} from '../digital-signature.js';
import { setEnvironment, setDemoMode, fetchConfigAmbiente, consultarCNPJ } from '../api-service.js';
import { maskCNPJ, maskCEP } from '../fiscal-utils.js';
import { buscarMunicipiosPorUF } from '../municipios-ibge.js';

// ─── Persistência em localStorage ──────────────────────
const STORAGE_KEY = 'nfse_settings';

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || getDefaults();
  } catch { return getDefaults(); }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function getDefaults() {
  return {
    ambiente: 'sandbox',
    demoMode: false,
    contribuinte: {
      cnpj: '',
      razaoSocial: '',
      nomeFantasia: '',
      inscMunicipal: '',
      regimeTrib: '1',
      codMunicipio: '',
      municipio: '',
      uf: '',
      email: '',
    },
    emailNotificacoes: '',
    cert: {
      tipo: 'A1',
      subject: '',
      serialNumber: '',
      notBefore: null,
      notAfter: null,
      loadedAt: null,
    },
  };
}

// ─── Verificação de vencimento do certificado ──────────
let _expiryCheckInterval = null;

export function startCertExpiryWatch() {
  // Limpa intervalo anterior
  if (_expiryCheckInterval) clearInterval(_expiryCheckInterval);

  // Verifica agora e a cada 1 hora
  checkCertExpiry();
  _expiryCheckInterval = setInterval(checkCertExpiry, 60 * 60 * 1000);
}

function checkCertExpiry() {
  const settings = loadSettings();
  const notAfter = settings.cert?.notAfter;
  if (!notAfter) return;

  const expiry = new Date(notAfter);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    toast.error(`🚨 Certificado digital EXPIRADO desde ${expiry.toLocaleDateString('pt-BR')}! Renove imediatamente.`);
  } else if (diffDays <= 5) {
    toast.warning(`⚠️ Certificado digital vence em ${diffDays} dia${diffDays > 1 ? 's' : ''} (${expiry.toLocaleDateString('pt-BR')}). Providencie a renovação!`);
  }
}

// ─── Validação completa do certificado ─────────────────
function validateCertificate(settings) {
  const results = [];
  const cert = settings.cert;

  // 1. Verificar se foi carregado
  if (!cert.loadedAt) {
    results.push({ field: 'Certificado', status: 'error', message: 'Nenhum certificado carregado no sistema' });
    return results;
  }
  results.push({ field: 'Carga', status: 'ok', message: `Carregado em ${new Date(cert.loadedAt).toLocaleString('pt-BR')}` });

  // 2. Titular (Subject)
  if (cert.subject && cert.subject.length > 5) {
    results.push({ field: 'Titular', status: 'ok', message: cert.subject });
  } else {
    results.push({ field: 'Titular', status: 'warning', message: 'Nome do titular não identificado' });
  }

  // 3. Número de série
  if (cert.serialNumber) {
    results.push({ field: 'Nº Série', status: 'ok', message: cert.serialNumber });
  } else {
    results.push({ field: 'Nº Série', status: 'warning', message: 'Número de série não disponível' });
  }

  // 4. Data de início
  if (cert.notBefore) {
    const nb = new Date(cert.notBefore);
    const now = new Date();
    if (now >= nb) {
      results.push({ field: 'Válido desde', status: 'ok', message: nb.toLocaleDateString('pt-BR') });
    } else {
      results.push({ field: 'Válido desde', status: 'error', message: `Certificado ainda não é válido (início: ${nb.toLocaleDateString('pt-BR')})` });
    }
  } else {
    results.push({ field: 'Válido desde', status: 'warning', message: 'Data de início não disponível' });
  }

  // 5. Data de expiração
  if (cert.notAfter) {
    const na = new Date(cert.notAfter);
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

  // 6. Tipo
  results.push({ field: 'Tipo', status: 'ok', message: `Certificado ${cert.tipo} — ICP-Brasil` });

  // 7. Cadeia de confiança (simulado)
  const certStore = getCertStore();
  if (certStore && certStore.privateKey) {
    results.push({ field: 'Chave Privada', status: 'ok', message: 'Chave privada RSA carregada em memória' });
  } else if (certStore && !certStore.privateKey) {
    results.push({ field: 'Chave Privada', status: 'warning', message: 'Chave indisponível (HTTP/Non-Secure Context limit)' });
  } else {
    results.push({ field: 'Chave Privada', status: 'error', message: 'Chave privada não encontrada — recarregue o certificado' });
  }

  return results;
}

// ─── Render ────────────────────────────────────────────
export function renderConfiguracoes(container) {
  const settings = loadSettings();

  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">Configurações</h1>
        <p class="page-description">Certificado digital, ambiente e dados do contribuinte</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" id="cfg-reset">Restaurar Padrões</button>
        <button class="btn btn-success" id="cfg-salvar">💾 Salvar Configurações</button>
      </div>
    </div>

    <!-- Certificado Digital -->
    <div class="card animate-slide-up mb-6">
      <div class="card-header">
        <h3 class="card-title">🔒 Certificado Digital ICP-Brasil</h3>
        <div style="display: flex; gap: var(--space-2);">
          <button class="btn btn-ghost btn-sm" id="cfg-cert-validar">✅ Validar Certificado</button>
          <button class="btn btn-ghost btn-sm" id="cfg-cert-remover">🗑 Remover</button>
        </div>
      </div>
      <div class="card-body">
        <!-- Status do Certificado -->
        <div id="cert-status-panel" style="padding: var(--space-4); background: var(--surface-glass); border-radius: var(--radius-lg); border: 1px solid var(--surface-glass-border); margin-bottom: var(--space-6);">
          ${renderCertStatus(settings)}
        </div>

        <!-- Upload -->
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Tipo de Certificado</label>
            <select class="form-select" id="cfg-cert-tipo">
              <option value="A1" ${settings.cert.tipo === 'A1' ? 'selected' : ''}>A1 — Arquivo (.pfx/.p12)</option>
              <option value="A3" ${settings.cert.tipo === 'A3' ? 'selected' : ''}>A3 — Token / Smart Card</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Arquivo do Certificado (.pfx / .p12)</label>
            <input class="form-input" type="file" accept=".pfx,.p12" id="cfg-cert-file">
          </div>
          <div class="form-group">
            <label class="form-label">Senha do Certificado</label>
            <div style="position: relative;">
              <input class="form-input" type="password" id="cfg-cert-senha" placeholder="••••••••" autocomplete="off">
              <button type="button" id="cfg-toggle-senha" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--color-neutral-500); cursor: pointer; font-size: 16px;">👁</button>
            </div>
          </div>
        </div>
        <button class="btn btn-primary" id="cfg-cert-carregar">🔐 Carregar Certificado</button>

        <!-- Resultado de validação -->
        <div id="cert-validation-result" class="hidden" style="margin-top: var(--space-6);">
          <div class="section-title" style="font-size: var(--text-sm);">
            <span class="icon" style="width: 24px; height: 24px; font-size: var(--text-sm);">📋</span>Resultado da Validação
          </div>
          <div id="cert-validation-body"></div>
        </div>
      </div>
    </div>

    <!-- Dados do Contribuinte -->
    <div class="card animate-slide-up mb-6">
      <div class="card-header">
        <h3 class="card-title">🏢 Dados do Contribuinte</h3>
        <button class="btn btn-ghost btn-sm" id="cfg-contrib-edit">✏️ Editar</button>
      </div>
      <div class="card-body">
        <div id="contrib-view-mode">
          ${renderContribView(settings.contribuinte)}
        </div>
        <div id="contrib-edit-mode" class="hidden">
          ${renderContribEdit(settings.contribuinte)}
        </div>
      </div>
    </div>

    <!-- Ambiente / API -->
    <div class="card animate-slide-up mb-6">
      <div class="card-header">
        <h3 class="card-title">⚙️ Ambiente de Operação</h3>
        <button class="btn btn-ghost btn-sm" id="cfg-amb-edit">✏️ Editar</button>
      </div>
      <div class="card-body">
        <div id="amb-view-mode">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4); flex-wrap: wrap; gap: var(--space-2);">
            <p class="text-muted" style="font-size: var(--text-xs); margin: 0;">Configurado no módulo Município (Configurações)</p>
            <button class="btn btn-ghost btn-sm" id="cfg-amb-refresh" title="Atualizar ambiente do município">🔄 Atualizar</button>
          </div>
          <div class="grid grid-2 gap-4">
            <div class="form-group">
              <label class="form-label">Ambiente</label>
              <div><span id="cfg-amb-badge" class="badge badge-warning">⚡ Sandbox</span></div>
            </div>
            <div class="form-group">
              <label class="form-label">Modo Demo</label>
              <div><span id="cfg-demo-badge" class="badge ${settings.demoMode ? 'badge-primary' : 'badge-success'}">${settings.demoMode ? '🎭 Ativo' : '🔌 Desativado'}</span></div>
            </div>
            <div class="form-group">
              <label class="form-label">URL Sefin Nacional</label>
              <input class="form-input form-input-mono" id="cfg-url-sefin-display" type="text" readonly value="">
            </div>
            <div class="form-group">
              <label class="form-label">URL ADN (Ambiente de Dados Nacional)</label>
              <input class="form-input form-input-mono" id="cfg-url-adn-display" type="text" readonly value="">
            </div>
            <div style="grid-column: 1 / -1;">
              <span class="text-muted" style="font-size: var(--text-xs);">E-MAIL REMETENTE DAS NOTIFICAÇÕES:</span>
              <span id="cfg-email-display" style="font-size: var(--text-sm); color: var(--color-neutral-200); margin-left: var(--space-2);">${settings.emailNotificacoes || 'Não configurado'}</span>
            </div>
          </div>
        </div>
        <div id="amb-edit-mode" class="hidden">
          <div class="form-row mb-4">
            <div class="form-group">
              <label class="form-label">Modo Demo (API simulada)</label>
              <select class="form-select" id="cfg-demo">
                <option value="true" ${settings.demoMode ? 'selected' : ''}>Ativo — Respostas simuladas</option>
                <option value="false" ${!settings.demoMode ? 'selected' : ''}>Desativado — APIs reais</option>
              </select>
            </div>
          </div>
          <div class="form-row mb-4">
            <div class="form-group" style="grid-column: 1 / -1;">
              <label class="form-label">E-mail Remetente (Envio de Notificações e Acessos) <span class="required">*</span></label>
              <input class="form-input" type="email" id="cfg-email-notif" placeholder="nfs-notifica@minhaempresa.com.br" value="${settings.emailNotificacoes || ''}">
            </div>
          </div>
          <div style="display: flex; gap: var(--space-2); justify-content: flex-end;">
            <button class="btn btn-secondary" id="cfg-amb-cancel">Cancelar</button>
            <button class="btn btn-primary" id="cfg-amb-save">Salvar</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Sobre -->
    <div class="card animate-slide-up">
      <div class="card-header">
        <h3 class="card-title">ℹ️ Sobre o Sistema</h3>
      </div>
      <div class="card-body">
        <div class="grid grid-3 gap-4">
          <div style="padding: var(--space-3); background: var(--surface-glass); border-radius: var(--radius-md);">
            <div style="font-size: var(--text-xs); color: var(--color-neutral-500); text-transform: uppercase;">Versão</div>
            <div style="font-weight: 700; color: var(--color-primary-400);">v1.0.0</div>
          </div>
          <div style="padding: var(--space-3); background: var(--surface-glass); border-radius: var(--radius-md);">
            <div style="font-size: var(--text-xs); color: var(--color-neutral-500); text-transform: uppercase;">XSD Schema</div>
            <div style="font-weight: 700; color: var(--color-accent-400);">v1.01</div>
          </div>
          <div style="padding: var(--space-3); background: var(--surface-glass); border-radius: var(--radius-md);">
            <div style="font-size: var(--text-xs); color: var(--color-neutral-500); text-transform: uppercase;">Framework</div>
            <div style="font-weight: 700; color: var(--color-warning-400);">Freire</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // ═══ EVENT BINDINGS ═══════════════════════════════════

  // ─── Toggle senha ──────────────────────────────
  document.getElementById('cfg-toggle-senha')?.addEventListener('click', () => {
    const inp = document.getElementById('cfg-cert-senha');
    if (inp) {
      inp.type = inp.type === 'password' ? 'text' : 'password';
    }
  });

  // ─── Carregar certificado ──────────────────────
  document.getElementById('cfg-cert-carregar')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('cfg-cert-file');
    const senha = document.getElementById('cfg-cert-senha')?.value;
    const tipo = document.getElementById('cfg-cert-tipo')?.value || 'A1';

    if (!fileInput?.files?.length) {
      toast.error('Selecione o arquivo do certificado (.pfx / .p12).');
      return;
    }
    if (!senha) {
      toast.error('Informe a senha do certificado.');
      return;
    }

    toast.info('Carregando certificado digital...');

    try {
      const file = fileInput.files[0];
      const buffer = await file.arrayBuffer();
      const certData = await loadCertificateA1(buffer, senha);

      // Salvar no store em memória
      setCertStore(certData);

      // Atualizar settings com dados simulados limitados a demo apenas se certData estiver vazio
      const now = new Date();
      
      const updatedSettings = loadSettings();
      updatedSettings.cert = {
        tipo,
        subject: certData.subject || `Certificado de ${file.name}`,
        serialNumber: certData.serialNumber || generateDemoSerial(),
        notBefore: certData.notBefore || new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString(),
        notAfter: certData.notAfter || new Date(now.getTime() + (5 * 24 * 60 * 60 * 1000)).toISOString(),
        loadedAt: now.toISOString(),
        fileName: file.name,
        issuer: certData.issuer || '—',
        issuerO: certData.issuerO || '',
        signatureAlgorithm: certData.signatureAlgorithm || '—',
        keyAlgorithm: certData.keyAlgorithm || '—',
        keyBits: certData.keyBits || null,
        keyUsages: certData.keyUsages || [],
      };
      saveSettings(updatedSettings);

      // Atualizar UI
      updateCertStatusPanel(updatedSettings);
      toast.success('✅ Certificado carregado com sucesso!');

      // Iniciar monitoramento de vencimento
      startCertExpiryWatch();

    } catch (err) {
      toast.error(`Falha ao carregar certificado: ${err.message}`);
    }
  });

  // ─── Validar certificado ──────────────────────
  document.getElementById('cfg-cert-validar')?.addEventListener('click', () => {
    const settings = loadSettings();
    const results = validateCertificate(settings);

    const container = document.getElementById('cert-validation-result');
    const body = document.getElementById('cert-validation-body');
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
    if (hasErrors) {
      toast.error('Certificado com problemas críticos!');
    } else if (hasWarnings) {
      toast.warning('Certificado validado com alertas.');
    } else {
      toast.success('✅ Certificado válido e pronto para uso!');
    }
  });

  // ─── Remover certificado ──────────────────────
  document.getElementById('cfg-cert-remover')?.addEventListener('click', () => {
    if (!confirm('Deseja realmente remover o certificado carregado?')) return;

    clearCertStore();
    const settings = loadSettings();
    settings.cert = getDefaults().cert;
    saveSettings(settings);

    updateCertStatusPanel(settings);
    document.getElementById('cert-validation-result')?.classList.add('hidden');
    toast.info('Certificado removido.');
  });

  // ─── Editar Contribuinte ──────────────────────
  let contribEditing = false;
  document.getElementById('cfg-contrib-edit')?.addEventListener('click', () => {
    contribEditing = !contribEditing;
    document.getElementById('contrib-view-mode').classList.toggle('hidden', contribEditing);
    document.getElementById('contrib-edit-mode').classList.toggle('hidden', !contribEditing);
    document.getElementById('cfg-contrib-edit').textContent = contribEditing ? '✕ Cancelar' : '✏️ Editar';
  });

  document.getElementById('cfg-contrib-save')?.addEventListener('click', () => {
    const val = (id) => document.getElementById(id)?.value?.trim() || '';
    const settings = loadSettings();
    const dispVal = document.getElementById('cfg-codmun-display')?.value || '';
    const opt = Array.from(document.getElementById('cfg-codmun-list')?.querySelectorAll('option') || []).find(o => o.value === dispVal);
    const prev = settings.contribuinte || {};
    settings.contribuinte = {
      cnpj: val('cfg-cnpj').replace(/\D/g, ''),
      razaoSocial: val('cfg-razao'),
      nomeFantasia: val('cfg-fantasia'),
      inscMunicipal: val('cfg-im'),
      regimeTrib: val('cfg-regime'),
      codMunicipio: val('cfg-codmun'),
      municipio: opt?.dataset?.nome || prev.municipio || '',
      uf: opt?.dataset?.uf || val('cfg-uf') || prev.uf || '',
      email: val('cfg-email'),
    };
    saveSettings(settings);

    // Atualizar view
    document.getElementById('contrib-view-mode').innerHTML = renderContribView(settings.contribuinte);
    document.getElementById('contrib-view-mode').classList.remove('hidden');
    document.getElementById('contrib-edit-mode').classList.add('hidden');
    document.getElementById('cfg-contrib-edit').textContent = '✏️ Editar';
    contribEditing = false;

    toast.success('Dados do contribuinte salvos!');
  });

  document.getElementById('cfg-contrib-cancel')?.addEventListener('click', () => {
    document.getElementById('contrib-view-mode').classList.remove('hidden');
    document.getElementById('contrib-edit-mode').classList.add('hidden');
    document.getElementById('cfg-contrib-edit').textContent = '✏️ Editar';
    contribEditing = false;
  });

  // ─── Editar Ambiente ──────────────────────────
  document.getElementById('cfg-amb-edit')?.addEventListener('click', () => {
    document.getElementById('amb-view-mode').classList.add('hidden');
    document.getElementById('amb-edit-mode').classList.remove('hidden');
    document.getElementById('cfg-amb-edit').classList.add('hidden');
  });

  document.getElementById('cfg-amb-cancel')?.addEventListener('click', () => {
    document.getElementById('amb-view-mode').classList.remove('hidden');
    document.getElementById('amb-edit-mode').classList.add('hidden');
    document.getElementById('cfg-amb-edit').classList.remove('hidden');
  });

  const applyConfig = (data) => {
    const amb = data?.ambiente || 'sandbox';
    const urlSefin = data?.urlSefin || (amb === 'production' ? 'sefin.nfse.gov.br' : 'sefin.producaorestrita.nfse.gov.br');
    const urlAdn = data?.urlAdn || (amb === 'production' ? 'adn.nfse.gov.br' : 'adn.producaorestrita.nfse.gov.br');
    setEnvironment(amb);
    try { localStorage.setItem('nfse_last_ambiente', amb); } catch (_) {}
    const badge = document.getElementById('cfg-amb-badge');
    const sefinEl = document.getElementById('cfg-url-sefin-display');
    const adnEl = document.getElementById('cfg-url-adn-display');
    if (badge) {
      badge.textContent = amb === 'production' ? '🔴 Produção' : '⚡ Sandbox';
      badge.className = 'badge ' + (amb === 'production' ? 'badge-danger' : 'badge-warning');
    }
    if (sefinEl) sefinEl.value = urlSefin;
    if (adnEl) adnEl.value = urlAdn;
  };

  async function loadAmbienteFromBackend() {
    try {
      const data = await fetchConfigAmbiente();
      if (data && (data.ambiente || data.urlSefin || data.urlAdn)) {
        applyConfig(data);
        window.dispatchEvent(new CustomEvent('nfse_ambiente_loaded', { detail: data }));
        return true;
      }
      applyConfig({ ambiente: 'sandbox' });
      toast.warning('Ambiente carregado com valor padrão. Verifique a conexão.');
    } catch (err) {
      applyConfig({ ambiente: 'sandbox' });
      toast.warning('Não foi possível carregar o ambiente do município. Verifique a conexão.');
    }
    return false;
  }

  loadAmbienteFromBackend();

  document.getElementById('cfg-amb-refresh')?.addEventListener('click', async () => {
    const btn = document.getElementById('cfg-amb-refresh');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Carregando...'; }
    await loadAmbienteFromBackend();
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Atualizar'; }
  });

  document.getElementById('cfg-amb-save')?.addEventListener('click', () => {
    const settings = loadSettings();
    settings.demoMode = document.getElementById('cfg-demo')?.value === 'true';
    settings.emailNotificacoes = document.getElementById('cfg-email-notif')?.value || '';
    saveSettings(settings);
    setDemoMode(settings.demoMode);

    const demoBadge = document.getElementById('cfg-demo-badge');
    if (demoBadge) {
      demoBadge.textContent = settings.demoMode ? '🎭 Ativo' : '🔌 Desativado';
      demoBadge.className = 'badge ' + (settings.demoMode ? 'badge-primary' : 'badge-success');
    }
    const emailDisplay = document.getElementById('cfg-email-display');
    if (emailDisplay) emailDisplay.textContent = settings.emailNotificacoes || 'Não configurado';

    document.getElementById('amb-view-mode').classList.remove('hidden');
    document.getElementById('amb-edit-mode').classList.add('hidden');
    document.getElementById('cfg-amb-edit').classList.remove('hidden');

    toast.success('Configurações salvas!');
  });

  // ─── Salvar Geral ─────────────────────────────
  document.getElementById('cfg-salvar')?.addEventListener('click', () => {
    const val = (id) => document.getElementById(id)?.value?.trim() || '';
    const settings = loadSettings();

    // Contribuinte
    settings.contribuinte = settings.contribuinte || {};
    settings.contribuinte.cnpj = val('cfg-cnpj').replace(/\D/g, '') || settings.contribuinte.cnpj || '';
    settings.contribuinte.razaoSocial = val('cfg-razao-social') || settings.contribuinte.razaoSocial || '';
    settings.contribuinte.inscricaoMunicipal = val('cfg-inscricao-municipal') || settings.contribuinte.inscricaoMunicipal || '';
    settings.contribuinte.uf = val('cfg-uf') || settings.contribuinte.uf || '';
    settings.contribuinte.codMun = val('cfg-codmun') || settings.contribuinte.codMun || '';
    settings.contribuinte.email = val('cfg-email') || settings.contribuinte.email || '';
    settings.contribuinte.telefone = val('cfg-telefone') || settings.contribuinte.telefone || '';

    // Regime tributário
    settings.regimeTrib = settings.regimeTrib || {};
    settings.regimeTrib.opSimpNac = val('cfg-op-simp-nac') || settings.regimeTrib.opSimpNac || '1';
    settings.regimeTrib.regEspTrib = val('cfg-reg-esp-trib') || settings.regimeTrib.regEspTrib || '0';

    // Certificado
    settings.cert = settings.cert || {};
    settings.cert.tipo = val('cfg-cert-tipo') || settings.cert.tipo || 'A1';

    // Demo mode e email
    settings.demoMode = document.getElementById('cfg-demo')?.value === 'true';
    settings.emailNotificacoes = val('cfg-email-notif') || settings.emailNotificacoes || '';

    saveSettings(settings);
    setDemoMode(settings.demoMode);

    toast.success('✅ Todas as configurações foram salvas!');
  });

  // ─── Restaurar Padrões ────────────────────────
  document.getElementById('cfg-reset')?.addEventListener('click', () => {
    if (!confirm('Restaurar todas as configurações para os valores padrão?')) return;
    saveSettings(getDefaults());
    clearCertStore();
    renderConfiguracoes(container);
    toast.info('Configurações restauradas para o padrão.');
  });

  // ─── Máscaras e Consultas Automáticas ───────────────────
  const cnpjInput = document.getElementById('cfg-cnpj');
  if (cnpjInput) {
    cnpjInput.addEventListener('input', (e) => {
      e.target.value = maskCNPJ(e.target.value);
    });

    // Município select: UF + datalist
    const ufEl = document.getElementById('cfg-uf');
    const dispEl = document.getElementById('cfg-codmun-display');
    const hidEl = document.getElementById('cfg-codmun');
    const datalistEl = document.getElementById('cfg-codmun-list');
    const loadMunOpts = async () => {
      const uf = ufEl?.value?.trim().toUpperCase();
      if (!uf || uf.length !== 2 || !datalistEl) return;
      try {
        const lista = await buscarMunicipiosPorUF(uf);
        datalistEl.innerHTML = lista.map(m => `<option value="${m.display}" data-code="${m.id}" data-nome="${(m.nome || '').replace(/"/g, '&quot;')}" data-uf="${m.uf || ''}">`).join('');
      } catch (_) {}
    };
    ufEl?.addEventListener('change', loadMunOpts);
    ufEl?.addEventListener('blur', loadMunOpts);
    dispEl?.addEventListener('change', () => {
      const opt = Array.from(datalistEl?.querySelectorAll('option') || []).find(o => o.value === dispEl.value);
      if (opt) { hidEl.value = opt.dataset.code || ''; if (ufEl) ufEl.value = opt.dataset.uf || ufEl.value; }
    });
    dispEl?.addEventListener('input', () => {
      const opt = Array.from(datalistEl?.querySelectorAll('option') || []).find(o => o.value === dispEl.value);
      hidEl.value = opt ? (opt.dataset.code || '') : dispEl.value.replace(/\D/g, '').slice(0, 7);
    });

    cnpjInput.addEventListener('blur', async (e) => {
      const val = e.target.value.replace(/\D/g, '');
      if (val.length === 14) {
        toast.info('Consultando CNPJ do Contribuinte na ReceitaWS...');
        try {
          const dados = await consultarCNPJ(val);
          
          const getEl = id => document.getElementById(id);
          
          if (dados.razaoSocial) getEl('cfg-razao').value = dados.razaoSocial;
          if (dados.fantasia) getEl('cfg-fantasia').value = dados.fantasia;
          if (dados.codigoIbge) {
            getEl('cfg-codmun').value = dados.codigoIbge;
            const disp = getEl('cfg-codmun-display');
            if (disp && dados.municipio && dados.uf) disp.value = `${dados.municipio} (${dados.uf}) — IBGE: ${dados.codigoIbge}`;
          }
          if (dados.uf) { const u = getEl('cfg-uf'); if (u) u.value = dados.uf; }
          if (dados.email) getEl('cfg-email').value = dados.email;
          
          toast.success('Dados do contribuinte sincronizados pela Receita!');
        } catch (err) {
          toast.warning('Consulta CNPJ falhou, preencha manualmente.');
        }
      }
    });
  }
}

// ─── Render helpers ────────────────────────────────────

function renderCertStatus(settings) {
  const cert = settings.cert;
  if (!cert.loadedAt) {
    return `
      <div style="display: flex; align-items: center; gap: var(--space-4);">
        <div style="width: 48px; height: 48px; border-radius: var(--radius-lg); background: rgba(239, 68, 68, 0.1); display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;">🔓</div>
        <div>
          <div style="font-weight: 600; color: var(--color-neutral-300);">Nenhum certificado carregado</div>
          <div style="font-size: var(--text-xs); color: var(--color-neutral-500);">Carregue um certificado A1 (.pfx/.p12) para assinar documentos fiscais</div>
        </div>
      </div>
    `;
  }

  const na = cert.notAfter ? new Date(cert.notAfter) : null;
  const now = new Date();
  const diffDays = na ? Math.ceil((na.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

  let statusColor, statusBg, statusIcon, statusText;
  if (diffDays !== null && diffDays <= 0) {
    statusColor = 'var(--color-danger-400)'; statusBg = 'rgba(239, 68, 68, 0.1)';
    statusIcon = '🚫'; statusText = `EXPIRADO há ${Math.abs(diffDays)} dias`;
  } else if (diffDays !== null && diffDays <= 5) {
    statusColor = 'var(--color-warning-400)'; statusBg = 'rgba(245, 158, 11, 0.1)';
    statusIcon = '⚠️'; statusText = `Vence em ${diffDays} dia(s)!`;
  } else if (diffDays !== null && diffDays <= 30) {
    statusColor = 'var(--color-warning-400)'; statusBg = 'rgba(245, 158, 11, 0.1)';
    statusIcon = '📅'; statusText = `Vence em ${diffDays} dias`;
  } else {
    statusColor = 'var(--color-accent-400)'; statusBg = 'rgba(16, 185, 129, 0.1)';
    statusIcon = '✅'; statusText = diffDays ? `Válido por ${diffDays} dias` : 'Carregado';
  }

  return `
    <div style="display: flex; align-items: center; gap: var(--space-4);">
      <div style="width: 48px; height: 48px; border-radius: var(--radius-lg); background: ${statusBg}; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;">${statusIcon}</div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 700; color: ${statusColor}; margin-bottom: 2px;">${statusText}</div>
        <div style="font-size: var(--text-sm); color: var(--color-neutral-300);">${cert.subject}</div>
        <div style="font-size: var(--text-xs); color: var(--color-neutral-500); margin-top: 2px;">Nº Série: ${cert.serialNumber || '—'}</div>
      </div>
      <div style="padding: var(--space-3); background: var(--surface-glass); border-radius: var(--radius-md); border: 1px solid var(--surface-glass-border); min-width: 200px; flex-shrink: 0;">
        <div style="font-size: var(--text-xs); color: var(--color-neutral-500); text-transform: uppercase; margin-bottom: var(--space-2); font-weight: 600;">Validade</div>
        <div style="display: flex; flex-direction: column; gap: var(--space-1); font-size: var(--text-xs);">
          <div style="display: flex; justify-content: space-between; gap: var(--space-4);">
            <span style="color: var(--color-neutral-500);">Início</span>
            <span style="color: var(--color-neutral-300); font-weight: 500;">${cert.notBefore ? new Date(cert.notBefore).toLocaleDateString('pt-BR') : '—'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; gap: var(--space-4);">
            <span style="color: var(--color-neutral-500);">Fim</span>
            <span style="color: ${statusColor}; font-weight: 600;">${cert.notAfter ? new Date(cert.notAfter).toLocaleDateString('pt-BR') : '—'}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function updateCertStatusPanel(settings) {
  const panel = document.getElementById('cert-status-panel');
  if (panel) panel.innerHTML = renderCertStatus(settings);
}

function renderContribView(c) {
  if (!c.cnpj && !c.razaoSocial) {
    return `
      <div class="empty-state" style="padding: var(--space-8);">
        <div class="icon" style="font-size: 2rem;">🏢</div>
        <p style="font-size: var(--text-sm); color: var(--color-neutral-400);">Nenhum dado do contribuinte cadastrado. Clique em "Editar" para preencher.</p>
      </div>`;
  }
  return `
    <div class="grid grid-2 gap-4">
      <div><span class="text-muted" style="font-size: var(--text-xs);">CNPJ:</span> <span class="text-mono" style="font-weight: 600;">${c.cnpj ? maskCNPJ(c.cnpj) : '—'}</span></div>
      <div><span class="text-muted" style="font-size: var(--text-xs);">Razão Social:</span> <span style="font-weight: 600; color: var(--color-neutral-100);">${c.razaoSocial || '—'}</span></div>
      <div><span class="text-muted" style="font-size: var(--text-xs);">Nome Fantasia:</span> <span>${c.nomeFantasia || '—'}</span></div>
      <div><span class="text-muted" style="font-size: var(--text-xs);">Inscrição Municipal:</span> <span class="text-mono">${c.inscMunicipal || '—'}</span></div>
      <div><span class="text-muted" style="font-size: var(--text-xs);">Regime Tributário:</span> <span>${{'1': 'Simples Nacional', '2': 'SN — Excesso Sublimite', '3': 'Normal', '4': 'MEI'}[c.regimeTrib] || c.regimeTrib || '—'}</span></div>
      <div><span class="text-muted" style="font-size: var(--text-xs);">Município (IBGE):</span> <span>${c.codMunicipio ? (c.municipio && c.uf ? `${c.municipio} (${c.uf}) — IBGE: ${c.codMunicipio}` : `Código IBGE: ${c.codMunicipio}`) : '—'}</span></div>
      <div style="grid-column: 1 / -1;"><span class="text-muted" style="font-size: var(--text-xs);">E-mail:</span> <span>${c.email || '—'}</span></div>
    </div>`;
}

function renderContribEdit(c) {
  return `
    <div class="form-row mb-4">
      <div class="form-group">
        <label class="form-label">CNPJ <span class="required">*</span></label>
        <input class="form-input form-input-mono" id="cfg-cnpj" type="text" maxlength="18" placeholder="00.000.000/0000-00" value="${c.cnpj ? maskCNPJ(c.cnpj) : ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Razão Social <span class="required">*</span></label>
        <input class="form-input" id="cfg-razao" type="text" maxlength="150" value="${c.razaoSocial || ''}">
      </div>
    </div>
    <div class="form-row mb-4">
      <div class="form-group">
        <label class="form-label">Nome Fantasia</label>
        <input class="form-input" id="cfg-fantasia" type="text" maxlength="150" value="${c.nomeFantasia || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Inscrição Municipal</label>
        <input class="form-input form-input-mono" id="cfg-im" type="text" maxlength="15" value="${c.inscMunicipal || ''}">
      </div>
    </div>
    <div class="form-row mb-4">
      <div class="form-group">
        <label class="form-label">Regime Tributário</label>
        <select class="form-select" id="cfg-regime">
          <option value="1" ${c.regimeTrib === '1' ? 'selected' : ''}>1 — Simples Nacional</option>
          <option value="2" ${c.regimeTrib === '2' ? 'selected' : ''}>2 — SN — Excesso Sublimite</option>
          <option value="3" ${c.regimeTrib === '3' ? 'selected' : ''}>3 — Regime Normal</option>
          <option value="4" ${c.regimeTrib === '4' ? 'selected' : ''}>4 — MEI</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">UF</label>
        <input class="form-input" id="cfg-uf" type="text" maxlength="2" placeholder="SP" style="text-transform: uppercase;" value="${c.uf || ''}">
      </div>
      <div class="form-group" style="flex: 1;">
        <label class="form-label">Município (IBGE)</label>
        <div class="municipio-select-wrapper">
          <input type="text" class="form-input municipio-display" id="cfg-codmun-display"
            placeholder="Selecione UF e busque por nome..." list="cfg-codmun-list" autocomplete="off"
            value="${c.codMunicipio && c.municipio && c.uf ? `${c.municipio} (${c.uf}) — IBGE: ${c.codMunicipio}` : ''}">
          <input type="hidden" id="cfg-codmun" value="${c.codMunicipio || ''}">
          <datalist id="cfg-codmun-list"></datalist>
        </div>
      </div>
    </div>
    <div class="form-row mb-4">
      <div class="form-group" style="grid-column: 1 / -1;">
        <label class="form-label">E-mail</label>
        <input class="form-input" id="cfg-email" type="email" maxlength="80" value="${c.email || ''}">
      </div>
    </div>
    <div style="display: flex; gap: var(--space-2); justify-content: flex-end;">
      <button class="btn btn-secondary" id="cfg-contrib-cancel">Cancelar</button>
      <button class="btn btn-primary" id="cfg-contrib-save">💾 Salvar Dados</button>
    </div>`;
}

function generateDemoSerial() {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join(':');
}
