/**
 * NFS-e Freire — Main Application
 * Entry point and router setup
 */
import { Router } from './router.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderEmissaoDPS } from './pages/emissao-dps.js';
import { renderConsultaNFSe } from './pages/consulta-nfse.js';
import { renderEventos } from './pages/eventos.js';
import { renderADN } from './pages/adn.js';
import { renderConfiguracoes, startCertExpiryWatch } from './pages/configuracoes.js';
import { renderParametros } from './pages/parametros.js';
import { renderLogin } from './pages/login.js';
import { renderGestaoAcessos } from './pages/gestao-acessos.js';
import { renderXmlAssinado } from './pages/xml-assinado.js';
import { renderGuiasContribuinte } from './pages/guias-contribuinte.js';
import { renderMinhasNotas } from './pages/minhas-notas.js';
import { getSession, logout, isAuthorized, ROLES, AUTH_LEVELS } from './auth.js';
import { setEnvironment, setDemoMode, fetchConfigAmbiente } from './api-service.js';
import { onConfigSaved } from './config-sync.js';

const AMB_STORAGE_KEY = 'nfse_last_ambiente';

function updateEnvBadge(ambiente) {
  const badge = document.getElementById('env-badge');
  if (!badge) return;
  const amb = ambiente || 'sandbox';
  badge.textContent = amb === 'production' ? '🔴 Produção' : '⚡ Sandbox';
  badge.style.background = amb === 'production' ? 'linear-gradient(135deg, #DC2626, #B91C1C)' : '';
  badge.className = 'header-env-badge' + (amb === 'production' ? ' production' : '');
  try { localStorage.setItem(AMB_STORAGE_KEY, amb); } catch (_) {}
}

