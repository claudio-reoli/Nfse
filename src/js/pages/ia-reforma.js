/**
 * NFS-e Freire — IA Fiscal: Relatórios de Impacto da Reforma Tributária
 * Acompanhamento IBS/CBS vs. Parcela Municipal (ISS)
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

function fmtMes(m) {
  if (!m) return '—';
  const [y, mo] = m.split('-');
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${nomes[parseInt(mo,10)-1]}/${y.slice(2)}`;
}

export function renderIaReforma(container) {
  const BASE = getBackendUrl();

  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">⚖️ Impacto da Reforma Tributária — IBS / CBS</h1>
        <p class="page-description">Evolução da proporção IBS + CBS vs. ISS Municipal · Nota Técnica 005</p>
      </div>
      <button id="ia-reforma-refresh" class="btn btn-secondary">🔄 Atualizar</button>
    </div>

    <div id="ia-reforma-demo-banner" class="hidden" style="margin-bottom:16px;padding:10px 16px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);border-radius:var(--radius-md);font-size:0.82rem;color:var(--color-warning-400);">
      ⚠️ <strong>Modo Demonstração</strong> — Dados simulados. Alimente com NFS-e reais com campos IBS/CBS preenchidos.
    </div>

    <!-- KPI Cards -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;">
      <div class="card" style="padding:16px;border-left:3px solid rgba(99,102,241,0.8);">
        <div style="font-size:0.7rem;text-transform:uppercase;color:var(--color-neutral-500);">ISS Municipal (12m)</div>
        <div id="kpi-iss" style="font-size:1.2rem;font-weight:800;color:rgba(99,102,241,0.9);">—</div>
      </div>
      <div class="card" style="padding:16px;border-left:3px solid rgba(34,197,94,0.8);">
        <div style="font-size:0.7rem;text-transform:uppercase;color:var(--color-neutral-500);">IBS Municipal (12m)</div>
        <div id="kpi-ibs" style="font-size:1.2rem;font-weight:800;color:rgba(34,197,94,0.9);">—</div>
      </div>
      <div class="card" style="padding:16px;border-left:3px solid rgba(245,158,11,0.8);">
        <div style="font-size:0.7rem;text-transform:uppercase;color:var(--color-neutral-500);">CBS (12m)</div>
        <div id="kpi-cbs" style="font-size:1.2rem;font-weight:800;color:rgba(245,158,11,0.9);">—</div>
      </div>
      <div class="card" style="padding:16px;border-left:3px solid rgba(148,163,184,0.6);">
        <div style="font-size:0.7rem;text-transform:uppercase;color:var(--color-neutral-500);">Proporção IBS+CBS</div>
        <div id="kpi-prop-new" style="font-size:1.2rem;font-weight:800;color:rgba(148,163,184,0.9);">—</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 280px;gap:16px;margin-bottom:20px;align-items:start;">
      <!-- Gráfico barras empilhadas ISS / IBS / CBS -->
      <div class="card" style="padding:16px;">
        <div class="card-header" style="padding-bottom:10px;">
          <h3 class="card-title" style="font-size:0.85rem;">Evolução Mensal: ISS Municipal vs. IBS vs. CBS</h3>
        </div>
        <div style="position:relative;height:300px;">
          <canvas id="chart-reforma-barras"></canvas>
        </div>
      </div>

      <!-- Donut proporção -->
      <div class="card" style="padding:16px;">
        <div class="card-header" style="padding-bottom:10px;">
          <h3 class="card-title" style="font-size:0.85rem;">Composição Tributária (12 meses)</h3>
        </div>
        <div style="position:relative;height:200px;">
          <canvas id="chart-reforma-donut"></canvas>
        </div>
        <div id="reforma-insight" style="margin-top:14px;font-size:0.79rem;color:var(--color-neutral-400);text-align:center;line-height:1.5;"></div>
      </div>
    </div>

    <!-- Risco de Mudança de Regime (Sublimite) -->
    <div class="card animate-slide-up" style="margin-bottom:20px;padding:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div>
          <h3 class="card-title" style="margin-bottom:2px;">⚠️ Contribuintes em Risco de Mudança de Regime (Sublimite)</h3>
          <p style="font-size:0.78rem;color:var(--color-neutral-400);margin:0;">RBT12 entre R$ 3,24M e R$ 3,6M — risco de perda do Simples Nacional / ISS via guia municipal</p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px;">
        <div class="card" style="padding:14px;border-left:3px solid rgba(239,68,68,0.8);">
          <div style="font-size:0.65rem;text-transform:uppercase;color:var(--color-neutral-500);">Próximos ao Sublimite</div>
          <div id="kpi-sublimite-total" style="font-size:2rem;font-weight:800;color:rgba(239,68,68,0.9);">—</div>
          <div style="font-size:0.72rem;color:var(--color-neutral-400);">RBT12 &gt; R$ 3,24M</div>
        </div>
        <div class="card" style="padding:14px;border-left:3px solid rgba(245,158,11,0.8);">
          <div style="font-size:0.65rem;text-transform:uppercase;color:var(--color-neutral-500);">Já Impedidos ISS/DAS</div>
          <div id="kpi-sublimite-impedidos" style="font-size:2rem;font-weight:800;color:rgba(245,158,11,0.9);">—</div>
          <div style="font-size:0.72rem;color:var(--color-neutral-400);">RBT12 &gt; R$ 3,6M</div>
        </div>
        <div class="card" style="padding:14px;border-left:3px solid rgba(99,102,241,0.8);">
          <div style="font-size:0.65rem;text-transform:uppercase;color:var(--color-neutral-500);">RBT12 Médio (PGDAS)</div>
          <div id="kpi-sublimite-rbt12med" style="font-size:1rem;font-weight:800;color:rgba(99,102,241,0.9);">—</div>
          <div style="font-size:0.72rem;color:var(--color-neutral-400);">últimos 90 dias</div>
        </div>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>CNPJ</th>
              <th>Competência</th>
              <th style="text-align:right;">RBT12 Oficial</th>
              <th style="text-align:right;">% do Limite</th>
              <th>Situação</th>
              <th>ISS Declarado</th>
            </tr>
          </thead>
          <tbody id="tbody-sublimite">
            <tr><td colspan="6" style="text-align:center;padding:20px;color:var(--color-neutral-500);">⏳ Carregando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tabela mensal -->
    <div class="card animate-slide-up">
      <div class="card-header">
        <h3 class="card-title">📅 Resumo Mensal ISS × IBS × CBS</h3>
      </div>
      <div class="card-body">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Competência</th>
                <th style="text-align:right;">ISS Municipal</th>
                <th style="text-align:right;">IBS Municipal</th>
                <th style="text-align:right;">CBS</th>
                <th style="text-align:right;">Total Serviços</th>
                <th style="text-align:center;">Notas</th>
                <th style="text-align:right;">% IBS+CBS</th>
              </tr>
            </thead>
            <tbody id="tbody-reforma">
              <tr><td colspan="7" style="text-align:center;padding:24px;">⏳ Carregando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  let chartBarras = null, chartDonut = null;

  async function carregar() {
    try {
      const [res, rPgdas] = await Promise.all([
        fetch(`${BASE}/ia/reforma`,              { headers: authH() }),
        fetch(`${BASE}/ia/pgdas-conformidade`,   { headers: authH() }),
      ]);
      if (!res.ok) { renderErro(); return; }
      const data  = await res.json();
      const pgdas = rPgdas.ok ? await rPgdas.json() : null;

      const r = data.resumo || {};
      document.getElementById('kpi-iss').textContent       = fmtBRL(r.total_iss);
      document.getElementById('kpi-ibs').textContent       = fmtBRL(r.total_ibs);
      document.getElementById('kpi-cbs').textContent       = fmtBRL(r.total_cbs);
      document.getElementById('kpi-prop-new').textContent  = `${r.proporcao_new_pct ?? 0}%`;

      renderBarras(data.historico);
      renderDonut(r);
      renderTabela(data.historico);
      renderInsight(r);
      if (pgdas) renderSublimite(pgdas);

      if (data.fonte === 'demo') document.getElementById('ia-reforma-demo-banner')?.classList.remove('hidden');
    } catch { renderErro(); }
  }

  function renderSublimite(pgdas) {
    const setKpi = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setKpi('kpi-sublimite-total',     pgdas.sublimite_risco ?? '—');
    setKpi('kpi-sublimite-impedidos', pgdas.impedidos_iss   ?? '—');
    setKpi('kpi-sublimite-rbt12med',  fmtBRL(pgdas.rbt12_medio_oficial));

    // Busca lista detalhada de sublimites via endpoint PGDAS
    fetch(`${BASE}/pgdas/sublimites`, { headers: authH() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const tbody = document.getElementById('tbody-sublimite');
        if (!tbody) return;
        const lista = d?.contribuintes || [];
        if (!lista.length) {
          tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:14px;color:var(--color-success-400);">✅ Nenhum contribuinte próximo ao sublimite.</td></tr>`;
          return;
        }
        tbody.innerHTML = lista.map(c => {
          const pct = c.rbt12 ? (c.rbt12 / 3_600_000 * 100).toFixed(1) : '—';
          const cor = c.rbt12 >= 3_600_000 ? 'rgba(239,68,68,0.8)' : c.rbt12 >= 3_240_000 ? 'rgba(245,158,11,0.8)' : 'var(--color-success-400)';
          const sit = c.rbt12 >= 3_600_000
            ? '<span style="font-size:0.7rem;padding:2px 7px;border-radius:20px;background:rgba(239,68,68,0.15);color:rgba(239,68,68,0.9);">🏛️ Acima Limite</span>'
            : '<span style="font-size:0.7rem;padding:2px 7px;border-radius:20px;background:rgba(245,158,11,0.12);color:rgba(245,158,11,0.9);">⚠️ Zona de Risco</span>';
          return `<tr>
            <td style="font-family:monospace;font-size:0.8rem;">${(c.cnpj||'').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5')}</td>
            <td>${c.competencia||c.ultimo_mes||'—'}</td>
            <td style="text-align:right;color:${cor};font-weight:700;">${fmtBRL(c.rbt12||c.rbt12_oficial||0)}</td>
            <td style="text-align:right;color:${cor};">${pct}%</td>
            <td>${sit}</td>
            <td style="text-align:right;">${fmtBRL(c.total_iss||c.v_iss_declarado||0)}</td>
          </tr>`;
        }).join('');
      })
      .catch(() => {});
  }

  function renderBarras(h) {
    const ctx = document.getElementById('chart-reforma-barras');
    if (!ctx) return;
    if (chartBarras) { chartBarras.destroy(); chartBarras = null; }

    chartBarras = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: (h.meses||[]).map(fmtMes),
        datasets: [
          {
            label: 'ISS Municipal',
            data:  h.iss_municipal || [],
            backgroundColor: 'rgba(99,102,241,0.75)',
            stack: 'tributos',
            borderRadius: { topLeft:2, topRight:2 },
          },
          {
            label: 'IBS Municipal',
            data:  h.ibs_municipal || [],
            backgroundColor: 'rgba(34,197,94,0.75)',
            stack: 'tributos',
          },
          {
            label: 'CBS',
            data:  h.cbs || [],
            backgroundColor: 'rgba(245,158,11,0.75)',
            stack: 'tributos',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color:'#e2e8f0', font:{size:11} } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtBRL(ctx.raw)}` } },
        },
        scales: {
          x: { stacked:true, ticks:{color:'#94a3b8'}, grid:{color:'rgba(255,255,255,0.05)'} },
          y: {
            stacked: true,
            ticks: { color:'#94a3b8', callback: v => fmtBRL(v).replace(/,\d{2}$/,'') },
            grid: { color:'rgba(255,255,255,0.05)' },
          },
        },
      },
    });
  }

  function renderDonut(r) {
    const ctx = document.getElementById('chart-reforma-donut');
    if (!ctx) return;
    if (chartDonut) { chartDonut.destroy(); chartDonut = null; }

    chartDonut = new window.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['ISS Municipal', 'IBS Municipal', 'CBS'],
        datasets: [{
          data: [r.total_iss||0, r.total_ibs||0, r.total_cbs||0],
          backgroundColor: ['rgba(99,102,241,0.85)','rgba(34,197,94,0.85)','rgba(245,158,11,0.85)'],
          borderWidth: 2,
          borderColor: '#1e293b',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color:'#e2e8f0', font:{size:10} } },
          tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmtBRL(ctx.raw)}` } },
        },
        cutout: '60%',
      },
    });
  }

  function renderInsight(r) {
    const el = document.getElementById('reforma-insight');
    if (!el) return;
    const pNew = r.proporcao_new_pct || 0;
    if (pNew < 1) {
      el.innerHTML = `✅ IBS/CBS ainda representam parcela mínima. Reforma em estágio inicial.`;
    } else if (pNew < 10) {
      el.innerHTML = `⚙️ IBS/CBS representam <strong>${pNew}%</strong> da arrecadação. Transição em andamento.`;
    } else {
      el.innerHTML = `⚠️ IBS/CBS atingiram <strong>${pNew}%</strong> da receita. Monitoramento estratégico recomendado.`;
    }
  }

  function renderTabela(h) {
    const tbody = document.getElementById('tbody-reforma');
    if (!h?.meses?.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--color-neutral-500);">Sem dados disponíveis.</td></tr>`;
      return;
    }

    // Exibe em ordem decrescente (mais recente primeiro)
    const rows = h.meses.map((m, i) => ({
      m, iss: h.iss_municipal[i]||0, ibs: h.ibs_municipal[i]||0,
      cbs: h.cbs[i]||0, serv: h.total_servicos[i]||0, notas: h.notas[i]||0,
    })).reverse();

    tbody.innerHTML = rows.map(r => {
      const trib = r.iss + r.ibs + r.cbs;
      const pct  = trib ? ((r.ibs + r.cbs) / trib * 100).toFixed(1) : '0.0';
      return `<tr>
        <td><strong>${fmtMes(r.m)}</strong></td>
        <td style="text-align:right;color:rgba(99,102,241,0.9);">${fmtBRL(r.iss)}</td>
        <td style="text-align:right;color:rgba(34,197,94,0.9);">${fmtBRL(r.ibs)}</td>
        <td style="text-align:right;color:rgba(245,158,11,0.9);">${fmtBRL(r.cbs)}</td>
        <td style="text-align:right;">${fmtBRL(r.serv)}</td>
        <td style="text-align:center;">${r.notas}</td>
        <td style="text-align:right;">${pct}%</td>
      </tr>`;
    }).join('');
  }

  function renderErro() {
    document.getElementById('tbody-reforma').innerHTML = `
      <tr><td colspan="7" style="text-align:center;padding:24px;color:var(--color-danger-400);">
        ❌ Serviço de IA indisponível.
      </td></tr>`;
  }

  document.getElementById('ia-reforma-refresh')?.addEventListener('click', carregar);
  carregar();
}
