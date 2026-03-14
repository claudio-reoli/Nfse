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
import { renderIaDashboard   } from './pages/ia-dashboard.js';
import { renderIaRisco       } from './pages/ia-risco.js';
import { renderIaMalha       } from './pages/ia-malha.js';
import { renderIaReforma     } from './pages/ia-reforma.js';
import { renderIaConfig      } from './pages/ia-config.js';
import { renderPgdasMonitor  } from './pages/pgdas-monitor.js';
import { renderPgdasApuracao } from './pages/pgdas-apuracao.js';
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
    .register('/login',              renderLoginMunicipio)
    .register('/dashboard',          renderDashboardMunicipio)
    .register('/consulta-notas',     renderConsultaNotasMun)
    .register('/gestao-acessos',     renderGestaoAcessosMun)
    .register('/regime-tributario',  renderRegimeTributario)
    .register('/decisoes-judiciais', renderDecisoesJudiciais)
    .register('/configuracoes',      renderConfiguracoesMunicipio)
    // ── PGDAS-D ──
    .register('/pgdas-monitor',  renderPgdasMonitor)
    .register('/pgdas-apuracao', renderPgdasApuracao)
    // ── Inteligência Fiscal (IA) ──
    .register('/ia-dashboard', renderIaDashboard)
    .register('/ia-risco',     renderIaRisco)
    .register('/ia-malha',     renderIaMalha)
    .register('/ia-reforma',   renderIaReforma)
    .register('/ia-config',    renderIaConfig);

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
      const isFiscal = session.role === MUN_ROLES.FISCAL;
      const gestorDisplay = isGestor ? 'flex' : 'none';
      const pgdasDisplay  = (isGestor || isFiscal) ? 'flex' : 'none';
      document.getElementById('nav-gestao-acessos')?.style.setProperty('display', gestorDisplay);
      document.getElementById('nav-regime-tributario')?.style.setProperty('display', gestorDisplay);
      document.getElementById('nav-decisoes-judiciais')?.style.setProperty('display', gestorDisplay);
      document.getElementById('nav-pgdas-monitor')?.style.setProperty('display', pgdasDisplay);
      document.getElementById('nav-pgdas-apuracao')?.style.setProperty('display', pgdasDisplay);

      // Inteligência Fiscal — visível apenas para GESTOR
      const iaDisplay = isGestor ? '' : 'none';
      document.getElementById('label-inteligencia')?.style.setProperty('display', iaDisplay);
      ['nav-ia-dashboard','nav-ia-risco','nav-ia-malha','nav-ia-reforma','nav-ia-config'].forEach(id => {
        document.getElementById(id)?.style.setProperty('display', isGestor ? 'flex' : 'none');
      });
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
  } else {
    verificarAlertas();
  }
});

/** Verifica alertas de sublimite RBT12 e vencimento de certificado ao iniciar */
async function verificarAlertas() {
  const session = getMunSession();
  if (!session) return;
  try {
    const BASE = (await import('./api-service.js')).getBackendUrl();
    const token = localStorage.getItem('nfse_session');
    const h = token ? { Authorization: `Bearer ${JSON.parse(token).token}` } : {};

    // ── Alerta de certificado ───────────────────────────────
    const rCert = await fetch(`${BASE}/municipio/cert-status`, { headers: h }).catch(() => null);
    if (rCert?.ok) {
      const cert = await rCert.json();
      if (['vencido','critico','alerta','aviso'].includes(cert.status)) {
        mostrarBannerGlobal(`certAlerta`, cert.status === 'vencido' ? 'danger' : 'warning',
          `🔐 Certificado Digital: ${cert.mensagem}`);
      }
    }

    // ── Alerta de sublimite RBT12 ───────────────────────────
    const rSub = await fetch(`${BASE}/pgdas/sublimites`, { headers: h }).catch(() => null);
    if (rSub?.ok) {
      const sub = await rSub.json();
      const acimaDeSublimite = (sub.contribuintes || []).filter(c => c.alerta === 'sublimite');
      if (acimaDeSublimite.length > 0) {
        mostrarBannerGlobal(`sublimiteAlerta`, 'danger',
          `⚠️ ${acimaDeSublimite.length} contribuinte(s) acima do sublimite de R$ 3,6M — ISS deve ser recolhido via guia municipal (LC 214/2025)`);
      }
    }

    // ── Alerta de prazo PGDAS-D ─────────────────────────────
    const dia = new Date().getDate();
    if (dia >= 17 && dia <= 20) {
      const msgs = { 17: 'Prazo PGDAS-D em 3 dias — revise as receitas', 18: 'Prazo PGDAS-D em 2 dias', 19: '🚨 Último dia útil para envio do PGDAS-D', 20: '🔴 Prazo PGDAS-D encerra à meia-noite!' };
      mostrarBannerGlobal('pgdasPrazo', dia >= 19 ? 'danger' : 'warning', `📅 ${msgs[dia] || ''}`);
    } else if (dia >= 21) {
      mostrarBannerGlobal('pgdasVencido', 'danger', '💸 PGDAS-D vencido — multa automática aplicada (LC 214/2025). Acesse Monitor PGDAS-D.');
    }
  } catch { /* silencioso */ }
}

function mostrarBannerGlobal(id, nivel, texto) {
  if (document.getElementById(`banner-${id}`)) return;
  const cor = nivel === 'danger' ? 'rgba(239,68,68,0.85)' : 'rgba(245,158,11,0.85)';
  const bg  = nivel === 'danger' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)';
  const banner = document.createElement('div');
  banner.id = `banner-${id}`;
  banner.style.cssText = `position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:900;
    background:${bg};border:1px solid ${cor};border-radius:8px;padding:10px 20px;
    max-width:90vw;font-size:0.82rem;color:${cor};display:flex;align-items:center;gap:12px;
    box-shadow:0 4px 20px rgba(0,0,0,0.4);`;
  banner.innerHTML = `<span style="flex:1;">${texto}</span>
    <button onclick="this.parentNode.remove()" style="background:none;border:none;color:${cor};cursor:pointer;font-size:1rem;padding:0 4px;">✕</button>`;
  document.body.appendChild(banner);
  setTimeout(() => banner?.remove(), 12000);
}
