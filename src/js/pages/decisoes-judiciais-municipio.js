/**
 * NFS-e Freire — Decisões Judiciais / Administrativas (Módulo Município)
 * Página dedicada com busca, paginação e CRUD completo.
 */
import { MUN_ROLES, isMunAuthorized } from '../auth-municipio.js';
import { toast } from '../toast.js';
import { getBackendUrl } from '../api-service.js';

function getMunToken() {
  try { const s = localStorage.getItem('nfse_session'); return s ? (JSON.parse(s).token || '') : ''; } catch { return ''; }
}
function authH(extra = {}) {
  return { 'Authorization': `Bearer ${getMunToken()}`, ...extra };
}

const fmtCNPJ = (v) => {
  const d = (v || '').replace(/\D/g, '');
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : (v || '—');
};

const fmtDateTime = (v) => {
  if (!v) return '—';
  try { return new Date(v).toLocaleString('pt-BR'); } catch { return v; }
};

const TIPO_LABELS = {
  judicial: 'Judicial',
  administrativo: 'Administrativo',
};

export function renderDecisoesJudiciais(container) {
  if (!isMunAuthorized([MUN_ROLES.GESTOR])) {
    container.innerHTML = `<div class="empty-state"><div class="icon">🔒</div><p>Acesso restrito ao Gestor Municipal.</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">Decisões Judiciais / Administrativas</h1>
        <p class="page-description">Gerencie as autorizações de emissão NFS-e por fluxo bypass (cStat=102).</p>
      </div>
      <button class="btn btn-secondary" onclick="window.location.hash='/gestao-acessos'">
        ← Gestão de Acessos
      </button>
    </div>

    <!-- Informativo -->
    <div class="card animate-slide-up mb-6" style="border-left:3px solid var(--color-warning-400);">
      <div class="card-body" style="padding:14px 18px;display:flex;gap:14px;align-items:flex-start;">
        <span style="font-size:1.4rem;flex-shrink:0;">⚖️</span>
        <div>
          <strong style="display:block;margin-bottom:4px;">Fluxo Bypass (cStat=102)</strong>
          <p class="form-help" style="margin:0;">
            Cadastre aqui as decisões que autorizam contribuintes a emitir NFS-e sem validação prévia da Sefin Nacional.
            O contribuinte <strong>deve solicitar</strong> ao município antes de emitir.
            Ao final do mês, as notas emitidas por este fluxo exigem <strong>homologação manual</strong>.
          </p>
        </div>
      </div>
    </div>

    <!-- Formulário de cadastro -->
    <div class="card animate-slide-up mb-6">
      <div class="card-header">
        <h3 class="card-title">Cadastrar Nova Decisão</h3>
      </div>
      <div class="card-body">
        <div class="grid grid-3 gap-4 mb-4">
          <div class="form-group">
            <label class="form-label">CNPJ do Contribuinte <span class="text-danger">*</span></label>
            <input type="text" class="form-input form-input-mono" id="dec-cnpj"
              placeholder="00.000.000/0000-00" maxlength="18" autocomplete="off">
          </div>
          <div class="form-group">
            <label class="form-label">Número do Processo <span class="text-danger">*</span></label>
            <input type="text" class="form-input" id="dec-processo"
              placeholder="Ex: 1234567-89.2026.8.26.0000">
          </div>
          <div class="form-group">
            <label class="form-label">Tipo</label>
            <select class="form-select" id="dec-tipo">
              <option value="judicial">Judicial</option>
              <option value="administrativo">Administrativo</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-ghost" id="btn-dec-limpar">✕ Limpar</button>
          <button class="btn btn-primary" id="btn-dec-cadastrar">⚖️ Cadastrar Decisão</button>
        </div>
      </div>
    </div>

    <!-- Tabela de decisões -->
    <div class="card animate-slide-up">
      <div class="card-header" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <input type="text" class="form-input" id="dec-filtro"
          placeholder="Buscar por CNPJ ou nº processo..."
          style="flex:1;min-width:180px;max-width:340px;">
        <select class="form-select" id="dec-filtro-tipo" style="width:160px;">
          <option value="">Todos os tipos</option>
          <option value="judicial">Judicial</option>
          <option value="administrativo">Administrativo</option>
        </select>
        <select class="form-select" id="dec-filtro-ativo" style="width:130px;">
          <option value="">Todos</option>
          <option value="true">Ativos</option>
          <option value="false">Revogados</option>
        </select>
        <button class="btn btn-secondary btn-sm" id="btn-dec-buscar">🔍 Buscar</button>
        <div style="display:flex;align-items:center;gap:6px;margin-left:auto;">
          <label style="font-size:0.82rem;color:var(--color-neutral-400);white-space:nowrap;">Exibir:</label>
          <select class="form-select" id="dec-por-pagina" style="width:76px;padding:4px 8px;">
            <option value="10">10</option>
            <option value="25" selected>25</option>
            <option value="50">50</option>
            <option value="0">Todos</option>
          </select>
          <span id="dec-total-label" style="font-size:0.82rem;color:var(--color-neutral-500);white-space:nowrap;"></span>
          <button class="btn btn-ghost btn-sm" id="btn-dec-reload" title="Recarregar lista">🔄</button>
        </div>
      </div>

      <div class="table-container" style="overflow-x:auto;">
        <table class="data-table" id="dec-tabela-completa">
          <thead>
            <tr>
              <th style="width:50px;">#</th>
              <th>CNPJ</th>
              <th>Número do Processo</th>
              <th style="width:130px;text-align:center;">Tipo</th>
              <th style="width:90px;text-align:center;">Status</th>
              <th style="width:150px;">Cadastrado em</th>
              <th style="width:60px;text-align:center;"></th>
            </tr>
          </thead>
          <tbody id="dec-tabela">
            <tr><td colspan="7" style="text-align:center;padding:24px;">Carregando...</td></tr>
          </tbody>
        </table>
      </div>

      <div id="dec-pag-bar" style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-top:1px solid var(--surface-glass-border);flex-wrap:wrap;gap:8px;">
        <span id="dec-pag-info" style="font-size:0.82rem;color:var(--color-neutral-400);"></span>
        <div style="display:flex;align-items:center;gap:4px;">
          <button class="btn btn-ghost btn-sm" id="dec-pag-prev" style="padding:3px 10px;">‹</button>
          <span id="dec-pag-nums" style="display:flex;gap:3px;"></span>
          <button class="btn btn-ghost btn-sm" id="dec-pag-next" style="padding:3px 10px;">›</button>
        </div>
      </div>
    </div>
  `;

  let allDecioes = [];
  let filteredDecioes = [];
  let currentPage = 1;
  let porPagina = 25;

  // ─── Máscara CNPJ ──────────────────────────────────
  document.getElementById('dec-cnpj')?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 14) v = v.substring(0, 14);
    e.target.value = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  });

  // ─── Paginação ─────────────────────────────────────
  function renderPage() {
    const tbody = document.getElementById('dec-tabela');
    if (!tbody) return;
    tbody.innerHTML = '';

    const total = filteredDecioes.length;
    const start = (currentPage - 1) * porPagina;
    const end = porPagina === 0 ? total : Math.min(start + porPagina, total);
    const pageData = porPagina === 0 ? filteredDecioes : filteredDecioes.slice(start, end);

    const totalLabel = document.getElementById('dec-total-label');
    if (totalLabel) totalLabel.textContent = `${total} registro(s)`;

    if (total === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;">Nenhuma decisão encontrada.</td></tr>';
      updatePaginacao(0, 0, 0);
      return;
    }

    pageData.forEach((d) => {
      const tr = document.createElement('tr');
      const tipoLabel = TIPO_LABELS[d.tipo] || d.tipo || '—';
      const tipoBadge = d.tipo === 'judicial'
        ? `<span class="badge badge-danger" style="font-size:0.72rem;">${tipoLabel}</span>`
        : `<span class="badge badge-warning" style="font-size:0.72rem;">${tipoLabel}</span>`;
      const statusBadge = d.ativo
        ? '<span class="badge badge-success" style="font-size:0.72rem;">Ativo</span>'
        : '<span class="badge" style="font-size:0.72rem;background:var(--surface-glass);color:var(--color-neutral-500);">Revogado</span>';

      tr.innerHTML = `
        <td style="font-size:0.8rem;color:var(--color-neutral-500);">${d.id}</td>
        <td class="text-mono" style="font-weight:500;">${fmtCNPJ(d.cnpjContribuinte)}</td>
        <td style="font-size:0.85rem;font-family:monospace;">${d.numeroProcesso || '—'}</td>
        <td style="text-align:center;">${tipoBadge}</td>
        <td style="text-align:center;">${statusBadge}</td>
        <td style="font-size:0.82rem;color:var(--color-neutral-400);">${fmtDateTime(d.criadoEm)}</td>
        <td style="text-align:center;">
          ${d.ativo
            ? `<button class="btn btn-ghost btn-sm btn-dec-revogar" data-id="${d.id}" data-cnpj="${d.cnpjContribuinte}"
                title="Revogar decisão" style="color:var(--color-danger-400);font-size:0.9rem;padding:3px 7px;">🚫</button>`
            : `<span style="font-size:0.75rem;color:var(--color-neutral-600);">—</span>`
          }
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-dec-revogar').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const cnpj = fmtCNPJ(btn.dataset.cnpj);
        if (!confirm(`Revogar a decisão #${id} para o CNPJ ${cnpj}?\nContribuinte não poderá mais usar o fluxo bypass.`)) return;
        try {
          const res = await fetch(`${getBackendUrl()}/municipio/decisao-judicial/${id}`, {
            method: 'DELETE',
            headers: authH()
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          toast.success('Decisão revogada com sucesso.');
          await loadDecioes();
        } catch (e) { toast.error('Falha ao revogar decisão.'); }
      });
    });

    updatePaginacao(total, porPagina === 0 ? 1 : start + 1, end);
  }

  function updatePaginacao(total, from, to) {
    const info = document.getElementById('dec-pag-info');
    const numsEl = document.getElementById('dec-pag-nums');
    const prevBtn = document.getElementById('dec-pag-prev');
    const nextBtn = document.getElementById('dec-pag-next');
    const totalPages = porPagina === 0 ? 1 : Math.ceil(total / porPagina);

    if (info) info.textContent = total > 0 ? `Exibindo ${from}–${to} de ${total}` : 'Nenhum registro';

    if (numsEl) {
      numsEl.innerHTML = '';
      if (totalPages > 1) {
        const rStart = Math.max(1, currentPage - 2);
        const rEnd = Math.min(totalPages, rStart + 4);
        for (let p = rStart; p <= rEnd; p++) {
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

  // ─── Carregar dados do backend ─────────────────────
  async function loadDecioes() {
    const tbody = document.getElementById('dec-tabela');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">Carregando...</td></tr>';
    try {
      const res = await fetch(`${getBackendUrl()}/municipio/decisao-judicial`, {
        headers: authH()
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      allDecioes = data.decisoes || [];
      applyFilter();
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--color-danger-400);padding:20px;">Erro ao carregar: ${e.message}</td></tr>`;
    }
  }

  function applyFilter() {
    const termo = document.getElementById('dec-filtro')?.value.toLowerCase().trim() || '';
    const tipoFiltro = document.getElementById('dec-filtro-tipo')?.value || '';
    const ativoFiltro = document.getElementById('dec-filtro-ativo')?.value || '';

    filteredDecioes = allDecioes.filter(d => {
      const matchTermo = !termo ||
        (d.cnpjContribuinte || '').includes(termo.replace(/\D/g, '')) ||
        (d.numeroProcesso || '').toLowerCase().includes(termo);
      const matchTipo = !tipoFiltro || d.tipo === tipoFiltro;
      const matchAtivo = !ativoFiltro || String(d.ativo) === ativoFiltro;
      return matchTermo && matchTipo && matchAtivo;
    });
    currentPage = 1;
    renderPage();
  }

  // ─── Cadastrar decisão ─────────────────────────────
  document.getElementById('btn-dec-cadastrar')?.addEventListener('click', async () => {
    const cnpj = document.getElementById('dec-cnpj')?.value?.replace(/\D/g, '') || '';
    const processo = document.getElementById('dec-processo')?.value?.trim() || '';
    const tipo = document.getElementById('dec-tipo')?.value || 'judicial';
    if (cnpj.length !== 14) { toast.warning('Informe um CNPJ válido (14 dígitos).'); return; }
    if (!processo) { toast.warning('Informe o número do processo.'); return; }
    try {
      const res = await fetch(`${getBackendUrl()}/municipio/decisao-judicial`, {
        method: 'POST',
        headers: authH({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ cnpjContribuinte: cnpj, numeroProcesso: processo, tipo })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      toast.success('Decisão cadastrada com sucesso.');
      document.getElementById('dec-cnpj').value = '';
      document.getElementById('dec-processo').value = '';
      document.getElementById('dec-tipo').value = 'judicial';
      await loadDecioes();
    } catch (e) { toast.error(e.message || 'Falha ao cadastrar decisão.'); }
  });

  document.getElementById('btn-dec-limpar')?.addEventListener('click', () => {
    document.getElementById('dec-cnpj').value = '';
    document.getElementById('dec-processo').value = '';
    document.getElementById('dec-tipo').value = 'judicial';
  });

  // ─── Filtros, busca e paginação ────────────────────
  document.getElementById('btn-dec-buscar')?.addEventListener('click', applyFilter);
  document.getElementById('dec-filtro')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyFilter();
  });
  document.getElementById('dec-filtro-tipo')?.addEventListener('change', applyFilter);
  document.getElementById('dec-filtro-ativo')?.addEventListener('change', applyFilter);

  document.getElementById('dec-por-pagina')?.addEventListener('change', (e) => {
    porPagina = parseInt(e.target.value, 10);
    currentPage = 1;
    renderPage();
  });

  document.getElementById('dec-pag-prev')?.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderPage(); }
  });

  document.getElementById('dec-pag-next')?.addEventListener('click', () => {
    const totalPages = porPagina === 0 ? 1 : Math.ceil(filteredDecioes.length / porPagina);
    if (currentPage < totalPages) { currentPage++; renderPage(); }
  });

  document.getElementById('btn-dec-reload')?.addEventListener('click', loadDecioes);

  loadDecioes();
}
