/**
 * NFS-e Antigravity — Gestão de Acessos (Production Ready)
 */
import { getSession, ROLES, isAuthorized } from '../auth.js';
import { toast } from '../toast.js';
import { maskCPF, maskCNPJ } from '../fiscal-utils.js';
import { consultarCNPJ, getUsers, createUser, deleteUser } from '../api-service.js';

export function renderGestaoAcessos(container) {
  if (!isAuthorized([ROLES.MASTER, ROLES.CONTADOR])) {
    container.innerHTML = `<div class="empty-state">🚫 Acesso Negado</div>`;
    return;
  }

  const isMaster = getSession()?.role === ROLES.MASTER;

  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">Gestão de Acessos da Empresa</h1>
        <p class="page-description">Gerencie as permissões vinculadas ao CNPJ.</p>
      </div>
    </div>

    <div class="card animate-slide-up mb-6">
      <div class="card-header"><h3 class="card-title">🛡️ Adicionar Usuário</h3></div>
      <div class="card-body">
        <div class="grid grid-3 gap-4 mb-4">
          <div class="form-group"><label class="form-label">CPF</label><input type="text" class="form-input form-input-mono" id="novo-acesso-cpf" placeholder="000.000.000-00"></div>
          <div class="form-group"><label class="form-label">Nome</label><input type="text" class="form-input" id="novo-acesso-nome"></div>
          <div class="form-group">
            <label class="form-label">Perfil</label>
            <select class="form-select" id="novo-acesso-perfil">
              <option value="FATURISTA">Faturista</option>
              <option value="CONTADOR">Contador</option>
              <option value="AUDITOR">Auditor</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">Nível Auth</label><select class="form-select" id="novo-acesso-nivel"><option value="GOVBR_OURO">Gov.br Ouro</option><option value="CERTIFICADO_A1_A3">Certificado Digital</option></select></div>
          <div class="form-group"><label class="form-label">Senha Inicial</label><input type="password" class="form-input" id="novo-acesso-senha" value="12345678"></div>
        </div>
        <div style="text-align: right;"><button class="btn btn-primary" id="btn-save-acesso">Salvar Usuário</button></div>
      </div>
    </div>

    <div class="card animate-slide-up">
      <div class="card-header"><h3 class="card-title">📜 Usuários Ativos</h3></div>
      <div class="card-body" style="padding: 0;">
        <table class="data-table">
          <thead><tr><th>CPF</th><th>Nome</th><th>Perfil</th><th>Origem</th><th>Ações</th></tr></thead>
          <tbody id="tabela-acessos"><tr><td colspan="5" style="text-align:center;">Carregando...</td></tr></tbody>
        </table>
      </div>
    </div>
  `;

  async function loadUsers() {
    try {
      const resp = await getUsers();
      const users = resp.data;
      const tbody = document.getElementById('tabela-acessos');
      tbody.innerHTML = users.map(u => `
        <tr>
          <td class="cell-mono">${u.cpf}</td>
          <td>${u.name}</td>
          <td><span class="badge ${u.role === 'MASTER' ? 'badge-danger' : 'badge-primary'}">${u.role}</span></td>
          <td>${u.authLevel}</td>
          <td>
            ${u.cpf !== getSession()?.cpf ? `<button class="btn btn-ghost btn-sm btn-revogar" data-cpf="${u.cpf}" style="color:var(--color-danger-400);">Revogar</button>` : '---'}
          </td>
        </tr>
      `).join('');
    } catch(e) { toast.error('Falha ao listar usuários.'); }
  }

  document.getElementById('tabela-acessos')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-revogar');
    if (!btn) return;
    const cpf = btn.dataset.cpf;
    if (!confirm('Revogar acesso?')) return;
    try {
      await deleteUser(cpf);
      toast.success('Acesso revogado com sucesso.');
      loadUsers();
    } catch(e) { toast.error('Falha ao revogar.'); }
  });

  document.getElementById('btn-save-acesso')?.addEventListener('click', async () => {
    const data = {
      cpf: document.getElementById('novo-acesso-cpf').value,
      name: document.getElementById('novo-acesso-nome').value,
      role: document.getElementById('novo-acesso-perfil').value,
      authLevel: document.getElementById('novo-acesso-nivel').value,
      password: document.getElementById('novo-acesso-senha').value,
      cnpjVinculado: getSession()?.cnpj
    };
    
    if (!data.cpf || !data.name) { toast.warning('Preencha os campos obrigatórios.'); return; }

    try {
      await createUser(data);
      toast.success('Usuário criado com sucesso.');
      loadUsers();
    } catch(e) { toast.error('Falha ao criar usuário.'); }
  });

  loadUsers();
}
