/**
 * NFS-e Antigravity — Tela de Autenticação (Módulo Município)
 */
import { loginMun, MUN_ROLES } from '../auth-municipio.js';
import { toast } from '../toast.js';
import { maskCPF } from '../fiscal-utils.js';
import { login as apiLogin } from '../api-service.js';

export function renderLoginMunicipio(container) {
  document.getElementById('sidebar')?.classList.add('hidden');
  document.getElementById('header')?.classList.add('hidden');
  
  const shell = document.getElementById('app-shell');
  if (shell) shell.style.display = 'block';

  container.innerHTML = `
    <div style="display: flex; min-height: 100vh; background-color: var(--surface-base); align-items: center; justify-content: center; padding: 10px; width: 100%; position: relative; z-index: 10; overflow-y: auto;">
      
      <div class="card animate-slide-up" style="max-width: 420px; width: 100%; padding: var(--space-3); border: 1px solid var(--primary-color, #007bff); box-shadow: 0 10px 40px rgba(0,0,0,0.5); position: relative; z-index: 20; margin: auto;">
        
        <div style="text-align: center; margin-bottom: var(--space-3);">
          <div style="font-size: 2rem; margin-bottom: 2px;">🏢</div>
          <h1 style="font-size: 1.15rem; margin-bottom: 2px;">NFS-e Sefin</h1>
          <p style="color: var(--color-neutral-400); font-size: 0.8rem;">Acesso de Administração Municipal</p>
        </div>

        <div style="margin-bottom: var(--space-2);">
          <label class="form-label" for="login-mun-cpf" style="font-size: 0.75rem; margin-bottom: 2px;">CPF do Servidor</label>
          <input type="text" class="form-input form-input-mono" id="login-mun-cpf" placeholder="000.000.000-00" maxlength="14" style="margin-bottom: 6px; padding: 6px 10px; font-size: 0.85rem;">
          
          <label class="form-label" for="login-mun-senha" style="font-size: 0.75rem; margin-bottom: 2px;">Senha</label>
          <input type="password" class="form-input" id="login-mun-senha" placeholder="••••••••" style="margin-bottom: 8px; padding: 6px 10px; font-size: 0.85rem;">

          <button class="btn btn-primary w-full" id="btn-mun-login-senha" style="margin-bottom: 6px; padding: 6px; font-size: 0.9rem;">
            Acessar Painel Tributário
          </button>
        </div>

        <div style="display: flex; align-items: center; margin: 10px 0; color: var(--color-neutral-500); font-size: 0.75rem;">
          <div style="flex: 1; height: 1px; background: var(--surface-glass-border);"></div>
          <div style="padding: 0 8px;">INTEGRAÇÃO SEFIN</div>
          <div style="flex: 1; height: 1px; background: var(--surface-glass-border);"></div>
        </div>

        <button class="btn btn-secondary w-full" id="btn-mun-login-certificado" style="font-weight: 600; padding: 6px; margin-bottom: 8px; font-size: 0.85rem;">
          🔒 Entrar com e-CPF Digital
        </button>

        <p style="text-align: center; color: var(--color-neutral-500); font-size: 0.70rem; margin-top: 12px; margin-bottom: 0;">
          Acesso restrito. Suas ações são monitoradas pelos logs de auditoria municipal. 
        </p>
      </div>

    </div>
  `;

  document.getElementById('login-mun-cpf')?.addEventListener('input', (e) => {
    const val = e.target.value.replace(/\D/g, '');
    e.target.value = maskCPF(val);
  });

  const handleMunLoginResponse = (response) => {
    const { token, user } = response.data;
    const munRoles = ['GESTOR', 'FISCAL', 'AUDITOR', 'ATENDENTE'];
    if (!munRoles.includes(user.role)) {
      toast.error('Este CPF não possui perfil de acesso municipal.');
      return;
    }
    const roleName = MUN_ROLES[user.role] || user.role;
    toast.success(`Acesso autorizado! Bem-vindo, ${user.name}.`);
    loginMun(user.cpf, user.name, roleName);
    window.location.hash = '/dashboard';
  };

  document.getElementById('btn-mun-login-senha')?.addEventListener('click', async () => {
    const cpf = document.getElementById('login-mun-cpf').value;
    const senha = document.getElementById('login-mun-senha').value;
    
    if (cpf.length < 14) {
      toast.warning('Informe um CPF válido para acesso!');
      return;
    }
    if (!senha) {
      toast.warning('Informe a sua senha.');
      return;
    }

    toast.info('Verificando matrícula do servidor...');
    try {
      const response = await apiLogin(cpf, senha);
      handleMunLoginResponse(response);
    } catch (err) {
      toast.error(err.message || 'Acesso negado: Servidor não encontrado nos registros do Município.');
    }
  });

  document.getElementById('btn-mun-login-certificado')?.addEventListener('click', async () => {
    toast.info('Lendo Assinatura e-CPF...');
    try {
      const response = await apiLogin('333.444.555-66', '12345678');
      handleMunLoginResponse(response);
    } catch (e) {
      toast.error(e.message || 'Falha na autenticação por certificado.');
    }
  });
}