async function refreshAmbienteFromBackend() {
  try {
    const data = await fetchConfigAmbiente();
    const amb = data?.ambiente || 'sandbox';
    const urlSefin = data?.urlSefin || (amb === 'production' ? 'sefin.nfse.gov.br' : 'sefin.producaorestrita.nfse.gov.br');
    const urlAdn = data?.urlAdn || (amb === 'production' ? 'adn.nfse.gov.br' : 'adn.producaorestrita.nfse.gov.br');
    setEnvironment(amb);
    updateEnvBadge(amb);
    const cfgBadge = document.getElementById('cfg-amb-badge');
    const sefinEl = document.getElementById('cfg-url-sefin-display');
    const adnEl = document.getElementById('cfg-url-adn-display');
    if (cfgBadge) {
      cfgBadge.textContent = amb === 'production' ? '🔴 Produção' : '⚡ Sandbox';
      cfgBadge.className = 'badge ' + (amb === 'production' ? 'badge-danger' : 'badge-warning');
    }
    if (sefinEl) sefinEl.value = urlSefin;
    if (adnEl) adnEl.value = urlAdn;
  } catch (_) {}
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getSession() && window.location.hash !== '#/login') {
    window.location.hash = '/login';
  }

  const contentEl = document.getElementById('main-content');
  if (!contentEl) return;

  // Ambiente: fonte única no backend (módulo Município). Badge e proxy usam essa config.
  const lastAmb = localStorage.getItem(AMB_STORAGE_KEY) || 'sandbox';
  setEnvironment(lastAmb);
  updateEnvBadge(lastAmb);
  refreshAmbienteFromBackend().catch(() => {
    setEnvironment('sandbox');
    updateEnvBadge('sandbox');
  });

  // Demo mode: mantido em localStorage (preferência local)
  try {
    const settingsStr = localStorage.getItem('nfse_settings');
    if (settingsStr) {
      const settings = JSON.parse(settingsStr);
      setDemoMode(!!settings.demoMode);
    } else {
      setDemoMode(false);
    }
  } catch (e) {
    setDemoMode(false);
  }

  // ─── Router Setup ────────────────────────────
  const router = new Router(contentEl, {
    onRouteChange: () => { if (getSession()) refreshAmbienteFromBackend(); }
  });
  router
    .register('/login', renderLogin)
    .register('/dashboard', renderDashboard)
    .register('/gestao-acessos', renderGestaoAcessos)
    .register('/emissao-dps', renderEmissaoDPS)
    .register('/consulta-nfse', renderConsultaNFSe)
    .register('/eventos', renderEventos)
    .register('/adn', renderADN)
    .register('/guias', renderGuiasContribuinte)
    .register('/minhas-notas', renderMinhasNotas)
    .register('/decisao-judicial', (c) => {
      c.innerHTML = `
        <div class="page-header animate-slide-up">
          <div>
            <h1 class="page-title">Decisão Administrativa / Judicial</h1>
            <p class="page-description">Emissão de NFS-e por bypass — POST /decisao-judicial/nfse</p>
          </div>
        </div>
        <div class="card animate-slide-up">
          <div class="card-body">
            <div class="empty-state">
              <div class="icon">⚖️</div>
              <p style="font-size: var(--text-md); font-weight: 500; color: var(--color-neutral-300); margin-bottom: var(--space-2);">Fluxo de Bypass</p>
              <p style="font-size: var(--text-sm); max-width: 500px;">
                  Este módulo permite emissão de NFS-e completa (DPS + campos calculados) 
                  quando autorizado por decisão administrativa ou judicial. 
                  O contribuinte informa todos os tributos e local de incidência.
                  <br><br>
                  <strong>Pré-requisito:</strong> O Município deve cadastrar a decisão no sistema nacional.
              </p>
              <div style="margin-top: var(--space-6); display: flex; gap: var(--space-3);">
                <span class="badge badge-warning">cStat = 102</span>
                <span class="badge badge-primary">ambGer = 2</span>
                <span class="badge badge-success">tpEmis = 1</span>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .register('/parametros', renderParametros)
    .register('/configuracoes', renderConfiguracoes);

  // Start router
  router.start();

  // Start certificate expiry monitoring
  startCertExpiryWatch();

  // ─── Sidebar Navigation ────────────────────────────
  document.querySelectorAll('.nav-item[data-route]').forEach(item => {
    item.addEventListener('click', () => {
      router.navigate(item.dataset.route);
      // Close mobile sidebar
      document.querySelector('.sidebar')?.classList.remove('mobile-open');
    });
  });

  // ─── Sidebar Toggle ────────────────────────────────
  const toggleBtn = document.getElementById('sidebar-toggle');
  const appShell = document.querySelector('.app-shell');
  if (toggleBtn && appShell) {
    toggleBtn.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        document.querySelector('.sidebar')?.classList.toggle('mobile-open');
      } else {
        appShell.classList.toggle('sidebar-collapsed');
      }
    });
  }

  // ─── Authentication Flow Control ─────────────────────
  
  async function updateUIForSession() {
    const session = getSession();
    const shell = document.getElementById('app-shell');
    const sidebar = document.getElementById('sidebar');
    const header = document.getElementById('header');

    if (session) {
      if (shell) shell.style.display = '';
      sidebar?.classList.remove('hidden');
      header?.classList.remove('hidden');

      const nameEl = document.getElementById('sidebar-user-name');
      const roleEl = document.getElementById('sidebar-user-role');
      const avatarEl = document.getElementById('sidebar-user-avatar');
      
      if(nameEl) nameEl.textContent = session.name;
      if(roleEl) roleEl.textContent = session.role;
      if(avatarEl) avatarEl.textContent = session.name.substring(0, 2).toUpperCase();

      await refreshAmbienteFromBackend().catch(() => updateEnvBadge('sandbox'));

      if (['FATURISTA', ROLES.FATURISTA].includes(session.role)) {
        document.getElementById('nav-configuracoes')?.style.setProperty('display', 'none');
        document.getElementById('nav-gestao-acessos')?.style.setProperty('display', 'none');
      } else {
        document.getElementById('nav-configuracoes')?.style.setProperty('display', 'flex');
        document.getElementById('nav-gestao-acessos')?.style.setProperty('display', 'flex');
      }
    } else {
      if (shell) shell.style.display = 'block';
      sidebar?.classList.add('hidden');
      header?.classList.add('hidden');
    }
  }

  // Intercept Hash changes for route guarding
  window.addEventListener('hashchange', () => {
    const currentHash = window.location.hash || '#/dashboard';
    const session = getSession();
    if (!session && currentHash !== '#/login') {
      window.location.hash = '/login';
    } else if (session && currentHash === '#/login') {
      window.location.hash = '/dashboard';
    } else {
      updateUIForSession();
    }
  });

  window.addEventListener('session_changed', () => {
    updateUIForSession();
  });

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    logout();
    window.location.hash = '/login';
  });

  // Initial Auth Check
  if (!getSession()) {
    window.location.hash = '/login';
  } else {
    updateUIForSession();
  }

  window.addEventListener('nfse_ambiente_loaded', (e) => {
    const amb = e.detail?.ambiente;
    if (amb) updateEnvBadge(amb);
  });

  onConfigSaved(() => refreshAmbienteFromBackend());

  // Atualizar quando a aba volta ao foco (ex.: usuário salvou no município e voltou)
  let _visibilityDebounce = null;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    clearTimeout(_visibilityDebounce);
    _visibilityDebounce = setTimeout(() => refreshAmbienteFromBackend(), 300);
  });
});
