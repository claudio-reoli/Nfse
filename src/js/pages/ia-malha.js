/**
 * NFS-e Freire — IA Fiscal: Malha Fiscal Digital
 * Detecção de Anomalias / Fuga de Receita — Isolation Forest
 */
import { getBackendUrl } from '../api-service.js';

function getMunToken() {
  try { const s = localStorage.getItem('nfse_session'); return s ? (JSON.parse(s).token || '') : ''; } catch { return ''; }
}

function authH() {
  const t = getMunToken();
  return t ? { 'Authorization': `Bearer ${t}` } : {};
}

function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
}

function fmtCNPJ(c) {
  if (!c) return '—';
  const d = c.replace(/\D/g,'');
  return d.length===14
    ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    : c;
}

export function renderIaMalha(container) {
  const BASE = getBackendUrl();

  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">🔍 Malha Fiscal Digital — Detecção de Anomalias</h1>
        <p class="page-description">Isolation Forest identifica contribuintes com comportamento atípico de faturamento</p>
      </div>
      <button id="ia-malha-refresh" class="btn btn-secondary">🔄 Atualizar</button>
    </div>

    <div id="ia-malha-demo-banner" class="hidden" style="margin-bottom:16px;padding:10px 16px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);border-radius:var(--radius-md);font-size:0.82rem;color:var(--color-warning-400);">
      ⚠️ <strong>Modo Demonstração</strong> — Dados simulados. O modelo requer ao menos 10 contribuintes com histórico de NFS-e.
    </div>

    <!-- KPI Cards -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px;">
      <div class="card" style="padding:16px;border-left:3px solid rgba(239,68,68,0.8);">
        <div style="font-size:0.7rem;text-transform:uppercase;color:var(--color-neutral-500);">Anomalias Detectadas</div>
        <div id="kpi-anomalias" style="font-size:2.2rem;font-weight:800;color:rgba(239,68,68,0.9);">—</div>
      </div>
      <div class="card" style="padding:16px;border-left:3px solid rgba(99,102,241,0.8);">
        <div style="font-size:0.7rem;text-transform:uppercase;color:var(--color-neutral-500);">Total Analisado</div>
        <div id="kpi-analisados" style="font-size:2.2rem;font-weight:800;color:rgba(99,102,241,0.9);">—</div>
      </div>
      <div class="card" style="padding:16px;border-left:3px solid rgba(245,158,11,0.8);">
        <div style="font-size:0.7rem;text-transform:uppercase;color:var(--color-neutral-500);">Taxa de Anomalia</div>
        <div id="kpi-pct-anomalia" style="font-size:2.2rem;font-weight:800;color:rgba(245,158,11,0.9);">—</div>
      </div>
    </div>

    <!-- Gráfico + Alertas -->
    <div style="display:grid;grid-template-columns:1fr 320px;gap:16px;margin-bottom:20px;align-items:start;">
      <!-- Heatmap de score por empresa (barras horizontais) -->
      <div class="card" style="padding:16px;">
        <div class="card-header" style="padding-bottom:10px;">
          <h3 class="card-title" style="font-size:0.85rem;">Score de Anomalia por Contribuinte (Top 20)</h3>
        </div>
        <div style="position:relative;height:360px;">
          <canvas id="chart-anomalias"></canvas>
        </div>
      </div>

      <!-- Alertas críticos -->
      <div class="card" style="padding:16px;">
        <h3 class="card-title" style="font-size:0.85rem;margin-bottom:12px;">🚨 Alertas Críticos</h3>
        <div id="lista-alertas-malha" style="display:flex;flex-direction:column;gap:8px;max-height:360px;overflow-y:auto;">
          <div style="text-align:center;color:var(--color-neutral-500);font-size:0.82rem;padding:20px;">⏳ Carregando...</div>
        </div>
      </div>
    </div>

    <!-- PGDAS-D: Subdeclaração de Receita -->
    <div class="card animate-slide-up" style="margin-bottom:20px;padding:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div>
          <h3 class="card-title" style="margin-bottom:2px;">📋 Malha PGDAS-D — Subdeclaração de Receita</h3>
          <p style="font-size:0.78rem;color:var(--color-neutral-400);margin:0;">Contribuintes onde receita ADN &gt; receita declarada no PGDAS-D (gap &gt; 10%)</p>
        </div>
        <span id="ia-malha-pgdas-demo" class="hidden" style="font-size:0.7rem;padding:2px 8px;border-radius:20px;background:rgba(245,158,11,0.15);color:rgba(245,158,11,0.9);">Demo</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px;">
        <div class="card" style="padding:14px;border-left:3px solid rgba(239,68,68,0.8);">
          <div style="font-size:0.65rem;text-transform:uppercase;color:var(--color-neutral-500);">Total em Alerta</div>
          <div id="kpi-pgdas-total" style="font-size:1.8rem;font-weight:800;color:rgba(239,68,68,0.9);">—</div>
        </div>
        <div class="card" style="padding:14px;border-left:3px solid rgba(239,68,68,0.7);">
          <div style="font-size:0.65rem;text-transform:uppercase;color:var(--color-neutral-500);">Gap Total de Receita</div>
          <div id="kpi-pgdas-gap" style="font-size:1rem;font-weight:800;color:rgba(239,68,68,0.8);">—</div>
        </div>
        <div class="card" style="padding:14px;border-left:3px solid rgba(245,158,11,0.8);">
          <div style="font-size:0.65rem;text-transform:uppercase;color:var(--color-neutral-500);">Retidos em Malha</div>
          <div id="kpi-pgdas-malha" style="font-size:1.8rem;font-weight:800;color:rgba(245,158,11,0.9);">—</div>
        </div>
        <div class="card" style="padding:14px;border-left:3px solid rgba(99,102,241,0.8);">
          <div style="font-size:0.65rem;text-transform:uppercase;color:var(--color-neutral-500);">Impedidos ISS/DAS</div>
          <div id="kpi-pgdas-impedidos" style="font-size:1.8rem;font-weight:800;color:rgba(99,102,241,0.9);">—</div>
        </div>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>CNPJ</th><th>Competência</th><th>Situações</th>
              <th>Rec. ADN</th><th>Rec. PGDAS</th><th>Gap R$</th><th>Gap %</th><th>RBT12</th>
            </tr>
          </thead>
          <tbody id="tbody-pgdas-malha">
            <tr><td colspan="8" style="text-align:center;padding:20px;color:var(--color-neutral-500);">⏳ Carregando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tabela completa (Isolation Forest) -->
    <div class="card animate-slide-up">
      <div class="card-header" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <h3 class="card-title" style="flex:1;">📊 Todos os Contribuintes — Anomalias NFS-e (Isolation Forest)</h3>
        <input type="text" id="ia-malha-filtro" class="form-input" placeholder="Filtrar..." style="width:200px;font-size:0.82rem;">
        <label style="display:flex;align-items:center;gap:6px;font-size:0.82rem;cursor:pointer;">
          <input type="checkbox" id="ia-malha-so-anomalias"> Somente anomalias
        </label>
      </div>
      <div class="card-body">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>CNPJ</th>
                <th>Nome / Empresa</th>
                <th>Score Anomalia</th>
                <th>Status</th>
                <th>Média Mensal</th>
                <th>Desvio Padrão</th>
                <th>Total NFS-e</th>
                <th>ISS Total</th>
              </tr>
            </thead>
            <tbody id="tbody-malha">
              <tr><td colspan="9" style="text-align:center;padding:24px;">⏳ Carregando modelo...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  let allTodos = [];
  let chartAnomalias = null;

  async function carregar() {
    try {
      const [res, rPgdas] = await Promise.all([
        fetch(`${BASE}/ia/anomalias`,    { headers: authH() }),
        fetch(`${BASE}/ia/pgdas-malha`,  { headers: authH() }),
      ]);
      if (!res.ok) { renderErro(); return; }
      const data  = await res.json();
      const pgdas = rPgdas.ok ? await rPgdas.json() : null;
      if (pgdas) renderPgdasMalha(pgdas);

      allTodos = data.todos || [];
      const r  = data.resumo || {};

      document.getElementById('kpi-anomalias').textContent     = r.total_anomalias ?? '—';
      document.getElementById('kpi-analisados').textContent    = r.total_analisados ?? '—';
      document.getElementById('kpi-pct-anomalia').textContent  = r.pct_anomalias != null ? `${r.pct_anomalias}%` : '—';

      renderGrafico(allTodos.slice(0, 20));
      renderAlertas(data.anomalias || []);
      renderTabela(allTodos);

      if (data.fonte === 'demo') document.getElementById('ia-malha-demo-banner')?.classList.remove('hidden');
    } catch { renderErro(); }
  }

  function scoreColor(v) {
    if (v >= 70) return 'rgba(239,68,68,0.85)';
    if (v >= 45) return 'rgba(245,158,11,0.85)';
    return 'rgba(34,197,94,0.85)';
  }

  function renderGrafico(items) {
    const ctx = document.getElementById('chart-anomalias');
    if (!ctx) return;
    if (chartAnomalias) { chartAnomalias.destroy(); chartAnomalias = null; }

    const labels = items.map(i => fmtCNPJ(i.cnpj));
    const vals   = items.map(i => i.score_anomalia);
    const colors = vals.map(scoreColor);

    chartAnomalias = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Score de Anomalia',
          data: vals,
          backgroundColor: colors,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `Score: ${ctx.raw} ${ctx.raw>=70?'⚠️ ANOMALIA':''}`,
            },
          },
        },
        scales: {
          x: { min:0, max:100, ticks:{color:'#94a3b8'}, grid:{color:'rgba(255,255,255,0.05)'} },
          y: { ticks: { color:'#94a3b8', font:{size:9} } },
        },
      },
    });
  }

  function renderAlertas(anomalias) {
    const lista = document.getElementById('lista-alertas-malha');
    if (!lista) return;
    if (!anomalias.length) {
      lista.innerHTML = `<div style="text-align:center;color:var(--color-success-400);font-size:0.82rem;padding:20px;">✅ Nenhuma anomalia crítica detectada.</div>`;
      return;
    }
    lista.innerHTML = anomalias.map(a => `
      <div style="padding:10px 12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:var(--radius-md);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
          <span class="text-mono" style="font-size:0.78rem;font-weight:600;">${fmtCNPJ(a.cnpj)}</span>
          <span style="font-size:0.72rem;font-weight:700;color:rgba(239,68,68,0.9);">Score ${a.score_anomalia}</span>
        </div>
        <div style="font-size:0.75rem;color:var(--color-neutral-400);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${a.nome}">${a.nome}</div>
        <div style="font-size:0.72rem;color:var(--color-neutral-500);margin-top:3px;">Média: ${fmtBRL(a.media_mensal)} · ISS: ${fmtBRL(a.total_iss)}</div>
      </div>
    `).join('');
  }

  function renderTabela(items) {
    const tbody   = document.getElementById('tbody-malha');
    const filtro  = (document.getElementById('ia-malha-filtro')?.value || '').toLowerCase();
    const soAnm   = document.getElementById('ia-malha-so-anomalias')?.checked;

    let filtrado = items.filter(i =>
      (!filtro || fmtCNPJ(i.cnpj).toLowerCase().includes(filtro) || (i.nome||'').toLowerCase().includes(filtro))
      && (!soAnm || i.is_anomalia)
    );

    if (!filtrado.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--color-neutral-500);">Nenhum resultado.</td></tr>`;
      return;
    }

    const barScore = (v) => `<div style="display:flex;align-items:center;gap:6px;">
      <div style="flex:1;height:5px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${v}%;background:${scoreColor(v)};border-radius:3px;"></div>
      </div>
      <strong style="font-size:0.8rem;min-width:28px;">${v}</strong>
    </div>`;

    tbody.innerHTML = filtrado.map((i, idx) => `
      <tr style="${i.is_anomalia ? 'background:rgba(239,68,68,0.04);' : ''}">
        <td>${idx+1}</td>
        <td class="text-mono">${fmtCNPJ(i.cnpj)}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${i.nome}">${i.nome||'—'}</td>
        <td style="min-width:130px;">${barScore(i.score_anomalia)}</td>
        <td>${i.is_anomalia
          ? `<span class="badge badge-danger">⚠️ Anomalia</span>`
          : `<span class="badge badge-success">Normal</span>`}
        </td>
        <td style="text-align:right;">${fmtBRL(i.media_mensal)}</td>
        <td style="text-align:right;color:var(--color-neutral-400);">${fmtBRL(i.desvio)}</td>
        <td style="text-align:center;">${i.total_notas}</td>
        <td style="text-align:right;">${fmtBRL(i.total_iss)}</td>
      </tr>
    `).join('');
  }

  function renderPgdasMalha(pgdas) {
    const fmtBRL = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
    const fmtCNPJ = c => { const d=(c||'').replace(/\D/g,''); return d.length===14?d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5'):c; };

    if (pgdas.fonte === 'demo') document.getElementById('ia-malha-pgdas-demo')?.classList.remove('hidden');
    const setKpi = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setKpi('kpi-pgdas-total',    pgdas.total);
    setKpi('kpi-pgdas-gap',      fmtBRL(pgdas.gap_total));
    setKpi('kpi-pgdas-malha',    pgdas.retidos);
    setKpi('kpi-pgdas-impedidos',pgdas.impedidos);

    const tbody = document.getElementById('tbody-pgdas-malha');
    if (!tbody) return;
    const alertas = pgdas.alertas || [];
    if (!alertas.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:16px;color:var(--color-success-400);">✅ Nenhuma subdeclaração detectada.</td></tr>`;
      return;
    }
    tbody.innerHTML = alertas.map(a => {
      const nivelBg  = a.nivel === 'alto' ? 'rgba(239,68,68,0.06)' : a.nivel === 'medio' ? 'rgba(245,158,11,0.04)' : '';
      const gapColor = a.gap_receita > 0 ? 'rgba(239,68,68,0.8)' : 'var(--color-neutral-400)';
      const tags = (a.motivos || []).map(m =>
        `<span style="font-size:0.62rem;padding:1px 5px;border-radius:20px;background:rgba(239,68,68,0.12);color:rgba(239,68,68,0.8);margin-right:2px;">${m}</span>`
      ).join('');
      return `<tr style="background:${nivelBg};">
        <td style="font-family:monospace;font-size:0.8rem;">${fmtCNPJ(a.cnpj)}</td>
        <td>${a.competencia||'—'}</td>
        <td style="white-space:nowrap;">${tags||'—'}</td>
        <td style="text-align:right;">${fmtBRL(a.rb_adn)}</td>
        <td style="text-align:right;">${fmtBRL(a.rb_pgdas)}</td>
        <td style="text-align:right;color:${gapColor};font-weight:600;">${a.gap_receita!==0?fmtBRL(a.gap_receita):'—'}</td>
        <td style="text-align:right;color:${a.gap_pct>20?'rgba(239,68,68,0.8)':'var(--color-neutral-400)'};">
          ${a.gap_pct>0?`${a.gap_pct}%`:'—'}
        </td>
        <td style="text-align:right;">${fmtBRL(a.rbt12)}</td>
      </tr>`;
    }).join('');
  }

  function renderErro() {
    document.getElementById('tbody-malha').innerHTML = `
      <tr><td colspan="9" style="text-align:center;padding:24px;color:var(--color-danger-400);">
        ❌ Serviço de IA indisponível. Verifique se o microserviço Python está rodando.
      </td></tr>`;
  }

  document.getElementById('ia-malha-refresh')?.addEventListener('click', carregar);
  document.getElementById('ia-malha-filtro')?.addEventListener('input', () => renderTabela(allTodos));
  document.getElementById('ia-malha-so-anomalias')?.addEventListener('change', () => renderTabela(allTodos));

  carregar();
}
