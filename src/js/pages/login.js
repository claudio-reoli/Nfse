/**
 * NFS-e Antigravity — Tela de Autenticação (Production Ready)
 */
import { login as authLogin, ROLES, AUTH_LEVELS } from '../auth.js';
import { login as apiLogin, loginByCertificate } from '../api-service.js';
import { loadCertificateA1, setCertStore } from '../digital-signature.js';
import { toast } from '../toast.js';
import { maskCPF } from '../fiscal-utils.js';

export function renderLogin(container) {
  // Hide UI structure
  document.getElementById('sidebar')?.classList.add('hidden');
  document.getElementById('header')?.classList.add('hidden');
  const shell = document.getElementById('app-shell');
  if (shell) shell.style.display = 'block';

  container.innerHTML = `
    <div style="display: flex; min-height: 100vh; background-color: var(--surface-base); align-items: center; justify-content: center; padding: 10px; width: 100%; position: relative; z-index: 10; overflow-y: auto;">
      <div class="card animate-slide-up" style="max-width: 420px; width: 100%; padding: var(--space-3); border: 1px solid var(--surface-glass-border); box-shadow: 0 10px 40px rgba(0,0,0,0.5); position: relative; z-index: 20; margin: auto;">
        
        <div style="text-align: center; margin-bottom: var(--space-3);">
          <div style="font-size: 2rem; margin-bottom: 2px;">🏛️</div>
          <h1 style="font-size: 1.15rem; margin-bottom: 2px;">NFS-e Padrão Nacional</h1>
          <p style="color: var(--color-neutral-400); font-size: 0.8rem;">Emissor Web do Contribuinte</p>
        </div>

        <div style="margin-bottom: var(--space-2);">
          <label class="form-label" for="login-cpf" style="font-size: 0.75rem; margin-bottom: 2px;">CPF</label>
          <input type="text" class="form-input form-input-mono" id="login-cpf" placeholder="000.000.000-00" maxlength="14" style="margin-bottom: 6px; padding: 6px 10px; font-size: 0.85rem;">
          
          <label class="form-label" for="login-senha" style="font-size: 0.75rem; margin-bottom: 2px;">Senha</label>
          <input type="password" class="form-input" id="login-senha" placeholder="••••••••" style="margin-bottom: 8px; padding: 6px 10px; font-size: 0.85rem;">

          <button class="btn btn-primary w-full" id="btn-login-senha" style="margin-bottom: 6px; padding: 6px; font-size: 0.9rem;">
            Entrar
          </button>
          
          <div style="text-align: right;">
            <a href="#" id="link-recuperar-senha" style="font-size: 0.75rem; color: var(--color-accent-400); text-decoration: none; font-weight: 500;">Esqueci minha senha</a>
          </div>
        </div>

        <div style="display: flex; align-items: center; margin: 10px 0; color: var(--color-neutral-500); font-size: 0.75rem;">
          <div style="flex: 1; height: 1px; background: var(--surface-glass-border);"></div>
          <div style="padding: 0 8px;">OU</div>
          <div style="flex: 1; height: 1px; background: var(--surface-glass-border);"></div>
        </div>

        <div style="background: rgba(0, 86, 180, 0.1); border: 1px solid #0056b4; border-radius: var(--radius-md); padding: 10px; margin-bottom: 12px;">
          <button class="btn btn-primary w-full" id="btn-login-govbr" style="background: linear-gradient(135deg, #0056b4, #004494); font-weight: 600; padding: 6px; font-size: 0.9rem;">
            Entrar com gov.br
          </button>
        </div>

        <button class="btn btn-secondary w-full" id="btn-login-certificado" style="font-weight: 600; padding: 6px; margin-bottom: 8px; font-size: 0.85rem;">
          🔒 Certificado Digital (A1/A3)
        </button>

        <div id="cert-login-panel" class="hidden" style="background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: var(--radius-md); padding: 10px; margin-bottom: 8px;">
          <div style="font-size: 0.75rem; color: var(--color-neutral-400); margin-bottom: 6px; font-weight: 600;">Selecione o certificado A1 (.pfx / .p12)</div>
          <input type="file" accept=".pfx,.p12" id="cert-login-file" class="form-input" style="padding: 4px 8px; font-size: 0.8rem; margin-bottom: 6px;">
          <label class="form-label" for="cert-login-senha" style="font-size: 0.75rem; margin-bottom: 2px;">Senha do certificado</label>
          <input type="password" class="form-input" id="cert-login-senha" placeholder="••••••••" autocomplete="off" style="padding: 6px 10px; font-size: 0.85rem; margin-bottom: 8px;">
          <button class="btn btn-primary w-full" id="btn-cert-autenticar" style="padding: 6px; font-size: 0.9rem;">
            Autenticar com Certificado
          </button>
        </div>

        <p style="text-align: center; color: var(--color-neutral-500); font-size: 0.70rem; margin-top: 12px; margin-bottom: 0;">
          Acesso seguro via JWT e Auditoria RBAC.
        </p>
      </div>
    </div>
  `;

  document.getElementById('login-cpf')?.addEventListener('input', (e) => {
    e.target.value = maskCPF(e.target.value.replace(/\D/g, ''));
  });

  const handleLoginResponse = (response) => {
    const { token, user } = response.data;
    toast.success(`Bem-vindo(a), ${user.name}!`);
    authLogin(user.cpf, user.name, user.role, user.authLevel, token, user.cnpj);
    window.location.hash = '/dashboard';
  };

  document.getElementById('btn-login-senha')?.addEventListener('click', async () => {
    const cpf = document.getElementById('login-cpf').value;
    const password = document.getElementById('login-senha').value;
    
    if (cpf.length < 14 || !password) {
      toast.warning('Preencha CPF e Senha.');
      return;
    }

    try {
      toast.info('Autenticando...');
      const response = await apiLogin(cpf, password);
      handleLoginResponse(response);
    } catch (err) {
      toast.error(err.message || 'Falha na autenticação.');
    }
  });

  // Gov.br / Certificado simulation using backend seeds
  document.getElementById('btn-login-govbr')?.addEventListener('click', async () => {
    toast.info('Simulando autenticação Gov.br...');
    // In prod, this would be a redirect. Here we just use one of the seed users for demo.
    try {
      const resp = await apiLogin('111.222.333-44', '12345678');
      handleLoginResponse(resp);
    } catch(e) { toast.error(e.message); }
  });

  document.getElementById('btn-login-certificado')?.addEventListener('click', () => {
    const panel = document.getElementById('cert-login-panel');
    panel?.classList.toggle('hidden');
  });

  document.getElementById('btn-cert-autenticar')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('cert-login-file');
    const senha = document.getElementById('cert-login-senha')?.value;

    if (!fileInput?.files?.length) {
      toast.warning('Selecione o arquivo do certificado (.pfx / .p12).');
      return;
    }
    if (!senha) {
      toast.warning('Informe a senha do certificado.');
      return;
    }

    try {
      toast.info('Lendo certificado digital...');
      const buffer = await fileInput.files[0].arrayBuffer();
      const certData = await loadCertificateA1(buffer, senha);

      const cnpjMatch = (certData.subject || '').match(/\d{14}/);
      const cnpj = cnpjMatch ? cnpjMatch[0] : '';

      if (!cnpj) {
        toast.error('CNPJ não encontrado no certificado. Verifique se é um e-CNPJ válido.');
        return;
      }

      toast.info('Autenticando via certificado...');
      const response = await loginByCertificate(certData.certificateB64, certData.subject, cnpj);

      setCertStore(certData);
      handleLoginResponse(response);
    } catch (err) {
      toast.error(err.message || 'Falha na autenticação por certificado.');
    }
  });
}
