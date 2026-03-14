/**
 * NFS-e Freire — Consulta de Notas Importadas (Módulo Município)
 */
import { getBackendUrl } from '../api-service.js';
import { toast } from '../toast.js';

function getMunToken() {
  try { const s = localStorage.getItem('nfse_session'); return s ? (JSON.parse(s).token || '') : ''; } catch { return ''; }
}
import { formatMunicipioDisplaySync, formatEnderecoMunicipio, formatEstrangeiroDisplay } from '../municipios-ibge.js';

const fmtCNPJ = (v) => { if (!v || v.length < 14) return v || '—'; return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5"); };
const fmtCPF = (v) => { if (!v || v.length < 11) return v || ''; return v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"); };
const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtPct = (v) => {
  if (v == null || v === '') return '—';
  const num = Number(v);
  const pct = num <= 1 && num > 0 ? num * 100 : num;
  return `${pct.toFixed(2)}%`;
};
const fmtDoc = (p) => p?.CNPJ ? fmtCNPJ(p.CNPJ) : p?.CPF ? fmtCPF(p.CPF) : '—';
const fmtData = (v) => { if (!v) return '—'; try { return new Date(v).toLocaleString('pt-BR'); } catch { return v; } };
const fmtDataCurta = (v) => { if (!v) return '—'; try { return new Date(v).toLocaleDateString('pt-BR'); } catch { return v; } };
const safe = (v) => v || '—';

const TRIB_ISSQN_MAP = { '1': 'Tributável', '2': 'Imunidade', '3': 'Exportação', '4': 'Não Incidência' };
const RET_ISSQN_MAP = { '1': 'Não Retido', '2': 'Retido pelo Tomador', '3': 'Retido pelo Intermediário' };
const TP_EMIT_MAP = { '1': 'Prestador', '2': 'Tomador', '3': 'Intermediário' };
const OP_SIMP_MAP = { '1': 'Não Optante', '2': 'MEI', '3': 'ME/EPP' };
const REG_ESP_MAP = { '0': 'Nenhum', '1': 'Ato Cooperado', '2': 'Estimativa', '3': 'ME Municipal', '4': 'Notário', '5': 'Autônomo', '6': 'Soc. Profissionais', '9': 'Outros' };
const MD_PREST_MAP = { '0': 'Desconhecido', '1': 'Transfronteiriço', '2': 'Consumo no Brasil', '3': 'Presença Comercial Ext.', '4': 'Mov. Temp. PF' };

function buildEnderecoHtml(end, xLocEmissor) {
  if (!end) return '';
  const cPais = end.cPais || end.cPaisPrestacao;
  if (cPais && String(cPais).toUpperCase() !== 'BR') {
    const ext = formatEstrangeiroDisplay(cPais, end.xCidade, end.xEstProvReg || end.xEstProv);
    if (ext) return ext;
  }
  const parts = [];
  if (end.xLgr) parts.push(`${end.xLgr}${end.nro ? ', ' + end.nro : ''}`);
  if (end.xCpl) parts.push(end.xCpl);
  if (end.xBairro) parts.push(end.xBairro);
  if (end.CEP) parts.push(`CEP ${end.CEP}`);
  const munDisplay = formatEnderecoMunicipio(end, xLocEmissor) || (end.cMun ? formatMunicipioDisplaySync(end.cMun, end.xMun, end.UF || end.uf) : '');
  if (munDisplay) parts.push(munDisplay);
  return parts.join(' — ') || '';
}

function buildPessoaCard(title, p) {
  if (!p || (!p.CNPJ && !p.CPF && !p.NIF && !p.xNome)) return '';
  const isEstrangeiro = !!(p.NIF && !p.CNPJ && !p.CPF);
  const doc = p.CNPJ ? `CNPJ: ${fmtCNPJ(p.CNPJ)}` : p.CPF ? `CPF: ${fmtCPF(p.CPF)}` : p.NIF ? `NIF: ${p.NIF}${isEstrangeiro ? ' <span class="badge badge-warning" style="font-size:0.65rem;">Estrangeiro</span>' : ''}` : '';
  const nif = (p.NIF && (p.CNPJ || p.CPF)) ? `<div>NIF: ${p.NIF}</div>` : '';
  const im = p.IM ? `<div>IM: ${p.IM}</div>` : '';
  const caepf = p.CAEPF ? `<div>CAEPF: ${p.CAEPF}</div>` : '';
  const contato = [p.fone ? `Tel: ${p.fone}` : '', p.email || ''].filter(Boolean).join(' | ');
  const endereco = buildEnderecoHtml(p.endereco);
  const extras = [];
  if (p.opSimpNac) extras.push(`SN: ${OP_SIMP_MAP[p.opSimpNac] || p.opSimpNac}`);
  if (p.regEspTrib) extras.push(`Reg.Esp: ${REG_ESP_MAP[p.regEspTrib] || p.regEspTrib}`);

  return `<div style="padding:12px;background:var(--surface-glass);border-radius:var(--radius-sm);margin-bottom:8px;">
    <div style="font-size:0.75rem;color:var(--color-neutral-400);text-transform:uppercase;margin-bottom:4px;">${title}</div>
    <strong>${safe(p.xNome)}</strong>
    <div style="font-size:0.85rem;">${doc}</div>
    ${nif}${im}${caepf}
    ${contato ? `<div style="font-size:0.82rem;color:var(--color-neutral-300);">${contato}</div>` : ''}
    ${endereco ? `<div style="font-size:0.8rem;color:var(--color-neutral-400);margin-top:2px;">${endereco}</div>` : ''}
    ${extras.length ? `<div style="font-size:0.8rem;margin-top:3px;">${extras.join(' | ')}</div>` : ''}
  </div>`;
}

function buildRow(label, value, color) {
  if (value === '—' || value === '' || value === undefined || value === null) return '';
  const style = color ? `color:${color};` : '';
  return `<div style="display:flex;justify-content:space-between;margin-bottom:6px;">
    <span style="color:var(--color-neutral-400);">${label}</span>
    <strong style="${style}">${value}</strong>
  </div>`;
}

export function renderConsultaNotasMun(container) {
  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">Notas Importadas da Base Nacional (ADN)</h1>
        <p class="page-description">Consulta ao repositório local de NFS-e sincronizadas — todos os campos da API ADN.</p>
      </div>
      <button class="btn btn-secondary" onclick="window.location.hash='/dashboard'">
        ← Voltar ao Painel
      </button>
    </div>

    <div class="card animate-slide-up">
      <div class="card-header" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <input type="text" class="form-input" id="filtro-pesquisa"
          placeholder="Buscar por Chave, CNPJ, Nome, Serviço..."
          style="flex:1;min-width:180px;max-width:340px;">
        <button class="btn btn-secondary" id="btn-buscar">🔍 Buscar</button>
        <div style="display:flex;align-items:center;gap:6px;margin-left:auto;">
          <label style="font-size:0.82rem;color:var(--color-neutral-400);white-space:nowrap;">Exibir:</label>
          <select class="form-select" id="sel-por-pagina" style="width:76px;padding:4px 8px;">
            <option value="10">10</option>
            <option value="25" selected>25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="0">Todos</option>
          </select>
          <span id="label-total-registros" style="font-size:0.82rem;color:var(--color-neutral-500);white-space:nowrap;"></span>
        </div>
      </div>

      <div class="table-container" style="overflow-x:auto;">
        <table class="data-table" id="tabela-notas" style="min-width:700px;">
          <thead>
            <tr>
              <th style="width:80px;">NSU</th>
              <th style="width:110px;">Competência</th>
              <th>Prestador / Tomador</th>
              <th style="max-width:180px;">Serviço</th>
              <th style="width:110px;text-align:right;">Valor (R$)</th>
              <th style="width:70px;text-align:center;">ISS</th>
              <th style="width:60px;text-align:center;">IBS/CBS</th>
              <th style="width:60px;text-align:center;">Fonte</th>
              <th style="width:40px;text-align:center;"></th>
            </tr>
          </thead>
          <tbody>
            <tr><td colspan="8" style="text-align:center;">Carregando notas...</td></tr>
          </tbody>
        </table>
      </div>

      <div id="paginacao-bar" style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-top:1px solid var(--surface-glass-border);flex-wrap:wrap;gap:8px;">
        <span id="pag-info" style="font-size:0.82rem;color:var(--color-neutral-400);"></span>
        <div style="display:flex;align-items:center;gap:4px;">
          <button class="btn btn-ghost btn-sm" id="btn-pag-prev" style="padding:3px 10px;">‹</button>
          <span id="pag-nums" style="display:flex;gap:3px;"></span>
          <button class="btn btn-ghost btn-sm" id="btn-pag-next" style="padding:3px 10px;">›</button>
        </div>
      </div>
    </div>

    <div id="modal-detalhes" class="modal-overlay hidden" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.72);z-index:1000;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 12px;display:none;">
      <div id="modal-det-inner" style="width:100%;max-width:980px;border-radius:var(--radius-xl);overflow:hidden;background:var(--surface-card);border:1px solid var(--surface-glass-border);position:relative;margin:auto;">
        <button id="fechar-modal-det" title="Fechar" style="position:absolute;right:14px;top:14px;background:rgba(239,68,68,0.12);border:none;color:var(--color-danger-400);cursor:pointer;width:30px;height:30px;border-radius:50%;font-size:16px;font-weight:bold;line-height:1;z-index:10;display:flex;align-items:center;justify-content:center;">✕</button>
        <div id="detalhes-conteudo"></div>
      </div>
    </div>
  `;

  let localNotasData = [];
  let filteredData = [];
  let currentPage = 1;
  let porPagina = 25;

  const getNome = (p) => p?.xNome || p?.nome || '—';
  const getDoc = (p) => p?.CNPJ || p?.cnpj || p?.CPF || p?.cpf || '';
  const getValor = (n) => n.valores?.vServ ?? n.valorServico ?? 0;
  const getCompet = (n) => n.dadosGerais?.dCompet || n.competencia || '';
  const getAliq = (n) => n.tributos?.issqn?.pAliq ?? n.aliquota ?? 0;
  const getRetDesc = (n) => {
    const r = n.tributos?.issqn?.tpRetISSQN;
    return r ? (RET_ISSQN_MAP[r] || r) : (n.issRetidoFonte ? 'Retido' : '');
  };
  const getServDesc = (n) => {
    const desc = n.servico?.xDescServ || '';
    return desc.length > 45 ? desc.substring(0, 43) + '…' : (desc || '—');
  };

  function renderNotasTable(notas) {
    filteredData = notas || [];
    currentPage = 1;
    renderPage();
  }

  function renderPage() {
    const tbody = document.getElementById('tabela-notas')?.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const total = filteredData.length;
    const start = (currentPage - 1) * porPagina;
    const end = porPagina === 0 ? total : Math.min(start + porPagina, total);
    const pageData = porPagina === 0 ? filteredData : filteredData.slice(start, end);

    if (total === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;">Nenhuma nota encontrada.</td></tr>';
      updatePaginacao(0, 0, 0);
      return;
    }

    pageData.forEach((n) => {
      const tr = document.createElement('tr');
      const cStat = n.dadosGerais?.cStat || '';
      const chave = n.chaveAcesso || '';
      const prestNome = getNome(n.prestador);
      const prestDoc = getDoc(n.prestador);
      const tomaNome = getNome(n.tomador);
      const tomaDoc = getDoc(n.tomador);
      const aliq = getAliq(n);
      const retInfo = getRetDesc(n);
      const retColor = retInfo.includes('Retido') && !retInfo.includes('Não') ? 'var(--color-danger-400)' : 'var(--color-neutral-400)';
      const fonteBadge = n._fonte === 'ADN'
        ? '<span class="badge badge-success" style="font-size:0.65rem;">ADN</span>'
        : '<span class="badge badge-warning" style="font-size:0.65rem;">Local</span>';
      const decisaoBadge = cStat === '102'
        ? '<span class="badge badge-danger" style="font-size:0.65rem;" title="Decisão Judicial">⚠️</span>'
        : '';

      tr.innerHTML = `
        <td style="font-size:0.82rem;font-weight:600;color:var(--color-neutral-300);">${n.nsu}</td>
        <td style="font-size:0.8rem;color:var(--color-neutral-400);">${getCompet(n)}</td>
        <td>
          <div style="font-size:0.85rem;font-weight:500;">${prestNome}</div>
          <div class="text-mono" style="font-size:0.75rem;color:var(--color-neutral-500);">${fmtCNPJ(prestDoc)}</div>
          <div style="font-size:0.78rem;color:var(--color-neutral-400);margin-top:2px;">↳ ${tomaNome}</div>
          <div class="text-mono" style="font-size:0.72rem;color:var(--color-neutral-600);">${fmtCNPJ(tomaDoc)}</div>
        </td>
        <td style="font-size:0.8rem;max-width:180px;" title="${n.servico?.xDescServ || ''}">${getServDesc(n)}</td>
        <td style="font-weight:600;color:var(--color-primary-400);text-align:right;white-space:nowrap;">${fmtBRL(getValor(n))}</td>
        <td style="font-size:0.8rem;text-align:center;">
          <div>${aliq ? fmtPct(aliq) : '—'}</div>
          <div style="font-size:0.72rem;color:${retColor};">${retInfo ? retInfo.replace('Retido pelo ', '') : '—'}</div>
        </td>
        <td style="text-align:center;">
          ${(() => { const ib = n.tributos?.ibscbs || n.ibscbs || {}; const ok = ib.CST || ib.cClassTrib; return ok ? '<span title="IBS/CBS preenchido" style="font-size:0.7rem;padding:2px 6px;border-radius:20px;background:rgba(99,102,241,0.15);color:rgba(99,102,241,0.9);">✓ 2026</span>' : '<span title="Campos IBS/CBS ausentes" style="font-size:0.7rem;padding:2px 6px;border-radius:20px;background:rgba(245,158,11,0.12);color:rgba(245,158,11,0.85);">⚠️</span>'; })()}
        </td>
        <td style="text-align:center;">${fonteBadge}${decisaoBadge ? '<br>' + decisaoBadge : ''}</td>
        <td style="text-align:center;">
          <button class="btn btn-ghost btn-sm btn-detalhes" data-chave="${chave}"
            title="Ver dados completos da nota"
            style="font-size:1.05rem;padding:3px 7px;line-height:1;">📋</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    updatePaginacao(total, porPagina === 0 ? 1 : start + 1, end);
  }

  function updatePaginacao(total, from, to) {
    const labelTotal = document.getElementById('label-total-registros');
    const info = document.getElementById('pag-info');
    const numsEl = document.getElementById('pag-nums');
    const prevBtn = document.getElementById('btn-pag-prev');
    const nextBtn = document.getElementById('btn-pag-next');
    const totalPages = porPagina === 0 ? 1 : Math.ceil(total / porPagina);

    if (labelTotal) labelTotal.textContent = `${total} registro(s)`;
    if (info) info.textContent = total > 0 ? `Exibindo ${from}–${to} de ${total}` : 'Nenhum registro';

    if (numsEl) {
      numsEl.innerHTML = '';
      if (totalPages > 1) {
        const rangeStart = Math.max(1, currentPage - 2);
        const rangeEnd = Math.min(totalPages, rangeStart + 4);
        for (let p = rangeStart; p <= rangeEnd; p++) {
          const b = document.createElement('button');
          b.className = `btn btn-sm ${p === currentPage ? 'btn-primary' : 'btn-ghost'}`;
          b.style.cssText = 'min-width:30px;padding:3px 8px;';
          b.textContent = p;
          b.addEventListener('click', () => { currentPage = p; renderPage(); });
          numsEl.appendChild(b);
        }
      }
    }
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  }

  document.getElementById('tabela-notas')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-detalhes');
    if (!btn) return;
    const chave = btn.dataset.chave;
    const nota = localNotasData.find(n => n.chaveAcesso === chave);
    if (nota) abrirModalDetalhes(nota);
  });

  async function loadNotas() {
    try {
      const response = await fetch(`${getBackendUrl()}/municipio/notas`, {
        headers: { 'Authorization': `Bearer ${getMunToken()}` }
      });
      const data = await response.json();
      if (!data.sucesso || data.notas.length === 0) { renderNotasTable([]); return; }
      localNotasData = data.notas;
      renderNotasTable(localNotasData);
    } catch (err) {
      console.error('Erro ao carregar NFSe:', err);
      document.getElementById('tabela-notas')?.querySelector('tbody').insertAdjacentHTML('afterbegin',
        '<tr><td colspan="8" style="text-align:center;color:var(--color-danger-400);padding:24px;">Erro ao conectar ao backend.</td></tr>');
    }
  }

  function buildSection(icon, title, content) {
    if (!content.trim()) return '';
    return `
      <div style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:1rem;">${icon}</span>
          <span style="font-size:0.78rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--color-primary-300);">${title}</span>
          <div style="flex:1;height:1px;background:var(--surface-glass-border);margin-left:4px;"></div>
        </div>
        ${content}
      </div>`;
  }

  function buildGrid2(rows) {
    const items = rows.filter(Boolean);
    if (!items.length) return '';
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;">${items.join('')}</div>`;
  }

  function buildGrid3(items) {
    return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">${items.join('')}</div>`;
  }

  function buildStatCard(label, value, color = 'var(--color-neutral-200)') {
    return `<div style="padding:12px 14px;background:var(--surface-glass);border-radius:var(--radius-md);border:1px solid var(--surface-glass-border);">
      <div style="font-size:0.7rem;color:var(--color-neutral-500);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">${label}</div>
      <div style="font-size:1rem;font-weight:700;color:${color};">${value}</div>
    </div>`;
  }

  function buildDetailRow(label, value, color) {
    if (!value || value === '—') return '';
    const style = color ? `color:${color};font-weight:600;` : 'font-weight:500;';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
      <span style="color:var(--color-neutral-400);font-size:0.82rem;">${label}</span>
      <span style="font-size:0.83rem;${style}text-align:right;max-width:58%;">${value}</span>
    </div>`;
  }

  function buildPersonCard(title, p, accentColor = 'var(--color-primary-400)') {
    if (!p || (!p.CNPJ && !p.CPF && !p.NIF && !p.xNome)) return '';
    const doc = p.CNPJ ? fmtCNPJ(p.CNPJ) : p.CPF ? fmtCPF(p.CPF) : p.NIF || '';
    const docLabel = p.CNPJ ? 'CNPJ' : p.CPF ? 'CPF' : 'NIF';
    const initials = (p.xNome || '??').replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('');
    const im = p.IM ? `<div style="font-size:0.78rem;color:var(--color-neutral-400);">IM: ${p.IM}</div>` : '';
    const caepf = p.CAEPF ? `<div style="font-size:0.78rem;color:var(--color-neutral-400);">CAEPF: ${p.CAEPF}</div>` : '';
    const contato = [p.fone, p.email].filter(Boolean).join(' · ');
    const end = buildEnderecoHtml(p.endereco);
    const regimes = [
      p.opSimpNac ? `SN: ${OP_SIMP_MAP[p.opSimpNac]||p.opSimpNac}` : '',
      p.regEspTrib && p.regEspTrib !== '0' ? `Reg.Esp: ${REG_ESP_MAP[p.regEspTrib]||p.regEspTrib}` : '',
    ].filter(Boolean).join(' · ');
    return `<div style="padding:14px;background:var(--surface-glass);border-radius:var(--radius-md);border:1px solid var(--surface-glass-border);">
      <div style="font-size:0.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${accentColor};margin-bottom:10px;">${title}</div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="width:38px;height:38px;border-radius:50%;background:${accentColor}22;border:2px solid ${accentColor}44;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;color:${accentColor};flex-shrink:0;">${initials||'?'}</div>
        <div>
          <div style="font-weight:600;font-size:0.9rem;">${safe(p.xNome)}</div>
          <div style="font-size:0.78rem;color:var(--color-neutral-400);font-family:monospace;">${docLabel}: ${doc}</div>
        </div>
      </div>
      ${im}${caepf}
      ${contato ? `<div style="font-size:0.78rem;color:var(--color-neutral-400);margin-top:4px;">📞 ${contato}</div>` : ''}
      ${end ? `<div style="font-size:0.76rem;color:var(--color-neutral-500);margin-top:4px;line-height:1.4;">📍 ${end}</div>` : ''}
      ${regimes ? `<div style="font-size:0.76rem;color:var(--color-neutral-400);margin-top:5px;padding:4px 8px;background:rgba(255,255,255,0.04);border-radius:4px;">${regimes}</div>` : ''}
    </div>`;
  }

  function abrirModalDetalhes(n) {
    const g  = n.dadosGerais || {};
    const s  = n.servico     || {};
    const v  = n.valores     || {};
    const ti = n.tributos?.issqn    || {};
    const tf = n.tributos?.federal  || {};
    const tt = n.tributos?.totais   || {};
    const ib = n.ibscbs             || {};
    const ce = n.comercioExterior   || {};
    const ob = n.obra               || {};
    const ev = n.atvEvt             || {};
    const im = n.imovel             || {};
    const dr = v.dedRed             || {};

    const retIss  = RET_ISSQN_MAP[ti.tpRetISSQN] || (n.issRetidoFonte ? 'Retido' : 'Não Retido');
    const isRetido = ti.tpRetISSQN === '2' || ti.tpRetISSQN === '3' || n.issRetidoFonte;
    const statusColor = n.status === 'Ativa' ? 'var(--color-success-400)' : 'var(--color-danger-400)';
    const vServ = v.vServ ?? n.valorServico ?? 0;
    const vLiq  = v.vLiq  ?? vServ;
    const vIss  = ti.vISS ?? 0;
    const pAliq = ti.pAliq ?? 0;

    // ── Alerta cStat 102 ──
    const alertBanner = g.cStat === '102'
      ? `<div style="padding:12px 20px;background:rgba(239,68,68,0.15);border-left:4px solid var(--color-danger-400);color:var(--color-danger-300);font-size:0.85rem;font-weight:600;">
           ⚠️ Decisão Judicial/Administrativa (cStat=102) — fluxo bypass. Exige homologação manual ao fechar o mês.
         </div>`
      : '';

    // ── Cabeçalho ──
    const header = `
      <div style="padding:20px 24px 16px;border-bottom:1px solid var(--surface-glass-border);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
          <div>
            <div style="font-size:1.05rem;font-weight:700;margin-bottom:4px;">Dados Completos da NFS-e</div>
            <div style="font-size:0.72rem;color:var(--color-neutral-500);">NSU ${n.nsu} · ${fmtData(g.dhEmi)} · Competência ${safe(g.dCompet)}</div>
          </div>
          <span class="badge ${n.status === 'Ativa' ? 'badge-success' : 'badge-danger'}" style="font-size:0.78rem;padding:4px 12px;">${n.status || 'Ativa'}</span>
        </div>
        <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:var(--radius-md);padding:10px 14px;">
          <div style="font-size:0.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--color-neutral-500);margin-bottom:4px;">Chave de Acesso Padrão Nacional</div>
          <div style="font-family:monospace;font-size:0.88rem;word-break:break-all;color:var(--color-primary-300);letter-spacing:.03em;">${n.chaveAcesso || '—'}</div>
        </div>
      </div>`;

    // ── Summary cards ──
    const summary = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;padding:16px 24px;border-bottom:1px solid var(--surface-glass-border);">
        ${buildStatCard('Valor do Serviço', fmtBRL(vServ), 'var(--color-primary-400)')}
        ${buildStatCard('Valor Líquido', fmtBRL(vLiq), 'var(--color-success-400)')}
        ${buildStatCard('ISS / Alíquota', vIss ? `${fmtBRL(vIss)} · ${fmtPct(pAliq)}` : (pAliq ? fmtPct(pAliq) : '—'), isRetido ? 'var(--color-danger-400)' : 'var(--color-neutral-200)')}
        ${buildStatCard('Retenção ISS', retIss, isRetido ? 'var(--color-danger-400)' : 'var(--color-success-400)')}
        ${buildStatCard('Emitente', TP_EMIT_MAP[g.tpEmit] || safe(g.tpEmit))}
        ${buildStatCard('Município', formatMunicipioDisplaySync(g.cLocEmi, g.xLocEmi, g.uf) || safe(g.cLocEmi) || '—')}
      </div>`;

    // ── Abas ──
    const tabs = ['Geral', 'Partes', 'Serviço', 'Valores', 'Tributos', 'Outros'];
    const hasTabs = true;
    const tabsHtml = `
      <div id="det-tabs" style="display:flex;gap:2px;padding:12px 24px 0;border-bottom:1px solid var(--surface-glass-border);overflow-x:auto;">
        ${tabs.map((t, i) => `
          <button class="det-tab-btn" data-tab="${i}"
            style="padding:7px 14px;border:none;background:${i===0?'var(--color-primary-500)':'transparent'};
                   color:${i===0?'#fff':'var(--color-neutral-400)'};border-radius:var(--radius-md) var(--radius-md) 0 0;
                   cursor:pointer;font-size:0.8rem;font-weight:600;white-space:nowrap;transition:all .15s;">
            ${t}
          </button>`).join('')}
      </div>`;

    // ── Conteúdo por aba ──

    // Aba 0 — Geral
    const tabGeral = `
      ${buildSection('📋', 'Identificação', buildGrid2([
        buildDetailRow('NSU', String(n.nsu)),
        buildDetailRow('Série / Nº DPS', `${safe(g.serie)} / ${safe(g.nDPS)}`),
        buildDetailRow('Data Emissão', fmtData(g.dhEmi)),
        buildDetailRow('Competência', safe(g.dCompet)),
        buildDetailRow('Finalidade', g.finNFSe === '0' ? 'Regular' : safe(g.finNFSe)),
        buildDetailRow('Versão Aplicação', safe(g.verAplic)),
        buildDetailRow('Tipo Emissão', TP_EMIT_MAP[g.tpEmit] || safe(g.tpEmit)),
        buildDetailRow('Importado em', fmtData(n._importadoEm)),
      ]))}
      ${g.xInfComp ? buildSection('💬', 'Informação Complementar', `<div style="padding:10px 12px;background:var(--surface-glass);border-radius:var(--radius-md);font-size:0.83rem;line-height:1.6;">${g.xInfComp}</div>`) : ''}
      ${g.chSubstda ? buildSection('🔄', 'Substituição', buildGrid2([
        buildDetailRow('Chave Substituída', g.chSubstda),
        buildDetailRow('Motivo', `${safe(g.xMotivo)} (${safe(g.cMotivo)})`),
      ])) : ''}
      ${g.xPed || g.idDocTec || g.docRef ? buildSection('🔗', 'Referências', buildGrid2([
        buildDetailRow('Pedido / OS', safe(g.xPed)),
        buildDetailRow('Doc. Técnico', safe(g.idDocTec)),
        buildDetailRow('Doc. Referência', safe(g.docRef)),
      ])) : ''}`;

    // Aba 1 — Partes
    const tabPartes = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        ${buildPersonCard('Prestador', n.prestador, 'var(--color-primary-400)')}
        ${buildPersonCard('Tomador', n.tomador, 'var(--color-accent-400)')}
      </div>
      ${n.intermediario?.xNome || n.intermediario?.CNPJ ? buildPersonCard('Intermediário', n.intermediario, 'var(--color-warning-400)') : ''}
      ${n.destinatario?.xNome || n.destinatario?.CNPJ ? buildPersonCard('Destinatário', n.destinatario, 'var(--color-neutral-400)') : ''}`;

    // Aba 2 — Serviço
    const localPrest = (s.cPaisPrestacao && String(s.cPaisPrestacao).toUpperCase() !== 'BR')
      ? (formatEstrangeiroDisplay(s.cPaisPrestacao) || `Exterior — País: ${s.cPaisPrestacao}`)
      : formatMunicipioDisplaySync(s.cLocPrestacao, s.xLocPrestacao, s.uf) || safe(s.cLocPrestacao);
    const tabServico = `
      ${buildSection('🏷️', 'Classificação', buildGrid2([
        buildDetailRow('Código Tributação Nacional', safe(s.cTribNac || s.cServ?.cTribNac)),
        buildDetailRow('Código Tributação Municipal', safe(s.cTribMun || s.cServ?.cTribMun)),
        buildDetailRow('Código NBS', safe(s.cNBS)),
        buildDetailRow('Código Interno Contribuinte', safe(s.cIntContrib)),
      ]))}
      ${buildSection('📍', 'Prestação', buildGrid2([
        buildDetailRow('Local de Prestação', localPrest),
        buildDetailRow('País de Prestação', safe(s.cPaisPrestacao)),
        buildDetailRow('Modo de Prestação', MD_PREST_MAP[s.mdPrestacao] || safe(s.mdPrestacao)),
        buildDetailRow('Vínculo com Prestação', safe(s.vincPrest)),
        buildDetailRow('Moeda', safe(s.tpMoeda)),
        buildDetailRow('Valor em Moeda Estrangeira', s.vServMoeda ? fmtBRL(s.vServMoeda) : ''),
      ]))}
      ${s.xDescServ ? buildSection('📝', 'Descrição do Serviço', `<div style="padding:12px;background:var(--surface-glass);border-radius:var(--radius-md);font-size:0.85rem;line-height:1.65;">${s.xDescServ}</div>`) : ''}`;

    // Aba 3 — Valores
    const tabValores = `
      ${buildSection('💰', 'Composição dos Valores', buildGrid2([
        buildDetailRow('Valor dos Serviços', fmtBRL(v.vServ), 'var(--color-primary-400)'),
        buildDetailRow('Desconto Incondicionado', v.vDescIncond ? fmtBRL(v.vDescIncond) : ''),
        buildDetailRow('Desconto Condicionado', v.vDescCond ? fmtBRL(v.vDescCond) : ''),
        buildDetailRow('Valor Líquido', v.vLiq ? fmtBRL(v.vLiq) : '', 'var(--color-success-400)'),
        buildDetailRow('Recebido pelo Intermediário', v.vReceb ? fmtBRL(v.vReceb) : ''),
      ]))}
      ${(dr.pDR || dr.vDR) ? buildSection('➖', 'Dedução / Redução', buildGrid2([
        buildDetailRow('Percentual DR', dr.pDR ? fmtPct(dr.pDR/100) : ''),
        buildDetailRow('Valor DR', dr.vDR ? fmtBRL(dr.vDR) : ''),
        buildDetailRow('Documentos', String((dr.documentos||[]).length)),
      ])) : ''}`;

    // Aba 4 — Tributos
    const hasFed  = tf.CST || tf.vBCPisCofins || tf.pAliqPis || tf.vRetCP || tf.vRetIRRF || tf.vRetCSLL;
    const hasTot  = tt.vTotTribFed || tt.vTotTribEst || tt.vTotTribMun;
    const hasIbsCbs = ib.CST || ib.cClassTrib || ib.pDifUF || ib.pDifMun || ib.pDifCBS;
    const pAliqIBS = ib.pAliqIBS || ib.pDifMun || '0,1';
    const pAliqCBS = ib.pAliqCBS || ib.pDifCBS || '0,9';
    const tabTributos = `
      <!-- Banner IBS/CBS Reforma Tributária -->
      ${hasIbsCbs ? `
        <div style="margin:0 0 16px;padding:12px 16px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);border-radius:var(--radius-md);font-size:0.8rem;">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="font-size:1rem;">⚖️</span>
            <strong style="color:rgba(99,102,241,0.9);">IBS / CBS — Reforma Tributária</strong>
            <span style="padding:2px 8px;border-radius:20px;font-size:0.68rem;background:rgba(99,102,241,0.15);color:rgba(99,102,241,0.9);font-weight:700;">INFORMATIVO 2026</span>
            <span style="color:var(--color-neutral-400);font-size:0.75rem;">Valores simbólicos em 2026 — impacto efetivo inicia em 2027 (LC 214/2025)</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:12px;">
            <div style="padding:10px;background:var(--surface-glass);border-radius:var(--radius-md);">
              <div style="font-size:0.65rem;color:var(--color-neutral-500);margin-bottom:2px;">CST IBS/CBS</div>
              <div style="font-weight:700;color:rgba(99,102,241,0.9);">${ib.CST || '—'}</div>
            </div>
            <div style="padding:10px;background:var(--surface-glass);border-radius:var(--radius-md);">
              <div style="font-size:0.65rem;color:var(--color-neutral-500);margin-bottom:2px;">Class. Tributária (cClassTrib)</div>
              <div style="font-weight:700;color:rgba(99,102,241,0.9);">${ib.cClassTrib || '—'}</div>
            </div>
            <div style="padding:10px;background:var(--surface-glass);border-radius:var(--radius-md);">
              <div style="font-size:0.65rem;color:var(--color-neutral-500);margin-bottom:2px;">Alíquota IBS Municipal</div>
              <div style="font-weight:700;color:rgba(99,102,241,0.9);">${pAliqIBS}%</div>
            </div>
            <div style="padding:10px;background:var(--surface-glass);border-radius:var(--radius-md);">
              <div style="font-size:0.65rem;color:var(--color-neutral-500);margin-bottom:2px;">Alíquota CBS Federal</div>
              <div style="font-weight:700;color:rgba(99,102,241,0.9);">${pAliqCBS}%</div>
            </div>
            <div style="padding:10px;background:var(--surface-glass);border-radius:var(--radius-md);">
              <div style="font-size:0.65rem;color:var(--color-neutral-500);margin-bottom:2px;">NBS (cNBS)</div>
              <div style="font-weight:700;color:rgba(99,102,241,0.9);">${ib.cNBS || n.servico?.cNBS || '—'}</div>
            </div>
          </div>
        </div>` :
        `<div style="margin:0 0 16px;padding:10px 16px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.25);border-radius:var(--radius-md);font-size:0.78rem;color:rgba(245,158,11,0.85);">
          ⚠️ <strong>Campos IBS/CBS ausentes</strong> — Esta NFS-e não contém os grupos IBSCBS exigidos pela NT 004 v2.0. Verificar conformidade (LC 214/2025).
        </div>`
      }
      ${buildSection('🏛️', 'ISSQN', buildGrid2([
        buildDetailRow('Tributação', TRIB_ISSQN_MAP[ti.tribISSQN] || safe(ti.tribISSQN)),
        buildDetailRow('Alíquota ISS', ti.pAliq ? fmtPct(ti.pAliq) : ''),
        buildDetailRow('ISS Apurado', ti.vISS ? fmtBRL(ti.vISS) : ''),
        buildDetailRow('Retenção ISS', retIss, isRetido ? 'var(--color-danger-400)' : 'var(--color-success-400)'),
        buildDetailRow('BC ISS', ti.vBC ? fmtBRL(ti.vBC) : ''),
        buildDetailRow('Imunidade', safe(ti.tpImunidade)),
        buildDetailRow('Exigibilidade Suspensa', safe(ti.tpSusp)),
        buildDetailRow('Nº Processo', safe(ti.nProcesso)),
        buildDetailRow('Benefício Municipal', safe(ti.nBM)),
        buildDetailRow('Redução BC (BM) R$', ti.vRedBCBM ? fmtBRL(ti.vRedBCBM) : ''),
        buildDetailRow('Redução BC (BM) %', ti.pRedBCBM ? fmtPct(ti.pRedBCBM/100) : ''),
        buildDetailRow('País Resultado', safe(ti.cPaisResult)),
      ]))}
      ${hasFed ? buildSection('🇧🇷', 'Tributos Federais', buildGrid2([
        buildDetailRow('CST PIS/COFINS', safe(tf.CST)),
        buildDetailRow('BC PIS/COFINS', tf.vBCPisCofins ? fmtBRL(tf.vBCPisCofins) : ''),
        buildDetailRow('Alíquota PIS', tf.pAliqPis ? `${tf.pAliqPis}%` : ''),
        buildDetailRow('Alíquota COFINS', tf.pAliqCofins ? `${tf.pAliqCofins}%` : ''),
        buildDetailRow('PIS apurado', tf.vPis ? fmtBRL(tf.vPis) : ''),
        buildDetailRow('COFINS apurada', tf.vCofins ? fmtBRL(tf.vCofins) : ''),
        buildDetailRow('Tipo Ret. PIS/COFINS', safe(tf.tpRetPisCofins)),
        buildDetailRow('Ret. Contrib. Previdenciária', tf.vRetCP ? fmtBRL(tf.vRetCP) : '', 'var(--color-danger-400)'),
        buildDetailRow('Ret. IRRF', tf.vRetIRRF ? fmtBRL(tf.vRetIRRF) : '', 'var(--color-danger-400)'),
        buildDetailRow('Ret. CSLL+PIS+COFINS', tf.vRetCSLL ? fmtBRL(tf.vRetCSLL) : '', 'var(--color-danger-400)'),
        buildDetailRow('INSS', tf.vINSS ? fmtBRL(tf.vINSS) : ''),
        buildDetailRow('IR', tf.vIR ? fmtBRL(tf.vIR) : ''),
      ])) : ''}
      ${hasTot ? buildSection('📊', 'Total Aproximado de Tributos', `
        ${buildGrid3([
          buildStatCard('Federal', tt.vTotTribFed ? `${fmtBRL(tt.vTotTribFed)}${tt.pTotTribFed ? ' · '+tt.pTotTribFed+'%' : ''}` : '—'),
          buildStatCard('Estadual', tt.vTotTribEst ? `${fmtBRL(tt.vTotTribEst)}${tt.pTotTribEst ? ' · '+tt.pTotTribEst+'%' : ''}` : '—'),
          buildStatCard('Municipal', tt.vTotTribMun ? `${fmtBRL(tt.vTotTribMun)}${tt.pTotTribMun ? ' · '+tt.pTotTribMun+'%' : ''}` : '—'),
        ])}
        ${tt.pTotTribSN ? `<div style="font-size:0.8rem;margin-top:8px;color:var(--color-neutral-400);">Simples Nacional: <strong>${tt.pTotTribSN}%</strong></div>` : ''}
      `) : ''}`;

    // Aba 5 — Outros
    const hasIbs    = ib.CST || ib.cClassTrib || ib.pDifUF || ib.pDifMun || ib.pDifCBS;
    const hasComExt = ce.mecAFComexP || ce.mecAFComexT || ce.nDI || ce.nRE;
    const hasObra   = ob.inscImobFisc || ob.cObra;
    const hasEvt    = ev.xNome || ev.idAtvEvt;
    const hasImov   = im.inscImobFisc || im.cCIB;
    const docsRef   = n.documentosReferenciados || [];

    const tabOutros = `
      ${hasIbs ? buildSection('⚖️', 'IBS / CBS (Reforma Tributária)', buildGrid2([
        buildDetailRow('CST IBS/CBS', safe(ib.CST)),
        buildDetailRow('Classificação Tributária', safe(ib.cClassTrib)),
        buildDetailRow('Crédito Presumido', safe(ib.cCredPres)),
        buildDetailRow('CST Regular', safe(ib.CSTReg)),
        buildDetailRow('Class. Trib. Regular', safe(ib.cClassTribReg)),
        buildDetailRow('Diferimento IBS UF', ib.pDifUF ? `${ib.pDifUF}%` : ''),
        buildDetailRow('Diferimento IBS Mun', ib.pDifMun ? `${ib.pDifMun}%` : ''),
        buildDetailRow('Diferimento CBS', ib.pDifCBS ? `${ib.pDifCBS}%` : ''),
        buildDetailRow('Consumidor Final', ib.indFinal === '1' ? 'Sim' : ib.indFinal === '0' ? 'Não' : ''),
        buildDetailRow('Indicador Operação', safe(ib.cIndOp)),
        buildDetailRow('ZFM / ALC', ib.indZFMALC === '1' ? 'Sim' : ''),
        buildDetailRow('Tipo Operação Governamental', safe(ib.tpOper)),
        buildDetailRow('Tipo Ente Governamental', safe(ib.tpEnteGov)),
      ])) : ''}
      ${hasComExt ? buildSection('🌐', 'Comércio Exterior', buildGrid2([
        buildDetailRow('Mecanismo AF Prestador', safe(ce.mecAFComexP)),
        buildDetailRow('Mecanismo AF Tomador', safe(ce.mecAFComexT)),
        buildDetailRow('Movimentação Temp. Bens', safe(ce.movTempBens)),
        buildDetailRow('Nº Declaração Importação', safe(ce.nDI)),
        buildDetailRow('Nº Registro Exportação', safe(ce.nRE)),
        buildDetailRow('MDIC', ce.mdic === '1' ? 'Sim' : ''),
      ])) : ''}
      ${hasObra ? buildSection('🏗️', 'Construção Civil / Obra', buildGrid2([
        buildDetailRow('Inscrição Imobiliária Fiscal', safe(ob.inscImobFisc)),
        buildDetailRow('Código Obra (CNO/CEI)', safe(ob.cObra)),
        buildDetailRow('Endereço da Obra', buildEnderecoHtml(ob.endereco)),
      ])) : ''}
      ${hasEvt ? buildSection('🎪', 'Evento / Atividade', buildGrid2([
        buildDetailRow('Nome do Evento', safe(ev.xNome)),
        buildDetailRow('ID Atividade', safe(ev.idAtvEvt)),
        buildDetailRow('Período', `${fmtDataCurta(ev.dtIni)} a ${fmtDataCurta(ev.dtFim)}`),
      ])) : ''}
      ${hasImov ? buildSection('🏠', 'Imóvel', buildGrid2([
        buildDetailRow('Inscrição Imobiliária Fiscal', safe(im.inscImobFisc)),
        buildDetailRow('CIB', safe(im.cCIB)),
        buildDetailRow('Endereço', buildEnderecoHtml(im.endereco)),
      ])) : ''}
      ${docsRef.length > 0 ? buildSection('📎', `Documentos Referenciados (${docsRef.length})`, docsRef.map((d, i) => `
        <div style="padding:8px 10px;background:var(--surface-glass);border-radius:var(--radius-sm);margin-bottom:6px;font-size:0.81rem;display:flex;gap:8px;align-items:center;">
          <span style="color:var(--color-neutral-500);min-width:22px;">#${i+1}</span>
          <div>
            <div style="font-family:monospace;font-size:0.79rem;word-break:break-all;">${safe(d.chaveDFe)}</div>
            <div style="color:var(--color-neutral-400);">Tipo: ${safe(d.tipoChaveDFe)} ${d.vlrReeRepRes ? '· '+fmtBRL(d.vlrReeRepRes) : ''}</div>
          </div>
        </div>`).join('')) : ''}
      ${!hasIbs && !hasComExt && !hasObra && !hasEvt && !hasImov && !docsRef.length
        ? '<div style="color:var(--color-neutral-500);font-size:0.85rem;padding:20px 0;text-align:center;">Nenhum dado adicional para esta NFS-e.</div>' : ''}`;

    const tabContents = [tabGeral, tabPartes, tabServico, tabValores, tabTributos, tabOutros];

    document.getElementById('detalhes-conteudo').innerHTML = `
      ${alertBanner}
      ${header}
      ${summary}
      ${tabsHtml}
      <div id="det-tab-body" style="padding:20px 24px;min-height:200px;">
        ${tabContents[0]}
      </div>`;

    // Lógica de abas
    document.querySelectorAll('.det-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.tab, 10);
        document.querySelectorAll('.det-tab-btn').forEach(b => {
          b.style.background = 'transparent';
          b.style.color = 'var(--color-neutral-400)';
        });
        btn.style.background = 'var(--color-primary-500)';
        btn.style.color = '#fff';
        document.getElementById('det-tab-body').innerHTML = tabContents[idx];
      });
    });

    const modal = document.getElementById('modal-detalhes');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.scrollTop = 0;
  }

  document.getElementById('fechar-modal-det').addEventListener('click', () => {
    const modal = document.getElementById('modal-detalhes');
    modal.classList.add('hidden');
    modal.style.display = 'none';
  });

  loadNotas();

  function runSearch() {
    const termo = document.getElementById('filtro-pesquisa')?.value.toLowerCase().trim();
    if (!termo) { renderNotasTable(localNotasData); return; }
    const filtered = localNotasData.filter(n => {
      const chave = (n.chaveAcesso || '').toLowerCase();
      const pCnpj = (n.prestador?.CNPJ || n.prestador?.cnpj || '').toLowerCase();
      const pNome = (n.prestador?.xNome || n.prestador?.nome || '').toLowerCase();
      const tCnpj = (n.tomador?.CNPJ || n.tomador?.cnpj || '').toLowerCase();
      const tNome = (n.tomador?.xNome || n.tomador?.nome || '').toLowerCase();
      const desc = (n.servico?.xDescServ || '').toLowerCase();
      return chave.includes(termo) || pCnpj.includes(termo) || pNome.includes(termo) ||
             tCnpj.includes(termo) || tNome.includes(termo) || desc.includes(termo);
    });
    renderNotasTable(filtered);
    toast.info(`${filtered.length} nota(s) encontrada(s).`);
  }

  document.getElementById('btn-buscar')?.addEventListener('click', runSearch);

  document.getElementById('filtro-pesquisa')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSearch();
  });

  document.getElementById('sel-por-pagina')?.addEventListener('change', (e) => {
    porPagina = parseInt(e.target.value, 10);
    currentPage = 1;
    renderPage();
  });

  document.getElementById('btn-pag-prev')?.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderPage(); }
  });

  document.getElementById('btn-pag-next')?.addEventListener('click', () => {
    const totalPages = porPagina === 0 ? 1 : Math.ceil(filteredData.length / porPagina);
    if (currentPage < totalPages) { currentPage++; renderPage(); }
  });
}
