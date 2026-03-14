/**
 * NFS-e Freire — Módulo Prefeitura (SPA)
 */
import { Router } from './router.js';
import { renderDashboardMunicipio } from './pages/dashboard-municipio.js';
import { renderLoginMunicipio } from './pages/login-municipio.js';
import { renderGestaoAcessosMun } from './pages/gestao-acessos-municipio.js';
import { renderConsultaNotasMun } from './pages/consulta-notas-municipio.js';
import { renderConfiguracoesMunicipio } from './pages/configuracoes-municipio.js';
import { renderRegimeTributario } from './pages/regime-tributario-municipio.js';
import { renderDecisoesJudiciais } from './pages/decisoes-judiciais-municipio.js';
import { getMunSession, logoutMun, MUN_ROLES } from './auth-municipio.js';

document.addEventListener('DOMContentLoaded', () => {
  const contentEl = document.getElementById('main-content');
  if (!contentEl) return;

  const session = getMunSession();
  const rawHash = (window.location.hash || '').trim();
  const path = rawHash.replace(/^#\/?/, '').trim() || 'dashboard';
  const normalizedPath = path.startsWith('/') ? path : '/' + path;

  // Sem sessão: sempre redirecionar para /login
  if (!session) {
    if (normalizedPath !== '/login') {
      window.location.hash = '/login';
    }
  }

  // ─── Router Setup ────────────────────────────
  const router = new Router(contentEl);
  router
    .register('/login', renderLoginMunicipio)
    .register('/dashboard', renderDashboardMunicipio)
    .register('/consulta-notas', renderConsultaNotasMun)
    .register('/gestao-acessos', renderGestaoAcessosMun)
    .register('/regime-tributario', renderRegimeTributario)
    .register('/decisoes-judiciais', renderDecisoesJudiciais)
    .register('/configuracoes', renderConfiguracoesMunicipio);

  router.start();

  // Garantir que login seja exibido se não há sessão (fallback)
  if (!session && !contentEl.querySelector('#login-mun-cpf')) {
    window.location.hash = '/login';
    router.resolve();
  }

  // ─── Sidebar Navigation ────────────────────────────
  document.querySelectorAll('.nav-item[data-route]').forEach(item => {
    item.addEventListener('click', () => {
      router.navigate(item.dataset.route);
      document.querySelector('.sidebar')?.classList.remove('mobile-open');
    });
  });

  // ─── Controle de Sessão ─────────────────────
  function updateUIForSession() {
    const session = getMunSession();
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

      const isGestor = session.role === MUN_ROLES.GESTOR;
      const gestorDisplay = isGestor ? 'flex' : 'none';
      document.getElementById('nav-gestao-acessos')?.style.setProperty('display', gestorDisplay);
      document.getElementById('nav-regime-tributario')?.style.setProperty('display', gestorDisplay);
      document.getElementById('nav-decisoes-judiciais')?.style.setProperty('display', gestorDisplay);
    } else {
      if (shell) shell.style.display = 'block';
      sidebar?.classList.add('hidden');
      header?.classList.add('hidden');
    }
  }

  window.addEventListener('hashchange', () => {
    const currentHash = window.location.hash || '#/dashboard';
    const session = getMunSession();
    if (!session && currentHash !== '#/login') {
      window.location.hash = '/login';
    } else if (session && currentHash === '#/login') {
      window.location.hash = '/dashboard';
    } else {
      updateUIForSession();
    }
  });

  window.addEventListener('mun_session_changed', () => updateUIForSession());

  // ─── Sidebar Toggle ────────────────────────────
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

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    logoutMun();
    window.location.hash = '/login';
  });

  // Initial Check — garantir UI correta ao carregar
  updateUIForSession();
  if (!getMunSession()) {
    window.location.hash = '/login';
  }
});
