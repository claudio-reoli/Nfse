/**
 * NFS-e Freire — IA Fiscal: Gestão de Risco
 * Score de Propensão ao Atraso (SPA) — Termômetro de Inadimplência por CNPJ
 */
import { getBackendUrl } from '../api-service.js';

function getMunToken() {
  try { const s = localStorage.getItem('nfse_session'); return s ? (JSON.parse(s).token || '') : ''; } catch { return ''; }
}

const COLORS = {
  alto:    ['rgba(239,68,68,0.9)',  'rgba(239,68,68,0.15)'],
  medio:   ['rgba(245,158,11,0.9)','rgba(245,158,11,0.15)'],
  baixo:   ['rgba(34,197,94,0.9)', 'rgba(34,197,94,0.12)'],
  neutral: 'rgba(99,102,241,0.9)',
};

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

export function renderIaRisco(container) {
  const BASE = getBackendUrl();

  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">🌡️ Gestão de Risco — Score de Inadimplência (SPA)</h1>
        <p class="page-description">Score 0–100 de propensão ao atraso · Segmentado por nível · Ações preventivas</p>
      </div>
      <button id="ia-risco-refresh" class="btn btn-secondary">🔄 Atualizar</button>
    </div>

    <div id="ia-risco-demo-banner" class="hidden" style="margin-bottom:16px;padding:10px 16px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);border-radius:var(--radius-md);font-size:0.82rem;color:var(--color-warning-400);">
      ⚠️ <strong>Modo Demonstração</strong> — Dados simulados. Alimente com apurações reais para ativar o modelo comportamental.
    </div>

    <!-- KPI cards de distribuição -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;">
      <div class="card" style="padding:16px;border-left:3px solid rgba(239,68,68,0.8);">
        <div style="font-size:0.7rem;text-transform:uppercase;color:var(--color-neutral-500);">Alto Risco</div>
        <div id="kpi-alto" style="font-size:2rem;font-weight:800;color:rgba(239,68,68,0.9);">—</div>
      </div>
      <div class="card" style="padding:16px;border-left:3px solid rgba(245,158,11,0.8);">
        <div style="font-size:0.7rem;text-transform:uppercase;color:var(--color-neutral-500);">Médio Risco</div>
        <div id="kpi-medio" style="font-size:2rem;font-weight:800;color:rgba(245,158,11,0.9);">—</div>
      </div>
      <div class="card" style="padding:16px;border-left:3px solid rgba(34,197,94,0.8);">
        <div style="font-size:0.7rem;text-transform:uppercase;color:var(--color-neutral-500);">Baixo Risco</div>
        <div id="kpi-baixo" style="font-size:2rem;font-weight:800;color:rgba(34,197,94,0.9);">—</div>
      </div>
      <div class="card" style="padding:16px;border-left:3px solid rgba(99,102,241,0.8);">
        <div style="font-size:0.7rem;text-transform:uppercase;color:var(--color-neutral-500);">Score Médio Geral</div>
        <div id="kpi-media" style="font-size:2rem;font-weight:800;color:rgba(99,102,241,0.9);">—</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:280px 1fr;gap:16px;margin-bottom:20px;align-items:start;">
      <!-- Gráfico donut distribuição -->
      <div class="card" style="padding:16px;">
        <div class="card-header" style="padding-bottom:10px;">
          <h3 class="card-title" style="font-size:0.85rem;">Distribuição de Risco</h3>
        </div>
        <div style="position:relative;height:200px;">
          <canvas id="chart-dist-risco"></canvas>
        </div>
      </div>

      <!-- Top 10 chart de barras -->
      <div class="card" style="padding:16px;">
        <div class="card-header" style="padding-bottom:10px;">
          <h3 class="card-title" style="font-size:0.85rem;">Top 10 — Contribuintes de Maior Risco</h3>
        </div>
        <div style="position:relative;height:200px;">
          <canvas id="chart-top-risco"></canvas>
        </div>
      </div>
    </div>

    <!-- Tabela detalhada -->
    <div class="card animate-slide-up">
      <div class="card-header" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <h3 class="card-title" style="flex:1;">📋 Ranking de Risco por Contribuinte</h3>
        <input type="text" id="ia-risco-filtro" class="form-input" placeholder="Filtrar por CNPJ..." style="width:200px;font-size:0.82rem;">
        <select id="ia-risco-nivel" class="form-input" style="width:140px;font-size:0.82rem;">
          <option value="">Todos os níveis</option>
          <option value="Alto">Alto</option>
          <option value="Médio">Médio</option>
          <option value="Baixo">Baixo</option>
        </select>
      </div>
      <div class="card-body">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>CNPJ</th>
                <th>Score SPA</th>
                <th>Nível</th>
                <th>Flags PGDAS</th>
                <th>Guias Total</th>
                <th>Pagas</th>
                <th>Vencidas</th>
                <th>Taxa Inad.</th>
                <th>ISS em Aberto</th>
              </tr>
            </thead>
            <tbody id="tbody-risco">
              <tr><td colspan="10" style="text-align:center;padding:24px;">⏳ Carregando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Seção PGDAS: Alertas de Malha e Impedimento -->
    <div class="card animate-slide-up" style="margin-top:20px;">
      <div style="padding:16px 20px;border-bottom:1px solid var(--surface-glass-border);">
        <h3 class="card-title" style="margin-bottom:0;">🔒 Alertas PGDAS-D — Malha Fiscal e Impedimento ISS</h3>
      </div>
      <div id="ia-risco-pgdas-cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;padding:16px;">
        <div style="height:60px;background:var(--surface-glass);border-radius:var(--radius-md);animation:pulse 1.5s infinite;"></div>
        <div style="height:60px;background:var(--surface-glass);border-radius:var(--radius-md);animation:pulse 1.5s infinite;"></div>
        <div style="height:60px;background:var(--surface-glass);border-radius:var(--radius-md);animation:pulse 1.5s infinite;"></div>
      </div>
      <div class="table-container" style="padding:0 20px 16px;">
        <table class="data-table">
          <thead>
            <tr>
              <th>CNPJ</th><th>Competência</th><th>Situação</th>
              <th>Rec. ADN</th><th>Rec. PGDAS</th><th>Gap</th><th>RBT12 Oficial</th>
            </tr>
          </thead>
          <tbody id="tbody-pgdas-alertas">
            <tr><td colspan="7" style="text-align:center;padding:20px;color:var(--color-neutral-500);">⏳ Carregando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  let allScores = [];
  let chartDist = null, chartTop = null;

  let _pgdasMalha = null;

  async function carregar() {
    try {
      const [res, rMalha] = await Promise.all([
        fetch(`${BASE}/ia/inadimplencia`, { headers: authH() }),
        fetch(`${BASE}/ia/pgdas-malha`,   { headers: authH() }),
      ]);
      if (!res.ok) { renderErro(); return; }
      const data = await res.json();
      _pgdasMalha = rMalha.ok ? await rMalha.json() : null;

      allScores = data.scores || [];

      // KPI cards
      const d = data.distribuicao || {};
      document.getElementById('kpi-alto').textContent  = d.alto  ?? '—';
      document.getElementById('kpi-medio').textContent = d.medio ?? '—';
      document.getElementById('kpi-baixo').textContent = d.baixo ?? '—';
      document.getElementById('kpi-media').textContent = data.media_score ?? '—';

      renderDonut(d);
      renderBarTop(allScores.slice(0, 10));
      renderTabela(allScores);
      if (_pgdasMalha) renderPgdasAlertas(_pgdasMalha);

      if (data.fonte === 'demo') document.getElementById('ia-risco-demo-banner')?.classList.remove('hidden');
    } catch { renderErro(); }
  }

  function renderDonut(d) {
    const ctx = document.getElementById('chart-dist-risco');
    if (!ctx) return;
    if (chartDist) { chartDist.destroy(); chartDist = null; }
    chartDist = new window.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Alto','Médio','Baixo'],
        datasets: [{
          data: [d.alto||0, d.medio||0, d.baixo||0],
          backgroundColor: [COLORS.alto[0], COLORS.medio[0], COLORS.baixo[0]],
          borderWidth: 2,
          borderColor: '#1e293b',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color:'#e2e8f0', font:{size:11} } },
        },
        cutout: '65%',
      },
    });
  }

  function renderBarTop(scores) {
    const ctx = document.getElementById('chart-top-risco');
    if (!ctx) return;
    if (chartTop) { chartTop.destroy(); chartTop = null; }

    const labels = scores.map(s => fmtCNPJ(s.cnpj));
    const vals   = scores.map(s => s.score);
    const bgColors = vals.map(v =>
      v >= 70 ? COLORS.alto[0] : (v >= 40 ? COLORS.medio[0] : COLORS.baixo[0])
    );

    chartTop = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Score SPA',
          data: vals,
          backgroundColor: bgColors,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { min:0, max:100, ticks:{color:'#94a3b8'}, grid:{color:'rgba(255,255,255,0.05)'} },
          y: { ticks: { color:'#94a3b8', font:{size:10} } },
        },
      },
    });
  }

  function renderTabela(scores) {
    const tbody  = document.getElementById('tbody-risco');
    const filtro = (document.getElementById('ia-risco-filtro')?.value || '').toLowerCase();
    const nivel  = document.getElementById('ia-risco-nivel')?.value || '';

    const filtrado = scores.filter(s =>
      (!filtro || fmtCNPJ(s.cnpj).includes(filtro))
      && (!nivel || s.nivel_risco === nivel)
    );

    if (!filtrado.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--color-neutral-500);">Nenhum resultado encontrado.</td></tr>`;
      return;
    }

    const nivelClr = { 'Alto': 'badge-danger', 'Médio': 'badge-warning', 'Baixo': 'badge-success' };
    const scoreBar = v => `<div style="display:flex;align-items:center;gap:6px;">
      <div style="flex:1;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${v}%;background:${v>=70?COLORS.alto[0]:v>=40?COLORS.medio[0]:COLORS.baixo[0]};border-radius:3px;"></div>
      </div>
      <strong style="font-size:0.82rem;min-width:28px;">${v}</strong>
    </div>`;

    // Mapa PGDAS por CNPJ para badges
    const pgdasMap = {};
    (_pgdasMalha?.alertas || []).forEach(a => { pgdasMap[a.cnpj] = a; });

    tbody.innerHTML = filtrado.map((s, i) => {
      const pm = pgdasMap[s.cnpj];
      const badges = [];
      if (pm?.retido_malha) badges.push(`<span style="font-size:0.62rem;padding:1px 5px;border-radius:20px;background:rgba(239,68,68,0.18);color:rgba(239,68,68,0.9);white-space:nowrap;">🔒 Malha</span>`);
      if (pm?.impedido_iss) badges.push(`<span style="font-size:0.62rem;padding:1px 5px;border-radius:20px;background:rgba(245,158,11,0.18);color:rgba(245,158,11,0.9);white-space:nowrap;">🏛️ Impd.ISS</span>`);
      if (pm?.gap_pct > 20) badges.push(`<span style="font-size:0.62rem;padding:1px 5px;border-radius:20px;background:rgba(239,68,68,0.12);color:rgba(239,68,68,0.7);white-space:nowrap;">📉 ${pm.gap_pct}%</span>`);
      return `
      <tr>
        <td>${i+1}</td>
        <td class="text-mono">${fmtCNPJ(s.cnpj)}</td>
        <td style="min-width:140px;">${scoreBar(s.score)}</td>
        <td><span class="badge ${nivelClr[s.nivel_risco]||''}">${s.nivel_risco}</span>${s.alerta?' ⚠️':''}</td>
        <td style="display:flex;flex-wrap:wrap;gap:3px;padding:6px 4px;">${badges.join('') || '<span style="color:var(--color-neutral-600);font-size:0.7rem;">—</span>'}</td>
        <td style="text-align:center;">${s.total_guias}</td>
        <td style="text-align:center;color:var(--color-success-400);">${s.guias_pagas}</td>
        <td style="text-align:center;color:var(--color-danger-400);">${s.guias_abertas_vencidas}</td>
        <td style="text-align:right;">${s.taxa_inadimplencia_pct}%</td>
        <td style="text-align:right;color:var(--color-danger-400);">${fmtBRL(s.total_iss_em_aberto)}</td>
      </tr>`;
    }).join('');
  }

  function renderPgdasAlertas(pgdas) {
    const cards = document.getElementById('ia-risco-pgdas-cards');
    if (cards) {
      cards.innerHTML = [
        { icon:'🔒', label:'Retidos Malha',   value: pgdas.retidos,  clr:'rgba(239,68,68,0.9)'   },
        { icon:'🏛️', label:'Impedidos ISS',   value: pgdas.impedidos, clr:'rgba(245,158,11,0.9)'  },
        { icon:'💰', label:'Gap Total Receita',value: new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(pgdas.gap_total||0), clr:'rgba(239,68,68,0.9)' },
      ].map(c => `
        <div style="padding:14px;background:var(--surface-glass);border-radius:var(--radius-md);border-left:3px solid ${c.clr};">
          <div style="font-size:1.1rem;">${c.icon}</div>
          <div style="font-size:0.65rem;text-transform:uppercase;color:var(--color-neutral-500);">${c.label}</div>
          <div style="font-size:1.3rem;font-weight:800;color:${c.clr};">${typeof c.value === 'number' ? c.value : c.value}</div>
          ${pgdas.fonte === 'demo' ? '<div style="font-size:0.6rem;color:var(--color-neutral-600);">Demo</div>' : ''}
        </div>
      `).join('');
    }

    const tbody = document.getElementById('tbody-pgdas-alertas');
    if (!tbody) return;
    const alertas = pgdas.alertas || [];
    if (!alertas.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:16px;color:var(--color-neutral-500);">Nenhum alerta PGDAS encontrado.</td></tr>`;
      return;
    }
    tbody.innerHTML = alertas.slice(0, 20).map(a => {
      const nivelClr = a.nivel === 'alto' ? 'rgba(239,68,68,0.9)' : a.nivel === 'medio' ? 'rgba(245,158,11,0.9)' : 'rgba(34,197,94,0.8)';
      const tags = a.motivos?.map(m => `<span style="font-size:0.65rem;padding:1px 5px;border-radius:20px;background:rgba(239,68,68,0.12);color:rgba(239,68,68,0.8);margin-right:3px;">${m}</span>`).join('') || '—';
      return `<tr>
        <td style="font-family:monospace;font-size:0.8rem;">${fmtCNPJ(a.cnpj)}</td>
        <td>${a.competencia || '—'}</td>
        <td>${tags}</td>
        <td style="text-align:right;">${fmtBRL(a.rb_adn)}</td>
        <td style="text-align:right;">${fmtBRL(a.rb_pgdas)}</td>
        <td style="text-align:right;color:${a.gap_receita > 0 ? 'rgba(239,68,68,0.8)' : 'var(--color-neutral-500)'};">
          ${a.gap_receita !== 0 ? fmtBRL(a.gap_receita) : '—'}
          ${a.gap_pct > 0 ? `<span style="font-size:0.7rem;color:rgba(239,68,68,0.7);margin-left:4px;">(${a.gap_pct}%)</span>` : ''}
        </td>
        <td style="text-align:right;">${fmtBRL(a.rbt12)}</td>
      </tr>`;
    }).join('');
  }

  function renderErro() {
    document.getElementById('tbody-risco').innerHTML = `
      <tr><td colspan="10" style="text-align:center;padding:24px;color:var(--color-danger-400);">
        ❌ Serviço de IA indisponível. Verifique se o microserviço Python está rodando.
      </td></tr>`;
  }

  document.getElementById('ia-risco-refresh')?.addEventListener('click', carregar);
  document.getElementById('ia-risco-filtro')?.addEventListener('input',  () => renderTabela(allScores));
  document.getElementById('ia-risco-nivel')?.addEventListener('change',  () => renderTabela(allScores));

  carregar();
}
