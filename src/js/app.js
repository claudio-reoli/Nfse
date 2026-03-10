/**
 * NFS-e Antigravity — Main Application
 * Entry point and router setup
 */
import { Router } from './router.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderEmissaoDPS } from './pages/emissao-dps.js';
import { renderConsultaNFSe } from './pages/consulta-nfse.js';
import { renderEventos } from './pages/eventos.js';
import { renderADN } from './pages/adn.js';
import { renderConfiguracoes, startCertExpiryWatch } from './pages/configuracoes.js';

document.addEventListener('DOMContentLoaded', () => {
  const contentEl = document.getElementById('main-content');
  if (!contentEl) return;

  // ─── Router Setup ────────────────────────────
  const router = new Router(contentEl);
  router
    .register('/dashboard', renderDashboard)
    .register('/emissao-dps', renderEmissaoDPS)
    .register('/consulta-nfse', renderConsultaNFSe)
    .register('/eventos', renderEventos)
    .register('/adn', renderADN)
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
    .register('/parametros', (c) => {
      c.innerHTML = `
        <div class="page-header animate-slide-up">
          <div>
            <h1 class="page-title">Parâmetros Municipais</h1>
            <p class="page-description">Consulta de alíquotas, regimes especiais e benefícios municipais via API</p>
          </div>
        </div>
        <div class="card animate-slide-up">
          <div class="card-body">
            <div class="form-row mb-4">
              <div class="form-group">
                <label class="form-label">Código do Município (IBGE)</label>
                <input class="form-input form-input-mono" id="param-codMun" type="text" maxlength="7" placeholder="3550308">
              </div>
              <div class="form-group">
                <label class="form-label">Código do Serviço</label>
                <input class="form-input form-input-mono" id="param-codServ" type="text" placeholder="1.05">
              </div>
              <div class="form-group" style="align-self: flex-end;">
                <button class="btn btn-primary" onclick="import('./toast.js').then(m => m.toast.info('GET /parametros_municipais/{codMun}/{codServico}'))">
                  🔍 Consultar Parâmetros
                </button>
              </div>
            </div>

            <div class="grid grid-3 gap-4 mt-6">
              <div style="padding: var(--space-4); background: var(--surface-glass); border-radius: var(--radius-lg); border: 1px solid var(--surface-glass-border);">
                <div style="font-size: var(--text-xs); text-transform: uppercase; color: var(--color-neutral-500); margin-bottom: var(--space-2);">Convênio</div>
                <div style="font-weight: 600; color: var(--color-accent-400);">Ativo</div>
                <div style="font-size: var(--text-xs); color: var(--color-neutral-600); margin-top: var(--space-1);">GET /parametros_municipais/{cod}/convenio</div>
              </div>
              <div style="padding: var(--space-4); background: var(--surface-glass); border-radius: var(--radius-lg); border: 1px solid var(--surface-glass-border);">
                <div style="font-size: var(--text-xs); text-transform: uppercase; color: var(--color-neutral-500); margin-bottom: var(--space-2);">Alíquota ISSQN</div>
                <div style="font-weight: 600; color: var(--color-primary-400);">5,00%</div>
                <div style="font-size: var(--text-xs); color: var(--color-neutral-600); margin-top: var(--space-1);">GET /parametros_municipais/{cod}/aliquotas</div>
              </div>
              <div style="padding: var(--space-4); background: var(--surface-glass); border-radius: var(--radius-lg); border: 1px solid var(--surface-glass-border);">
                <div style="font-size: var(--text-xs); text-transform: uppercase; color: var(--color-neutral-500); margin-bottom: var(--space-2);">Regimes Especiais</div>
                <div style="font-weight: 600; color: var(--color-warning-400);">2 ativos</div>
                <div style="font-size: var(--text-xs); color: var(--color-neutral-600); margin-top: var(--space-1);">GET /parametros_municipais/{cod}/regimes_especiais</div>
              </div>
            </div>
          </div>
        </div>
      `;
    })
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
});
