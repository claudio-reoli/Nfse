/**
 * NFS-e Freire — Apuração PGDAS-D / Reconciliação ADN × PGDAS-D (R4, R6, R8)
 * Drill-down: competência → NFS-e por PA → rastreabilidade completa
 */
import { getBackendUrl } from '../api-service.js';
import { toast } from '../toast.js';

function getMunToken() {
  try { const s = localStorage.getItem('nfse_session'); return s ? (JSON.parse(s).token || '') : ''; } catch { return ''; }
}
function authH(extra = {}) {
  const t = getMunToken();
  return t ? { 'Authorization': `Bearer ${t}`, ...extra } : { ...extra };
}

const fmtBRL   = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const fmtCNPJ  = c => { const d = (c || '').replace(/\D/g, ''); return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : c; };
const fmtData  = s => { try { return new Date(s).toLocaleDateString('pt-BR'); } catch { return s || '—'; } };

export function renderPgdasApuracao(container) {
  const BASE = getBackendUrl();

  const hoje = new Date();
  const compPadrao = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">🔄 Apuração PGDAS-D</h1>
        <p class="page-description">Reconciliação ADN × PGDAS-D · Rastreabilidade NFS-e por Período de Apuração</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <label style="font-size:0.8rem;color:var(--color-neutral-400);">Competência:</label>
        <input type="month" id="apu-comp" class="form-input" value="${compPadrao}" style="width:160px;font-size:0.82rem;">
        <button id="apu-refresh" class="btn btn-secondary">🔄 Reconciliar</button>
        <button id="apu-export-csv" class="btn btn-ghost">📥 CSV</button>
      </div>
    </div>

    <!-- KPIs de reconciliação -->
    <div id="apu-kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:20px;">
      ${[1,2,3,4,5].map(() => `<div class="card" style="padding:16px;"><div style="height:50px;background:var(--surface-glass);border-radius:var(--radius-md);animation:pulse 1.5s infinite;"></div></div>`).join('')}
    </div>

    <!-- Filtros -->
    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
      <input type="text" id="apu-busca" class="form-input" placeholder="Filtrar por CNPJ ou nome..." style="flex:1;min-width:200px;max-width:320px;font-size:0.82rem;">
      <select id="apu-filtro-status" class="form-input" style="width:180px;font-size:0.82rem;">
        <option value="">Todos os status</option>
        <option value="ok">✅ OK</option>
        <option value="divergente">⚠️ Divergente</option>
        <option value="pendente">📋 Pendente</option>
        <option value="enviado">📤 Enviado</option>
      </select>
      <select id="apu-filtro-regime" class="form-input" style="width:180px;font-size:0.82rem;">
        <option value="">Todos os regimes</option>
        <option value="1">DAS / Simples (&le; 3,6M)</option>
        <option value="2">Guia Municipal (sublimite)</option>
        <option value="3">MEI / SIMEI</option>
      </select>
    </div>

    <!-- Tabela principal -->
    <div class="card animate-slide-up" style="padding:20px;margin-bottom:20px;">
      <h3 class="card-title" style="margin-bottom:14px;">🧾 Contribuintes — PA <span id="apu-comp-label">${compPadrao}</span></h3>
      <div class="table-container">
        <table class="data-table" id="apu-tabela">
          <thead>
            <tr>
              <th></th>
              <th>CNPJ</th>
              <th>Razão Social</th>
              <th>Regime (regApurTribSN)</th>
              <th>Notas ADN</th>
              <th>Rec. Bruta ADN</th>
              <th>Rec. Declarada PGDAS</th>
              <th>Divergência</th>
              <th>ISSQN ADN</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="apu-tbody">
            <tr><td colspan="11" style="text-align:center;padding:24px;color:var(--color-neutral-500);">Selecione a competência e clique em Reconciliar</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Painel de drill-down (notas do PA selecionado) -->
    <div id="apu-drilldown" style="display:none;" class="card animate-slide-up">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 20px 0;">
        <h3 class="card-title" style="margin-bottom:0;">📑 NFS-e do Período — <span id="drill-cnpj-label">—</span></h3>
        <button id="drill-fechar" class="btn btn-ghost btn-sm">✕ Fechar</button>
      </div>
      <div style="padding:20px;">
        <div id="drill-notas-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px;"></div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nº NFS-e</th>
                <th>Data Emissão</th>
                <th>Competência</th>
                <th>Tomador</th>
                <th>V. Serviço</th>
                <th>ISS</th>
                <th>CST / IBS / CBS</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="drill-tbody">
              <tr><td colspan="8" style="text-align:center;padding:16px;color:var(--color-neutral-500);">Carregando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  let _dados = [];
  let _dadosFiltrados = [];
  let _compAtual = compPadrao;

  async function reconciliar() {
    _compAtual = document.getElementById('apu-comp')?.value || compPadrao;
    document.getElementById('apu-comp-label').textContent = _compAtual;
    document.getElementById('apu-tbody').innerHTML =
      `<tr><td colspan="11" style="text-align:center;padding:24px;color:var(--color-neutral-500);">⏳ Reconciliando...</td></tr>`;

    try {
      const r = await fetch(`${BASE}/pgdas/reconciliacao?competencia=${_compAtual}`, { headers: authH() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();

      renderKpis(d.kpis || {});
      _dados = d.contribuintes || [];
      _dadosFiltrados = [..._dados];
      aplicarFiltros();
    } catch (e) {
      document.getElementById('apu-tbody').innerHTML =
        `<tr><td colspan="11" style="text-align:center;color:var(--color-danger-400);padding:24px;">❌ ${e.message}</td></tr>`;
    }
  }

  function renderKpis(k) {
    const grid = document.getElementById('apu-kpi-grid');
    if (!grid) return;
    const cards = [
      { icon: '🏢', label: 'Contribuintes', value: (k.total_contrib || 0).toLocaleString('pt-BR'), cor: 'var(--color-primary-400)' },
      { icon: '✅', label: 'Sem divergência', value: (k.total_ok || 0).toLocaleString('pt-BR'), cor: 'var(--color-success-400)' },
      { icon: '⚠️', label: 'Com divergência', value: (k.total_divergente || 0).toLocaleString('pt-BR'), cor: 'var(--color-danger-400)' },
      { icon: '💰', label: 'Total receita ADN', value: fmtBRL(k.rb_adn_total || 0), cor: 'var(--color-success-400)' },
      { icon: '📊', label: 'ISS total ADN', value: fmtBRL(k.iss_total || 0), cor: 'var(--color-warning-400)' },
    ];
    grid.innerHTML = cards.map(c => `
      <div class="card" style="padding:16px;border-left:3px solid ${c.cor};">
        <div style="font-size:1.2rem;margin-bottom:4px;">${c.icon}</div>
        <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--color-neutral-500);">${c.label}</div>
        <div style="font-size:1.1rem;font-weight:800;color:${c.cor};">${c.value}</div>
      </div>
    `).join('');
  }

  function regimeBadge(r) {
    const map = { '1': ['DAS (≤3,6M)', 'rgba(99,102,241,0.15)', 'rgba(99,102,241,0.9)'], '2': ['Guia Mun.', 'rgba(245,158,11,0.12)', 'rgba(245,158,11,0.9)'], '3': ['MEI/SIMEI', 'rgba(34,197,94,0.12)', 'rgba(34,197,94,0.8)'] };
    const [l, bg, c] = map[String(r)] || ['Normal', 'var(--surface-glass)', 'var(--color-neutral-400)'];
    return `<span style="padding:2px 8px;border-radius:20px;font-size:0.7rem;background:${bg};color:${c};">${l}</span>`;
  }

  function statusBadge(s) {
    const map = { ok: ['✅ OK', 'rgba(34,197,94,0.15)', 'rgba(34,197,94,0.8)'], divergente: ['⚠️ Divergente', 'rgba(239,68,68,0.12)', 'rgba(239,68,68,0.9)'], pendente: ['📋 Pendente', 'rgba(99,102,241,0.12)', 'rgba(99,102,241,0.8)'], enviado: ['📤 Enviado', 'rgba(34,197,94,0.08)', 'rgba(34,197,94,0.6)'] };
    const [l, bg, c] = map[s] || ['—', 'transparent', 'var(--color-neutral-400)'];
    return `<span style="padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:600;background:${bg};color:${c};">${l}</span>`;
  }

  function renderTabela(lista) {
    const tbody = document.getElementById('apu-tbody');
    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:24px;color:var(--color-neutral-500);">Nenhum resultado encontrado.</td></tr>`;
      return;
    }
    tbody.innerHTML = lista.map(d => {
      const div = Number(d.rb_adn || 0) - Number(d.rb_declarada || 0);
      const divCor = Math.abs(div) < 1 ? 'var(--color-success-400)' : div > 0 ? 'var(--color-danger-400)' : 'var(--color-warning-400)';
      return `
        <tr>
          <td><button class="btn btn-ghost btn-sm btn-expand" data-cnpj="${d.cnpj}" title="Ver NFS-e deste PA">▶</button></td>
          <td style="font-family:monospace;font-size:0.8rem;">${fmtCNPJ(d.cnpj)}</td>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.nome || '—'}</td>
          <td>${regimeBadge(d.reg_apur_trib_sn)}</td>
          <td style="text-align:center;">${d.total_notas || 0}</td>
          <td style="text-align:right;">${fmtBRL(d.rb_adn || 0)}</td>
          <td style="text-align:right;">${fmtBRL(d.rb_declarada || 0)}</td>
          <td style="text-align:right;color:${divCor};font-weight:600;">${Math.abs(div) < 0.01 ? '—' : fmtBRL(div)}</td>
          <td style="text-align:right;">${fmtBRL(d.v_iss || 0)}</td>
          <td>${statusBadge(d.status || 'pendente')}</td>
          <td>
            <button class="btn btn-ghost btn-sm btn-reconciliar-cnpj" data-cnpj="${d.cnpj}" title="Reconciliar individualmente">🔄</button>
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('.btn-expand').forEach(btn => {
      btn.addEventListener('click', () => carregarDrilldown(btn.dataset.cnpj));
    });
    tbody.querySelectorAll('.btn-reconciliar-cnpj').forEach(btn => {
      btn.addEventListener('click', () => reconciliarCnpj(btn.dataset.cnpj));
    });
  }

  async function reconciliarCnpj(cnpj) {
    try {
      const r = await fetch(`${BASE}/pgdas/reconciliacao/${cnpj}/${_compAtual}`, { method: 'POST', headers: authH() });
      const d = await r.json();
      if (d.sucesso) { toast.success('Reconciliação executada.'); reconciliar(); }
      else toast.error(d.erro || 'Erro na reconciliação.');
    } catch (e) { toast.error(e.message); }
  }

  async function carregarDrilldown(cnpj) {
    const painel = document.getElementById('apu-drilldown');
    document.getElementById('drill-cnpj-label').textContent = fmtCNPJ(cnpj);
    document.getElementById('drill-tbody').innerHTML = `<tr><td colspan="8" style="text-align:center;padding:16px;">⏳ Carregando...</td></tr>`;
    painel.style.display = 'block';
    painel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      const r = await fetch(`${BASE}/pgdas/notas-pa?cnpj=${cnpj}&competencia=${_compAtual}`, { headers: authH() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();

      // Grid de KPIs do contribuinte
      const notas = d.notas || [];
      const sumServ = notas.reduce((a, n) => a + Number(n.v_serv || 0), 0);
      const sumIss  = notas.reduce((a, n) => a + Number(n.v_iss || 0), 0);
      document.getElementById('drill-notas-grid').innerHTML = [
        { icon: '🧾', label: 'Notas na competência', value: notas.length.toLocaleString('pt-BR'), cor: 'var(--color-primary-400)' },
        { icon: '💰', label: 'Total serviços', value: fmtBRL(sumServ), cor: 'var(--color-success-400)' },
        { icon: '📊', label: 'Total ISS', value: fmtBRL(sumIss), cor: 'var(--color-warning-400)' },
      ].map(c => `
        <div class="card" style="padding:14px;border-left:3px solid ${c.cor};">
          <div style="font-size:1.1rem;">${c.icon}</div>
          <div style="font-size:0.68rem;text-transform:uppercase;color:var(--color-neutral-500);">${c.label}</div>
          <div style="font-size:1rem;font-weight:800;color:${c.cor};">${c.value}</div>
        </div>
      `).join('');

      document.getElementById('drill-tbody').innerHTML = notas.length ? notas.map(n => {
        const ibscbs = n.tributos?.ibscbs || {};
        return `
          <tr>
            <td style="font-family:monospace;">${n.n_nfse || '—'}</td>
            <td>${fmtData(n.dh_emi)}</td>
            <td style="font-family:monospace;">${n.competencia || n.d_compet?.substring(0,7) || '—'}</td>
            <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${n.tomador_nome || '—'}</td>
            <td style="text-align:right;">${fmtBRL(n.v_serv)}</td>
            <td style="text-align:right;">${fmtBRL(n.v_iss)}</td>
            <td style="font-size:0.72rem;color:var(--color-neutral-400);">
              ${ibscbs.CST ? `CST: ${ibscbs.CST}` : ''} ${ibscbs.pAliqIBS ? `IBS: ${ibscbs.pAliqIBS}%` : ''} ${ibscbs.pAliqCBS ? `CBS: ${ibscbs.pAliqCBS}%` : ''}
              ${!ibscbs.CST && !ibscbs.pAliqIBS ? '<span style="color:var(--color-warning-400)">⚠️ Sem IBSCBS</span>' : ''}
            </td>
            <td><span style="font-size:0.72rem;padding:2px 6px;border-radius:20px;background:${n.c_stat === '100' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'};color:${n.c_stat === '100' ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)'};">${n.status || n.c_stat || '—'}</span></td>
          </tr>`;
      }).join('') : `<tr><td colspan="8" style="text-align:center;color:var(--color-neutral-400);padding:20px;">Nenhuma NFS-e encontrada para este contribuinte nesta competência.</td></tr>`;
    } catch (e) {
      document.getElementById('drill-tbody').innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--color-danger-400);">❌ ${e.message}</td></tr>`;
    }
  }

  function aplicarFiltros() {
    const q    = (document.getElementById('apu-busca')?.value || '').toLowerCase();
    const st   = document.getElementById('apu-filtro-status')?.value;
    const rg   = document.getElementById('apu-filtro-regime')?.value;
    _dadosFiltrados = _dados.filter(d =>
      (!q  || (d.cnpj || '').includes(q.replace(/\D/g,'')) || (d.nome || '').toLowerCase().includes(q)) &&
      (!st || d.status === st) &&
      (!rg || String(d.reg_apur_trib_sn) === rg)
    );
    renderTabela(_dadosFiltrados);
  }

  function exportarCSV() {
    if (!_dadosFiltrados.length) { toast.info('Sem dados para exportar.'); return; }
    const header = ['CNPJ','Nome','Regime','Total_Notas','Rec_ADN','Rec_Declarada','Divergencia','ISS','Status'];
    const linhas = _dadosFiltrados.map(d => {
      const div = Number(d.rb_adn || 0) - Number(d.rb_declarada || 0);
      return [fmtCNPJ(d.cnpj), d.nome || '', d.reg_apur_trib_sn || '', d.total_notas || 0,
        d.rb_adn || 0, d.rb_declarada || 0, div.toFixed(2), d.v_iss || 0, d.status || 'pendente'
      ].map(v => `"${v}"`).join(';');
    });
    const blob = new Blob(['\uFEFF' + [header.join(';'), ...linhas].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `reconciliacao-pgdas-${_compAtual}.csv`; a.click();
  }

  // Eventos
  document.getElementById('apu-refresh')?.addEventListener('click', reconciliar);
  document.getElementById('apu-export-csv')?.addEventListener('click', exportarCSV);
  document.getElementById('drill-fechar')?.addEventListener('click', () => { document.getElementById('apu-drilldown').style.display = 'none'; });
  ['apu-busca','apu-filtro-status','apu-filtro-regime'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', aplicarFiltros);
    document.getElementById(id)?.addEventListener('input', aplicarFiltros);
  });

  reconciliar();
}
