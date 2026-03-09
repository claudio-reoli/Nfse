/**
 * NFS-e Antigravity — Dashboard Page
 */
export function renderDashboard(container) {
  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-description">Visão geral do ecossistema NFS-e — Ambiente de Dados Nacional</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="window.location.hash='/emissao-dps'">
          ＋ Nova DPS
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-4 stagger mb-6">
      <div class="stat-card animate-slide-up" style="--stat-color: var(--color-primary-500)">
        <div class="stat-value" id="stat-emitidas">0</div>
        <div class="stat-label">NFS-e Emitidas</div>
        <div class="stat-change positive">▲ 12% este mês</div>
      </div>
      <div class="stat-card animate-slide-up" style="--stat-color: var(--color-accent-500)">
        <div class="stat-value" id="stat-aprovadas">0</div>
        <div class="stat-label">Autorizadas</div>
        <div class="stat-change positive">▲ 8% este mês</div>
      </div>
      <div class="stat-card animate-slide-up" style="--stat-color: var(--color-warning-500)">
        <div class="stat-value" id="stat-pendentes">0</div>
        <div class="stat-label">Pendentes</div>
        <div class="stat-change negative">▼ 3% este mês</div>
      </div>
      <div class="stat-card animate-slide-up" style="--stat-color: var(--color-danger-500)">
        <div class="stat-value" id="stat-canceladas">0</div>
        <div class="stat-label">Canceladas</div>
        <div class="stat-change negative">▼ 1% este mês</div>
      </div>
    </div>

    <!-- Main Panels -->
    <div style="display: grid; grid-template-columns: 1fr 280px; gap: var(--space-6);">
      <div class="card animate-slide-up" style="min-width: 0; overflow: hidden;">
        <div class="card-header">
          <h3 class="card-title">NFS-e Recentes</h3>
          <button class="btn btn-ghost btn-sm" onclick="window.location.hash='/consulta-nfse'">Ver todas →</button>
        </div>
        <div class="card-body" style="padding: 0; overflow-x: auto;">
          <table class="data-table" id="recent-nfse-table" style="min-width: 500px;">
            <thead>
              <tr>
                <th>Chave de Acesso</th>
                <th>Prestador</th>
                <th>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="recent-nfse-body">
            </tbody>
          </table>
        </div>
      </div>

      <!-- Quick Actions Panel -->
      <div class="card animate-slide-up">
        <div class="card-header">
          <h3 class="card-title">Ações Rápidas</h3>
        </div>
        <div class="card-body" style="display: flex; flex-direction: column; gap: var(--space-3);">
          <button class="btn btn-secondary w-full" onclick="window.location.hash='/emissao-dps'" id="quick-new-dps">
            📝 Emitir DPS
          </button>
          <button class="btn btn-secondary w-full" onclick="window.location.hash='/consulta-nfse'" id="quick-consulta">
            🔍 Consultar NFS-e
          </button>
          <button class="btn btn-secondary w-full" onclick="window.location.hash='/eventos'" id="quick-eventos">
            📋 Registrar Evento
          </button>
          <button class="btn btn-secondary w-full" onclick="window.location.hash='/decisao-judicial'" id="quick-bypass">
            ⚖️ Decisão Judicial
          </button>

          <div style="border-top: 1px solid var(--surface-glass-border); padding-top: var(--space-4); margin-top: var(--space-2);">
            <div class="section-title" style="font-size: var(--text-sm); margin-bottom: var(--space-3); padding-bottom: var(--space-2);">
              <span>Status do Sistema</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: var(--space-2);">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span class="text-muted" style="font-size: var(--text-xs);">Sefin Nacional</span>
                <div style="display: flex; align-items: center; gap: var(--space-2);">
                  <span class="status-dot online"></span>
                  <span style="font-size: var(--text-xs); color: var(--color-accent-400);">Online</span>
                </div>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span class="text-muted" style="font-size: var(--text-xs);">ADN</span>
                <div style="display: flex; align-items: center; gap: var(--space-2);">
                  <span class="status-dot online"></span>
                  <span style="font-size: var(--text-xs); color: var(--color-accent-400);">Online</span>
                </div>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span class="text-muted" style="font-size: var(--text-xs);">Certificado Digital</span>
                <div style="display: flex; align-items: center; gap: var(--space-2);">
                  <span class="status-dot warning"></span>
                  <span style="font-size: var(--text-xs); color: var(--color-warning-400);">Não Configurado</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- IBS/CBS Info Panel -->
    <div class="card animate-slide-up mt-6">
      <div class="card-header">
        <h3 class="card-title">⚡ Reforma Tributária — IBS/CBS</h3>
        <span class="badge badge-warning">Transição 2026</span>
      </div>
      <div class="card-body">
        <div class="grid grid-3 gap-4">
          <div style="padding: var(--space-4); background: var(--surface-glass); border-radius: var(--radius-lg); border: 1px solid var(--surface-glass-border);">
            <div style="font-size: var(--text-xs); color: var(--color-neutral-500); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-2);">IBS Estadual (UF)</div>
            <div style="font-size: var(--text-xl); font-weight: 700; color: var(--color-primary-400); font-variant-numeric: tabular-nums;">0,10%</div>
            <div style="font-size: var(--text-xs); color: var(--color-neutral-600); margin-top: var(--space-1);">Alíquota de teste 2026</div>
          </div>
          <div style="padding: var(--space-4); background: var(--surface-glass); border-radius: var(--radius-lg); border: 1px solid var(--surface-glass-border);">
            <div style="font-size: var(--text-xs); color: var(--color-neutral-500); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-2);">IBS Municipal (Mun)</div>
            <div style="font-size: var(--text-xl); font-weight: 700; color: var(--color-accent-400); font-variant-numeric: tabular-nums;">0,05%</div>
            <div style="font-size: var(--text-xs); color: var(--color-neutral-600); margin-top: var(--space-1);">Alíquota de teste 2026</div>
          </div>
          <div style="padding: var(--space-4); background: var(--surface-glass); border-radius: var(--radius-lg); border: 1px solid var(--surface-glass-border);">
            <div style="font-size: var(--text-xs); color: var(--color-neutral-500); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-2);">CBS (Federal)</div>
            <div style="font-size: var(--text-xl); font-weight: 700; color: var(--color-warning-400); font-variant-numeric: tabular-nums;">0,90%</div>
            <div style="font-size: var(--text-xs); color: var(--color-neutral-600); margin-top: var(--space-1);">Alíquota de teste 2026</div>
          </div>
        </div>
        <p style="font-size: var(--text-xs); color: var(--color-neutral-600); margin-top: var(--space-4);">
          ⓘ Em 2026, IBS e CBS operam com alíquotas de teste. vTotNF = vLiq. Grupo IBSCBS é <strong>opcional</strong> na DPS.
          A partir de 2027, IBS e CBS serão "por fora": vTotNF = vLiq + vCBS + vIBSTot.
        </p>
      </div>
    </div>
  `;

  // Animate stats
  animateCounter('stat-emitidas', 1247);
  animateCounter('stat-aprovadas', 1189);
  animateCounter('stat-pendentes', 42);
  animateCounter('stat-canceladas', 16);

  // Populate recent NFS-e with demo data
  populateRecentTable();
}

function animateCounter(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const duration = 1200;
  const start = performance.now();

  function update(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(target * eased).toLocaleString('pt-BR');
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function populateRecentTable() {
  const tbody = document.getElementById('recent-nfse-body');
  if (!tbody) return;

  const demoData = [
    { chave: '35260212345678000195550010000001231123456789', prest: 'Tech Solutions Ltda', serv: '1.05 - Licenciamento de TI', valor: 'R$ 15.800,00', status: 'Autorizada', data: '09/03/2026' },
    { chave: '35260298765432000188550010000004561987654321', prest: 'Consultoria Plus ME', serv: '17.01 - Assessoria', valor: 'R$ 8.500,00', status: 'Autorizada', data: '08/03/2026' },
    { chave: '35260211222333000144550010000007891456789012', prest: 'Design Studio EPP', serv: '10.04 - Agenciamento', valor: 'R$ 3.200,00', status: 'Pendente', data: '08/03/2026' },
    { chave: '35260255667788000199550010000010121678901234', prest: 'Engenharia SA', serv: '7.02 - Engenharia', valor: 'R$ 45.000,00', status: 'Autorizada', data: '07/03/2026' },
    { chave: '35260233445566000111550010000013451890123456', prest: 'Locações Rápidas', serv: '99.04.01 - Loc. Bens Móveis', valor: 'R$ 2.100,00', status: 'Cancelada', data: '07/03/2026' },
  ];

  const statusClass = {
    'Autorizada': 'badge-success',
    'Pendente': 'badge-warning',
    'Cancelada': 'badge-danger',
  };

  tbody.innerHTML = demoData.map(d => `
    <tr style="cursor: pointer;" onclick="window.location.hash='/consulta-nfse'">
      <td class="cell-mono" style="white-space: nowrap;">${d.chave.slice(0, 10)}...${d.chave.slice(-4)}</td>
      <td style="max-width: 150px;" class="truncate">${d.prest}</td>
      <td style="font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap;">${d.valor}</td>
      <td><span class="badge ${statusClass[d.status]}">${d.status}</span></td>
    </tr>
  `).join('');
}
