/**
 * NFS-e Freire — IA Fiscal: Dashboard Estratégico
 * Previsão de Receita (30 / 60 / 90 dias) + KPIs de Saúde Fiscal
 */
import { getBackendUrl } from '../api-service.js';

function getMunToken() {
  try { const s = localStorage.getItem('nfse_session'); return s ? (JSON.parse(s).token || '') : ''; } catch { return ''; }
}

const COLORS = {
  primary:  'rgba(99,102,241,1)',
  primaryBg:'rgba(99,102,241,0.15)',
  success:  'rgba(34,197,94,1)',
  successBg:'rgba(34,197,94,0.15)',
  warning:  'rgba(245,158,11,1)',
  warningBg:'rgba(245,158,11,0.15)',
  danger:   'rgba(239,68,68,1)',
  dangerBg: 'rgba(239,68,68,0.12)',
  neutral:  'rgba(148,163,184,0.6)',
};

function authH() {
  const t = getMunToken();
  return t ? { 'Authorization': `Bearer ${t}` } : {};
}

function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
}

function fmtPct(v) {
  return `${v >= 0 ? '+' : ''}${Number(v).toFixed(1)}%`;
}

function fmtMes(m) {
  if (!m) return '—';
  const [y, mo] = m.split('-');
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${nomes[parseInt(mo,10)-1]}/${y.slice(2)}`;
}

export function renderIaDashboard(container) {
  const BASE = getBackendUrl();

  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">🧠 Dashboard Estratégico — Inteligência Fiscal</h1>
        <p class="page-description">Previsão de arrecadação com IA · Hiato Tributário · Indicadores de conformidade</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <select id="ia-horizonte" class="form-input" style="width:160px;font-size:0.82rem;">
          <option value="3" selected>Horizonte: 90 dias</option>
          <option value="2">Horizonte: 60 dias</option>
          <option value="1">Horizonte: 30 dias</option>
        </select>
        <button id="ia-dash-refresh" class="btn btn-secondary">🔄 Atualizar</button>
      </div>
    </div>

    <!-- Banner de aviso quando em modo demo -->
    <div id="ia-demo-banner" class="hidden" style="margin-bottom:16px;padding:10px 16px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);border-radius:var(--radius-md);font-size:0.82rem;color:var(--color-warning-400);">
      ⚠️ <strong>Modo Demonstração</strong> — Dados simulados. Importe NFS-e reais para ativar os modelos preditivos.
    </div>

    <!-- KPI Cards -->
    <div id="ia-kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:20px;">
      ${[1,2,3,4,5,6].map(i=>`<div class="card animate-slide-up" style="padding:16px;"><div style="height:60px;background:var(--surface-glass);border-radius:var(--radius-md);animation:pulse 1.5s infinite;"></div></div>`).join('')}
    </div>

    <!-- Gráfico de Previsão -->
    <div class="card animate-slide-up" style="margin-bottom:20px;">
      <div class="card-header">
        <h3 class="card-title">📈 Arrecadação Real vs. Prevista (ISS)</h3>
        <span id="ia-modelo-badge" style="font-size:0.72rem;color:var(--color-neutral-500);"></span>
      </div>
      <div class="card-body" style="position:relative;height:320px;">
        <canvas id="chart-previsao"></canvas>
        <div id="chart-loading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--color-neutral-500);">
          <span>⏳ Carregando modelo preditivo...</span>
        </div>
      </div>
    </div>

    <!-- Linha do tempo da previsão -->
    <div id="ia-cards-previsao" style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px;"></div>

    <!-- Seção PGDAS-D Conformidade -->
    <div class="card animate-slide-up" style="padding:20px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <h3 class="card-title" style="margin-bottom:0;">📋 Conformidade PGDAS-D vs. ADN (últimos 90 dias)</h3>
        <span id="ia-pgdas-demo-badge" class="hidden" style="font-size:0.7rem;padding:2px 8px;border-radius:20px;background:rgba(245,158,11,0.15);color:rgba(245,158,11,0.9);">Demo</span>
      </div>
      <div id="ia-pgdas-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">
        ${[1,2,3,4,5,6].map(() => `<div style="height:70px;background:var(--surface-glass);border-radius:var(--radius-md);animation:pulse 1.5s infinite;"></div>`).join('')}
      </div>
      <div id="ia-pgdas-gap-bar" style="margin-top:16px;display:none;">
        <div style="font-size:0.75rem;color:var(--color-neutral-400);margin-bottom:6px;">Gap receita ADN vs. PGDAS declarado</div>
        <div style="background:var(--surface-glass);border-radius:4px;height:8px;overflow:hidden;">
          <div id="ia-pgdas-gap-fill" style="height:100%;background:rgba(239,68,68,0.7);width:0%;transition:width 1s ease;border-radius:4px;"></div>
        </div>
      </div>
    </div>

    <!-- Rodapé técnico -->
    <div style="font-size:0.72rem;color:var(--color-neutral-600);text-align:center;padding-top:8px;">
      Modelo: Regressão Linear + Sazonalidade (sin/cos) · PGDAS via importação diária SERPRO · R² indicado no rótulo
    </div>
  `;

  let chartPrevisao = null;

  async function carregar() {
    const horizonte = document.getElementById('ia-horizonte')?.value || 3;
    try {
      const [rPrev, rKpis, rPgdas] = await Promise.all([
        fetch(`${BASE}/ia/previsao-receita?horizonte=${horizonte}`, { headers: authH() }),
        fetch(`${BASE}/ia/kpis`, { headers: authH() }),
        fetch(`${BASE}/ia/pgdas-conformidade`, { headers: authH() }),
      ]);

      if (!rPrev.ok || !rKpis.ok) { renderErro(); return; }

      const prev  = await rPrev.json();
      const kpis  = await rKpis.json();
      const pgdas = rPgdas.ok ? await rPgdas.json() : null;

      renderKpis(kpis, prev);
      renderGrafico(prev);
      renderCardsPrevisao(prev);
      if (pgdas) renderPgdasConformidade(pgdas);

      if (prev.fonte === 'demo') {
        document.getElementById('ia-demo-banner')?.classList.remove('hidden');
      }
    } catch {
      renderErro();
    }
  }

  function renderKpis(kpis, prev) {
    const sf  = kpis.saude_fiscal   || {};
    const cf  = kpis.conformidade   || {};
    const din = kpis.dinamica       || {};

    const hiato   = sf.hiato_pct || 0;
    const hiatoClr = Math.abs(hiato) > 10 ? COLORS.danger : (Math.abs(hiato) > 5 ? COLORS.warning : COLORS.success);

    const cards = [
      { icon:'💰', label:'ISS Real (último mês)', value: fmtBRL(sf.iss_real_ultimo_mes), sub:'arrecadado', clr: COLORS.success },
      { icon:'🔮', label:'ISS Previsto (próx. mês)', value: fmtBRL(sf.iss_previsto_proximo_mes), sub:'por IA', clr: COLORS.primary },
      { icon:'📊', label:'Hiato Tributário', value: fmtBRL(sf.hiato_tributario), sub: fmtPct(hiato), clr: hiatoClr, alerta: sf.alerta_hiato },
      { icon:'🧾', label:'Notas (último mês)', value: (cf.total_notas_ultimo_mes||0).toLocaleString('pt-BR'), sub:'emitidas', clr: COLORS.primary },
      { icon:'🏢', label:'Emissores Ativos', value: (cf.total_emissores||0).toLocaleString('pt-BR'), sub:`+${cf.novos_emissores_3m||0} novos (90d)`, clr: COLORS.success },
      { icon:'🎫', label:'Ticket Médio Serviço', value: fmtBRL(din.ticket_medio), sub:'por NFS-e', clr: COLORS.neutral.replace('0.6','1') },
    ];

    const grid = document.getElementById('ia-kpi-grid');
    if (!grid) return;
    grid.innerHTML = cards.map(c => `
      <div class="card" style="padding:16px;border-left:3px solid ${c.clr};">
        ${c.alerta ? `<div style="font-size:0.7rem;color:var(--color-warning-400);margin-bottom:4px;">⚠️ ALERTA</div>` : ''}
        <div style="font-size:1.3rem;margin-bottom:4px;">${c.icon}</div>
        <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--color-neutral-500);margin-bottom:2px;">${c.label}</div>
        <div style="font-size:1.15rem;font-weight:800;color:${c.clr};">${c.value}</div>
        <div style="font-size:0.75rem;color:var(--color-neutral-400);margin-top:2px;">${c.sub}</div>
      </div>
    `).join('');
  }

  function renderGrafico(prev) {
    const loading = document.getElementById('chart-loading');
    if (loading) loading.style.display = 'none';

    const hist = prev.historico || {};
    const pred = prev.previsao  || {};
    const r2   = prev.resumo?.r2_score ?? 0;

    const badge = document.getElementById('ia-modelo-badge');
    if (badge) badge.textContent = `R² = ${r2.toFixed(3)} · ${prev.resumo?.modelo || ''}`;

    // Labels: histórico + previsão
    const labels = [
      ...(hist.meses || []).map(fmtMes),
      ...(pred.meses || []).map(m => `📍 ${fmtMes(m)}`),
    ];

    // Dados: histórico normal, previsão separada
    const histLen = (hist.meses || []).length;
    const predLen = (pred.meses || []).length;

    const dHistorico = [
      ...(hist.valores || []),
      ...Array(predLen).fill(null),
    ];
    const dPrevisao = [
      ...Array(histLen - 1).fill(null),
      (hist.valores || []).at(-1) ?? null,   // conecta na última leitura real
      ...(pred.valores || []),
    ];

    const ctx = document.getElementById('chart-previsao');
    if (!ctx) return;

    if (chartPrevisao) { chartPrevisao.destroy(); chartPrevisao = null; }

    chartPrevisao = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label:           'Arrecadação Real (ISS)',
            data:            dHistorico,
            borderColor:     COLORS.primary,
            backgroundColor: COLORS.primaryBg,
            fill:            true,
            tension:         0.4,
            pointRadius:     4,
            pointHoverRadius:7,
            spanGaps:        false,
          },
          {
            label:           'Previsão IA',
            data:            dPrevisao,
            borderColor:     COLORS.warning,
            backgroundColor: COLORS.warningBg,
            borderDash:      [6, 4],
            fill:            true,
            tension:         0.4,
            pointRadius:     5,
            pointStyle:      'rectRot',
            pointHoverRadius:8,
            spanGaps:        false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend:  { labels: { color: '#e2e8f0', font: { size: 12 } } },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${fmtBRL(ctx.raw)}`,
            },
          },
        },
        scales: {
          x: { ticks: { color: '#94a3b8', maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: {
            ticks: {
              color: '#94a3b8',
              callback: v => fmtBRL(v).replace('R$\u00a0','R$ ').replace(/,\d{2}$/, ''),
            },
            grid: { color: 'rgba(255,255,255,0.05)' },
          },
        },
      },
    });
  }

  function renderCardsPrevisao(prev) {
    const pred = prev.previsao || {};
    const meses = pred.meses  || [];
    const vals  = pred.valores || [];
    const grid  = document.getElementById('ia-cards-previsao');
    if (!grid) return;

    const labels = ['30 dias', '60 dias', '90 dias'];
    grid.innerHTML = meses.map((m, i) => `
      <div class="card" style="padding:16px;text-align:center;border-top:3px solid ${COLORS.warning};">
        <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:.1em;color:var(--color-neutral-500);margin-bottom:4px;">Previsão +${labels[i]||''}</div>
        <div style="font-size:0.88rem;color:var(--color-neutral-400);">${fmtMes(m)}</div>
        <div style="font-size:1.4rem;font-weight:800;color:${COLORS.warning};margin-top:6px;">${fmtBRL(vals[i])}</div>
        <div style="font-size:0.72rem;color:var(--color-neutral-500);margin-top:4px;">ISS estimado</div>
      </div>
    `).join('');
  }

  function renderPgdasConformidade(p) {
    const grid = document.getElementById('ia-pgdas-grid');
    if (!grid) return;
    if (p.fonte === 'demo') document.getElementById('ia-pgdas-demo-badge')?.classList.remove('hidden');

    const confClr = p.conformidade_pct >= 80 ? COLORS.success : p.conformidade_pct >= 60 ? COLORS.warning : COLORS.danger;
    const gapClr  = p.gap_receita > 0 ? COLORS.danger : COLORS.success;

    const cards = [
      { icon: '✅', label: 'Conformidade',      value: `${p.conformidade_pct}%`,                     sub: `${p.ok} de ${p.total} contrib.`,     clr: confClr },
      { icon: '⚠️', label: 'Divergentes',        value: p.divergentes,                                sub: `${p.divergencia_pct}% do total`,      clr: COLORS.warning },
      { icon: '🔒', label: 'Retidos em Malha',   value: p.retidos_malha,                              sub: 'declarações bloqueadas',              clr: COLORS.danger },
      { icon: '🏛️', label: 'Impedidos ISS/DAS',  value: p.impedidos_iss,                              sub: 'recolhem via guia municipal',         clr: COLORS.warning },
      { icon: '📊', label: 'Gap Receita',        value: fmtBRL(p.gap_receita),                        sub: 'ADN − PGDAS declarado',               clr: gapClr },
      { icon: '⚡', label: 'Risco Sublimite',    value: p.sublimite_risco,                            sub: 'próximos de R$ 3,6M RBT12',           clr: COLORS.danger },
    ];

    grid.innerHTML = cards.map(c => `
      <div style="padding:12px;background:var(--surface-glass);border-radius:var(--radius-md);border-left:3px solid ${c.clr};">
        <div style="font-size:1.1rem;margin-bottom:2px;">${c.icon}</div>
        <div style="font-size:0.65rem;text-transform:uppercase;color:var(--color-neutral-500);">${c.label}</div>
        <div style="font-size:1.05rem;font-weight:800;color:${c.clr};">${typeof c.value === 'number' ? c.value.toLocaleString('pt-BR') : c.value}</div>
        <div style="font-size:0.68rem;color:var(--color-neutral-400);">${c.sub}</div>
      </div>
    `).join('');

    // Barra de gap
    const barEl = document.getElementById('ia-pgdas-gap-bar');
    const fill  = document.getElementById('ia-pgdas-gap-fill');
    if (barEl && fill && p.rb_adn_total > 0) {
      const pct = Math.min(100, Math.abs(p.gap_receita) / p.rb_adn_total * 100);
      barEl.style.display = 'block';
      setTimeout(() => { fill.style.width = `${pct.toFixed(1)}%`; }, 100);
    }
  }

  function renderErro() {
    container.querySelectorAll('.card').forEach(c => {
      c.innerHTML = `<div style="padding:20px;text-align:center;color:var(--color-danger-400);">
        ❌ Serviço de IA indisponível.<br><small>Verifique se o microserviço Python está em execução (src/ia/start.bat).</small>
      </div>`;
    });
  }

  document.getElementById('ia-dash-refresh')?.addEventListener('click', carregar);
  document.getElementById('ia-horizonte')?.addEventListener('change', carregar);

  carregar();
}
