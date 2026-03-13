/**
 * NFS-e Freire — Gestão de Acessos (Production Ready)
 */
import { getSession, ROLES, isAuthorized } from '../auth.js';
import { toast } from '../toast.js';
import { maskCPF, maskCNPJ, maskPhone } from '../fiscal-utils.js';
import { getUsers, createUser, updateUser, deleteUser } from '../api-service.js';

export function renderGestaoAcessos(container) {
  if (!isAuthorized(['MASTER', 'CONTADOR'])) {
    container.innerHTML = `<div class="empty-state">🚫 Acesso Negado</div>`;
    return;
  }

  const isMaster = ['MASTER', ROLES.MASTER].includes(getSession()?.role);

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
          <div class="form-group"><label class="form-label">E-mail <span class="text-danger">*</span></label><input type="email" class="form-input" id="novo-acesso-email" placeholder="usuario@exemplo.com" required></div>
          <div class="form-group"><label class="form-label">Celular <span class="text-danger">*</span></label><input type="tel" class="form-input form-input-mono" id="novo-acesso-celular" placeholder="(00) 00000-0000" maxlength="16" required></div>
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
          <thead><tr><th>CPF</th><th>Nome</th><th>E-mail</th><th>Celular</th><th>Perfil</th><th>Origem</th><th>Ações</th></tr></thead>
          <tbody id="tabela-acessos"><tr><td colspan="7" style="text-align:center;">Carregando...</td></tr></tbody>
        </table>
      </div>
    </div>

    <div id="modal-editar-usuario" class="modal-overlay hidden" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:1000;align-items:center;justify-content:center;display:none;">
      <div class="card" style="max-width: 420px; width: 90%;">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
          <h3 class="card-title">Editar E-mail e Celular</h3>
          <button id="fechar-modal-editar" class="btn btn-ghost" style="color:var(--color-danger-400);">✕</button>
        </div>
        <div class="card-body">
          <input type="hidden" id="editar-usuario-cpf">
          <div class="form-group mb-4">
            <label class="form-label">E-mail <span class="text-danger">*</span></label>
            <input type="email" class="form-input" id="editar-usuario-email" placeholder="usuario@exemplo.com" required>
          </div>
          <div class="form-group mb-4">
            <label class="form-label">Celular <span class="text-danger">*</span></label>
            <input type="tel" class="form-input form-input-mono" id="editar-usuario-celular" placeholder="(00) 00000-0000" maxlength="16" required>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button id="btn-cancelar-editar" class="btn btn-secondary">Cancelar</button>
            <button id="btn-salvar-editar" class="btn btn-primary">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  async function loadUsers() {
    const tbody = document.getElementById('tabela-acessos');
    if (!tbody) return;
    try {
      const resp = await getUsers({ type: 'contribuinte' });
      const users = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
      tbody.innerHTML = users.length === 0
        ? '<tr><td colspan="7" style="text-align:center;">Nenhum usuário cadastrado.</td></tr>'
        : users.map(u => `
        <tr>
          <td class="cell-mono">${u.cpf || ''}</td>
          <td>${u.name || ''}</td>
          <td>${u.email || '—'}</td>
          <td>${u.celular ? maskPhone(u.celular) : '—'}</td>
          <td><span class="badge ${u.role === 'MASTER' ? 'badge-danger' : 'badge-primary'}">${u.role || ''}</span></td>
          <td>${u.authLevel || ''}</td>
          <td>
            <button class="btn btn-ghost btn-sm btn-editar-usuario" data-cpf="${u.cpf}" data-email="${u.email || ''}" data-celular="${u.celular || ''}">Editar</button>
            ${u.cpf !== getSession()?.cpf ? `<button class="btn btn-ghost btn-sm btn-revogar" data-cpf="${u.cpf}" style="color:var(--color-danger-400);">Revogar</button>` : ''}
          </td>
        </tr>
      `).join('');
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--color-danger-400);">Erro ao carregar usuários.</td></tr>';
      toast.error('Falha ao listar usuários.');
    }
  }

  function abrirModalEditar(cpf, email, celular) {
    document.getElementById('editar-usuario-cpf').value = cpf;
    document.getElementById('editar-usuario-email').value = email || '';
    document.getElementById('editar-usuario-celular').value = celular ? maskPhone(celular) : '';
    const modal = document.getElementById('modal-editar-usuario');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
  function fecharModalEditar() {
    const modal = document.getElementById('modal-editar-usuario');
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }

  document.getElementById('tabela-acessos')?.addEventListener('click', async (e) => {
    const btnEditar = e.target.closest('.btn-editar-usuario');
    if (btnEditar) {
      abrirModalEditar(btnEditar.dataset.cpf, btnEditar.dataset.email, btnEditar.dataset.celular);
      return;
    }
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

  document.getElementById('fechar-modal-editar')?.addEventListener('click', fecharModalEditar);
  document.getElementById('btn-cancelar-editar')?.addEventListener('click', fecharModalEditar);
  document.getElementById('editar-usuario-celular')?.addEventListener('input', (e) => {
    e.target.value = maskPhone(e.target.value.replace(/\D/g, ''));
  });
  document.getElementById('btn-salvar-editar')?.addEventListener('click', async () => {
    const cpf = document.getElementById('editar-usuario-cpf').value;
    const email = document.getElementById('editar-usuario-email').value?.trim();
    const celular = document.getElementById('editar-usuario-celular').value?.replace(/\D/g, '');
    if (!email) { toast.warning('E-mail é obrigatório.'); return; }
    if (!celular || celular.length < 10) { toast.warning('Celular é obrigatório (mínimo 10 dígitos).'); return; }
    try {
      await updateUser(cpf, { email, celular });
      toast.success('E-mail e celular atualizados.');
      fecharModalEditar();
      loadUsers();
    } catch (err) { toast.error('Falha ao atualizar.'); }
  });

  document.getElementById('novo-acesso-cpf')?.addEventListener('input', (e) => {
    e.target.value = maskCPF(e.target.value.replace(/\D/g, ''));
  });
  document.getElementById('novo-acesso-celular')?.addEventListener('input', (e) => {
    e.target.value = maskPhone(e.target.value.replace(/\D/g, ''));
  });

  document.getElementById('btn-save-acesso')?.addEventListener('click', async () => {
    const data = {
      cpf: document.getElementById('novo-acesso-cpf').value,
      name: document.getElementById('novo-acesso-nome').value,
      email: document.getElementById('novo-acesso-email').value?.trim(),
      celular: document.getElementById('novo-acesso-celular').value?.replace(/\D/g, ''),
      role: document.getElementById('novo-acesso-perfil').value,
      authLevel: document.getElementById('novo-acesso-nivel').value,
      password: document.getElementById('novo-acesso-senha').value,
      cnpjVinculado: getSession()?.cnpj
    };
    
    if (!data.cpf || !data.name) { toast.warning('Preencha CPF e Nome.'); return; }
    if (!data.email) { toast.warning('E-mail é obrigatório.'); return; }
    if (!data.celular || data.celular.length < 10) { toast.warning('Celular é obrigatório (mínimo 10 dígitos).'); return; }

    try {
      await createUser(data);
      toast.success('Usuário criado com sucesso.');
      loadUsers();
    } catch(e) { toast.error('Falha ao criar usuário.'); }
  });

  loadUsers();
}
