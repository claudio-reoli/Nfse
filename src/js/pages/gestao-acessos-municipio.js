/**
 * NFS-e Freire — Gestão de Acessos (Módulo Município)
 */
import { MUN_ROLES, isMunAuthorized } from '../auth-municipio.js';
import { toast } from '../toast.js';
import { maskCPF, maskPhone } from '../fiscal-utils.js';
import { getBackendUrl, getUsers, cadastrarDecisaoJudicial } from '../api-service.js';
import { getSession } from '../auth.js';

function getMunToken() {
  try { const s = localStorage.getItem('nfse_session'); return s ? (JSON.parse(s).token || '') : ''; } catch { return ''; }
}
function authH(extra = {}) {
  return { 'Authorization': `Bearer ${getMunToken()}`, ...extra };
}

const BASE_ROLES = [
  { value: 'GESTOR', label: MUN_ROLES.GESTOR },
  { value: 'FISCAL', label: MUN_ROLES.FISCAL },
  { value: 'AUDITOR', label: MUN_ROLES.AUDITOR },
  { value: 'ATENDENTE', label: MUN_ROLES.ATENDENTE },
];

export function renderGestaoAcessosMun(container) {
  if (!isMunAuthorized([MUN_ROLES.GESTOR])) {
    container.innerHTML = `<div class="empty-state">Acesso restrito ao Gestor Municipal.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">Cadastros e Acessos (SEFIN)</h1>
        <p class="page-description">Gerenciamento de Usuários, Fiscais e Auditores do Município</p>
      </div>
    </div>

    <div class="card animate-slide-up mb-6">
      <div class="card-header"><h3 class="card-title">Cadastrar Servidor</h3></div>
      <div class="card-body">
        <div class="grid grid-3 gap-4 mb-4">
          <div class="form-group">
            <label class="form-label">CPF</label>
            <input type="text" class="form-input form-input-mono" id="mun-novo-cpf" placeholder="000.000.000-00" maxlength="14">
          </div>
          <div class="form-group">
            <label class="form-label">Nome</label>
            <input type="text" class="form-input" id="mun-novo-nome">
          </div>
          <div class="form-group">
            <label class="form-label">Papel</label>
            <select class="form-select" id="mun-novo-role">
              ${BASE_ROLES.map(r => `<option value="${r.value}">${r.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">E-mail <span class="text-danger">*</span></label>
            <input type="email" class="form-input" id="mun-novo-email" placeholder="usuario@municipio.gov.br" required>
          </div>
          <div class="form-group">
            <label class="form-label">Celular <span class="text-danger">*</span></label>
            <input type="tel" class="form-input form-input-mono" id="mun-novo-celular" placeholder="(00) 00000-0000" maxlength="16" required>
          </div>
        </div>
        <div style="text-align: right;">
          <button class="btn btn-primary" id="btn-mun-save-user">Salvar Servidor</button>
        </div>
      </div>
    </div>

    <!-- Regime Tributário dos Contribuintes -->
    <div class="card animate-slide-up mb-6">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
        <h3 class="card-title">Regime Tributário dos Contribuintes</h3>
        <button class="btn btn-ghost btn-sm" id="btn-regime-reload">🔄 Atualizar</button>
      </div>
      <div class="card-body">
        <p class="form-help" style="margin-bottom: var(--space-3);">Configure o regime tributário de cada contribuinte. Contribuintes marcados como "Isento de Guia" não receberão guias de pagamento ISSQN geradas automaticamente.</p>
        <div class="grid grid-3 gap-4 mb-4">
          <div class="form-group">
            <label class="form-label">CNPJ do Contribuinte</label>
            <input type="text" class="form-input form-input-mono" id="reg-cnpj" placeholder="00.000.000/0000-00" maxlength="18">
          </div>
          <div class="form-group">
            <label class="form-label">Regime</label>
            <select class="form-select" id="reg-regime">
              <option value="normal">Normal</option>
              <option value="simples">Simples Nacional</option>
              <option value="mei">MEI</option>
              <option value="lucro_presumido">Lucro Presumido</option>
              <option value="lucro_real">Lucro Real</option>
            </select>
          </div>
          <div class="form-group" style="display:flex;align-items:flex-end;gap:8px;">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
              <input type="checkbox" id="reg-isento-guia" style="width:16px;height:16px;">
              <span style="font-size:var(--text-sm);">Isento de Guia</span>
            </label>
            <button class="btn btn-secondary" id="btn-reg-salvar">Salvar Regime</button>
          </div>
        </div>
        <div class="table-container" style="max-height: 250px; overflow-y: auto;">
          <table class="data-table">
            <thead><tr><th>CNPJ</th><th>Regime</th><th>Isento de Guia</th><th>Atualizado em</th><th></th></tr></thead>
            <tbody id="reg-tabela"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card animate-slide-up mb-6">
      <div class="card-header"><h3 class="card-title">Decisões Judiciais/Administrativas</h3></div>
      <div class="card-body">
        <p class="form-help" style="margin-bottom: var(--space-3);">Cadastre decisões que autorizam contribuintes a emitir NFS-e pelo fluxo bypass (cStat=102). O contribuinte deve solicitar ao município antes de emitir.</p>
        <div class="grid grid-3 gap-4 mb-4">
          <div class="form-group">
            <label class="form-label">CNPJ do Contribuinte</label>
            <input type="text" class="form-input form-input-mono" id="dec-cnpj" placeholder="00.000.000/0000-00" maxlength="18">
          </div>
          <div class="form-group">
            <label class="form-label">Número do Processo</label>
            <input type="text" class="form-input" id="dec-processo" placeholder="Ex: 1234567-89.2026.8.26.0000">
          </div>
          <div class="form-group" style="display: flex; align-items: flex-end;">
            <button class="btn btn-secondary" id="btn-dec-cadastrar">Cadastrar Decisão</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card animate-slide-up">
      <div class="card-header" style="display: flex; gap: 10px; flex-wrap: wrap;">
        <input type="text" class="form-input" id="mun-filtro-nome" placeholder="Buscar por nome..." style="max-width: 300px;">
        <select class="form-select" id="mun-filtro-role" style="max-width: 200px;">
          <option value="">Todos os Papéis</option>
          ${BASE_ROLES.map(r => `<option value="${r.value}">${r.label}</option>`).join('')}
        </select>
        <button class="btn btn-secondary" id="btn-mun-filtrar">Filtrar</button>
      </div>
      
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Servidor</th>
              <th>CPF</th>
              <th>E-mail</th>
              <th>Celular</th>
              <th>Papel / Cargo</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="mun-tabela-acessos">
            <tr><td colspan="7" style="text-align:center;">Carregando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div id="modal-mun-editar-usuario" class="modal-overlay hidden" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:1000;align-items:center;justify-content:center;display:none;">
      <div class="card" style="max-width: 420px; width: 90%;">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
          <h3 class="card-title">Editar E-mail e Celular</h3>
          <button id="fechar-modal-mun-editar" class="btn btn-ghost" style="color:var(--color-danger-400);">✕</button>
        </div>
        <div class="card-body">
          <input type="hidden" id="mun-editar-usuario-cpf">
          <div class="form-group mb-4">
            <label class="form-label">E-mail <span class="text-danger">*</span></label>
            <input type="email" class="form-input" id="mun-editar-usuario-email" placeholder="usuario@municipio.gov.br" required>
          </div>
          <div class="form-group mb-4">
            <label class="form-label">Celular <span class="text-danger">*</span></label>
            <input type="tel" class="form-input form-input-mono" id="mun-editar-usuario-celular" placeholder="(00) 00000-0000" maxlength="16" required>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button id="btn-mun-cancelar-editar" class="btn btn-secondary">Cancelar</button>
            <button id="btn-mun-salvar-editar" class="btn btn-primary">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  let allUsers = [];

  document.getElementById('mun-novo-cpf')?.addEventListener('input', (e) => {
    e.target.value = maskCPF(e.target.value.replace(/\D/g, ''));
  });
  document.getElementById('mun-novo-celular')?.addEventListener('input', (e) => {
    e.target.value = maskPhone(e.target.value.replace(/\D/g, ''));
  });

  document.getElementById('dec-cnpj')?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 14) v = v.substring(0, 14);
    e.target.value = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  });

  document.getElementById('btn-dec-cadastrar')?.addEventListener('click', async () => {
    const cnpj = document.getElementById('dec-cnpj')?.value?.replace(/\D/g, '') || '';
    const processo = document.getElementById('dec-processo')?.value?.trim() || '';
    if (cnpj.length !== 14 || !processo) {
      toast.warning('Informe CNPJ e número do processo.');
      return;
    }
    try {
      await cadastrarDecisaoJudicial({ cnpjContribuinte: cnpj, numeroProcesso: processo, tipo: 'judicial' });
      toast.success('Decisão cadastrada com sucesso.');
      document.getElementById('dec-cnpj').value = '';
      document.getElementById('dec-processo').value = '';
    } catch (err) {
      toast.error(err.message || 'Falha ao cadastrar.');
    }
  });

  // ─── Regime Tributário ──────────────────────────
  document.getElementById('reg-cnpj')?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 14) v = v.substring(0, 14);
    e.target.value = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  });

  async function loadRegimes() {
    const tbody = document.getElementById('reg-tabela');
    if (!tbody) return;
    try {
      const session = getSession?.() || JSON.parse(localStorage.getItem('nfse_session') || '{}');
      const res = await fetch(`${getBackendUrl()}/municipio/contribuinte-regime`, {
        headers: { 'Authorization': `Bearer ${session?.token || ''}` }
      });
      const data = await res.json();
      const regimes = data.regimes || [];
      if (regimes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhum regime cadastrado.</td></tr>';
        return;
      }
      tbody.innerHTML = regimes.map(r => `
        <tr>
          <td class="text-mono">${r.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}</td>
          <td>${r.regime}</td>
          <td>${r.isento_guia ? '✅ Sim' : '—'}</td>
          <td style="font-size: var(--text-xs);">${r.atualizado_em ? new Date(r.atualizado_em).toLocaleDateString('pt-BR') : '—'}</td>
          <td><button class="btn btn-ghost btn-sm btn-reg-del" data-cnpj="${r.cnpj}" style="color:var(--color-danger-400);">🗑</button></td>
        </tr>
      `).join('');
      tbody.querySelectorAll('.btn-reg-del').forEach(btn => {
        btn.addEventListener('click', async () => {
          const cnpj = btn.dataset.cnpj;
          if (!confirm(`Remover regime para CNPJ ${cnpj}?`)) return;
          try {
            const session = getSession?.() || JSON.parse(localStorage.getItem('nfse_session') || '{}');
            await fetch(`${getBackendUrl()}/municipio/contribuinte-regime/${cnpj}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${session?.token || ''}` }
            });
            toast.success('Regime removido.');
            loadRegimes();
          } catch (e) { toast.error('Falha ao remover.'); }
        });
      });
    } catch (e) {
      document.getElementById('reg-tabela').innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--color-danger-400);">Erro ao carregar.</td></tr>';
    }
  }

  document.getElementById('btn-reg-salvar')?.addEventListener('click', async () => {
    const cnpj = document.getElementById('reg-cnpj')?.value?.replace(/\D/g, '') || '';
    const regime = document.getElementById('reg-regime')?.value || 'normal';
    const isentoGuia = document.getElementById('reg-isento-guia')?.checked || false;
    if (cnpj.length !== 14) { toast.warning('Informe um CNPJ válido (14 dígitos).'); return; }
    try {
      const session = getSession?.() || JSON.parse(localStorage.getItem('nfse_session') || '{}');
      const res = await fetch(`${getBackendUrl()}/municipio/contribuinte-regime/${cnpj}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.token || ''}` },
        body: JSON.stringify({ regime, isento_guia: isentoGuia })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Regime salvo com sucesso!');
      document.getElementById('reg-cnpj').value = '';
      document.getElementById('reg-isento-guia').checked = false;
      loadRegimes();
    } catch (e) { toast.error(e.message || 'Falha ao salvar regime.'); }
  });

  document.getElementById('btn-regime-reload')?.addEventListener('click', loadRegimes);
  loadRegimes();

  async function loadUsers() {
    const tbody = document.getElementById('mun-tabela-acessos');
    if (!tbody) return;
    try {
      const resp = await getUsers({ type: 'municipio' });
      const data = resp?.data;
      allUsers = Array.isArray(data) ? data : [];
      renderTable(allUsers);
    } catch (e) {
      allUsers = [];
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--color-danger-400);">Erro ao carregar servidores.</td></tr>';
      toast.error('Falha ao listar servidores.');
    }
  }

  function renderTable(users) {
    const tbody = document.getElementById('mun-tabela-acessos');
    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Nenhum servidor encontrado.</td></tr>';
      return;
    }

    const roleBadge = (role) => {
      if (role === 'GESTOR') return 'badge-danger';
      if (role === 'FISCAL') return 'badge-primary';
      if (role === 'AUDITOR') return 'badge-warning';
      return 'badge-success';
    };

    tbody.innerHTML = users.map(a => `
      <tr>
        <td style="font-weight: 500;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--surface-glass); display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; color: var(--color-primary-400);">
              ${a.name.substring(0, 2).toUpperCase()}
            </div>
            ${a.name}
          </div>
        </td>
        <td class="text-mono">${a.cpf}</td>
        <td>${a.email || '—'}</td>
        <td>${a.celular ? maskPhone(a.celular) : '—'}</td>
        <td><span class="badge ${roleBadge(a.role)}">${MUN_ROLES[a.role] || a.role}</span></td>
        <td>
          <span class="badge ${a.status === 'Ativo' ? 'badge-success' : 'badge-warning'}">
            ${a.status || 'Ativo'}
          </span>
        </td>
        <td>
          <div class="btn-group">
            <button class="btn btn-ghost btn-sm btn-mun-editar" data-cpf="${a.cpf}" data-email="${a.email || ''}" data-celular="${a.celular || ''}">Editar</button>
            <button class="btn btn-ghost btn-sm btn-mun-suspend" data-cpf="${a.cpf}" data-status="${a.status || 'Ativo'}" style="color: var(--color-danger-400);">
              ${(a.status || 'Ativo') === 'Ativo' ? 'Suspender' : 'Reativar'}
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function abrirModalMunEditar(cpf, email, celular) {
    document.getElementById('mun-editar-usuario-cpf').value = cpf;
    document.getElementById('mun-editar-usuario-email').value = email || '';
    document.getElementById('mun-editar-usuario-celular').value = celular ? maskPhone(celular) : '';
    const modal = document.getElementById('modal-mun-editar-usuario');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
  function fecharModalMunEditar() {
    const modal = document.getElementById('modal-mun-editar-usuario');
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }

  document.getElementById('mun-tabela-acessos')?.addEventListener('click', async (e) => {
    const btnEditar = e.target.closest('.btn-mun-editar');
    if (btnEditar) {
      abrirModalMunEditar(btnEditar.dataset.cpf, btnEditar.dataset.email, btnEditar.dataset.celular);
      return;
    }
    const btn = e.target.closest('.btn-mun-suspend');
    if (!btn) return;
    const cpf = btn.dataset.cpf;
    const currentStatus = btn.dataset.status;
    const newStatus = currentStatus === 'Ativo' ? 'Inativo' : 'Ativo';

    try {
      await fetch(`${getBackendUrl()}/users/${encodeURIComponent(cpf)}`, {
        method: 'PUT',
        headers: authH({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: newStatus })
      });
      toast.success(`Servidor ${newStatus === 'Ativo' ? 'reativado' : 'suspenso'} com sucesso.`);
      loadUsers();
    } catch (e) {
      toast.error('Falha ao alterar status.');
    }
  });

  document.getElementById('btn-mun-save-user')?.addEventListener('click', async () => {
    const cpf = document.getElementById('mun-novo-cpf').value;
    const name = document.getElementById('mun-novo-nome').value;
    const email = document.getElementById('mun-novo-email').value?.trim();
    const celular = document.getElementById('mun-novo-celular').value?.replace(/\D/g, '');
    const role = document.getElementById('mun-novo-role').value;

    if (!cpf || cpf.length < 14 || !name) {
      toast.warning('Preencha CPF e Nome.');
      return;
    }
    if (!email) {
      toast.warning('E-mail é obrigatório.');
      return;
    }
    if (!celular || celular.length < 10) {
      toast.warning('Celular é obrigatório (mínimo 10 dígitos).');
      return;
    }

    try {
      const resp = await fetch(`${getBackendUrl()}/users`, {
        method: 'POST',
        headers: authH({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ cpf, name, email, celular, role, userType: 'municipio', password: '12345678' })
      });
      const data = await resp.json();
      if (resp.ok) {
        toast.success('Servidor cadastrado com sucesso.');
        document.getElementById('mun-novo-cpf').value = '';
        document.getElementById('mun-novo-nome').value = '';
        document.getElementById('mun-novo-email').value = '';
        document.getElementById('mun-novo-celular').value = '';
        loadUsers();
      } else {
        toast.error(data.error || 'Falha ao cadastrar.');
      }
    } catch (e) {
      toast.error('Erro de conexão ao cadastrar servidor.');
    }
  });

  document.getElementById('fechar-modal-mun-editar')?.addEventListener('click', fecharModalMunEditar);
  document.getElementById('btn-mun-cancelar-editar')?.addEventListener('click', fecharModalMunEditar);
  document.getElementById('mun-editar-usuario-celular')?.addEventListener('input', (e) => {
    e.target.value = maskPhone(e.target.value.replace(/\D/g, ''));
  });
  document.getElementById('btn-mun-salvar-editar')?.addEventListener('click', async () => {
    const cpf = document.getElementById('mun-editar-usuario-cpf').value;
    const email = document.getElementById('mun-editar-usuario-email').value?.trim();
    const celular = document.getElementById('mun-editar-usuario-celular').value?.replace(/\D/g, '');
    if (!email) { toast.warning('E-mail é obrigatório.'); return; }
    if (!celular || celular.length < 10) { toast.warning('Celular é obrigatório (mínimo 10 dígitos).'); return; }
    try {
      const resp = await fetch(`${getBackendUrl()}/users/${encodeURIComponent(cpf)}`, {
        method: 'PUT',
        headers: authH({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ email, celular })
      });
      if (resp.ok) {
        toast.success('E-mail e celular atualizados.');
        fecharModalMunEditar();
        loadUsers();
      } else {
        const data = await resp.json();
        toast.error(data.error || 'Falha ao atualizar.');
      }
    } catch (e) { toast.error('Falha ao atualizar.'); }
  });

  document.getElementById('btn-mun-filtrar')?.addEventListener('click', () => {
    const nameFilter = document.getElementById('mun-filtro-nome').value.toLowerCase();
    const roleFilter = document.getElementById('mun-filtro-role').value;
    let filtered = allUsers;
    if (nameFilter) filtered = filtered.filter(u => u.name.toLowerCase().includes(nameFilter));
    if (roleFilter) filtered = filtered.filter(u => u.role === roleFilter);
    renderTable(filtered);
  });

  loadUsers();
}
