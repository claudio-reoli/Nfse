/**
 * NFS-e Antigravity — Gestão de Acessos (Módulo Município)
 */
import { MUN_ROLES, isMunAuthorized } from '../auth-municipio.js';
import { toast } from '../toast.js';
import { maskCPF } from '../fiscal-utils.js';
import { getBackendUrl } from '../api-service.js';

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
        </div>
        <div style="text-align: right;">
          <button class="btn btn-primary" id="btn-mun-save-user">Salvar Servidor</button>
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
              <th>Papel / Cargo</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="mun-tabela-acessos">
            <tr><td colspan="5" style="text-align:center;">Carregando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  let allUsers = [];

  document.getElementById('mun-novo-cpf')?.addEventListener('input', (e) => {
    e.target.value = maskCPF(e.target.value.replace(/\D/g, ''));
  });

  async function loadUsers() {
    try {
      const resp = await fetch(`${getBackendUrl()}/users?type=municipio`);
      allUsers = await resp.json();
      renderTable(allUsers);
    } catch (e) {
      toast.error('Falha ao listar servidores.');
    }
  }

  function renderTable(users) {
    const tbody = document.getElementById('mun-tabela-acessos');
    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhum servidor encontrado.</td></tr>';
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
        <td><span class="badge ${roleBadge(a.role)}">${MUN_ROLES[a.role] || a.role}</span></td>
        <td>
          <span class="badge ${a.status === 'Ativo' ? 'badge-success' : 'badge-warning'}">
            ${a.status || 'Ativo'}
          </span>
        </td>
        <td>
          <div class="btn-group">
            <button class="btn btn-ghost btn-sm btn-mun-suspend" data-cpf="${a.cpf}" data-status="${a.status || 'Ativo'}" style="color: var(--color-danger-400);">
              ${(a.status || 'Ativo') === 'Ativo' ? 'Suspender' : 'Reativar'}
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  document.getElementById('mun-tabela-acessos')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-mun-suspend');
    if (!btn) return;
    const cpf = btn.dataset.cpf;
    const currentStatus = btn.dataset.status;
    const newStatus = currentStatus === 'Ativo' ? 'Inativo' : 'Ativo';

    try {
      await fetch(`${getBackendUrl()}/users/${encodeURIComponent(cpf)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
    const role = document.getElementById('mun-novo-role').value;

    if (!cpf || cpf.length < 14 || !name) {
      toast.warning('Preencha CPF e Nome.');
      return;
    }

    try {
      const resp = await fetch(`${getBackendUrl()}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf, name, role, userType: 'municipio', password: '12345678' })
      });
      const data = await resp.json();
      if (resp.ok) {
        toast.success('Servidor cadastrado com sucesso.');
        document.getElementById('mun-novo-cpf').value = '';
        document.getElementById('mun-novo-nome').value = '';
        loadUsers();
      } else {
        toast.error(data.error || 'Falha ao cadastrar.');
      }
    } catch (e) {
      toast.error('Erro de conexão ao cadastrar servidor.');
    }
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
