/**
 * NFS-e Freire — Regime Tributário dos Contribuintes (Módulo Município)
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

const REGIME_LABELS = {
  normal: 'Normal',
  simples: 'Simples Nacional',
  mei: 'MEI',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
};

export function renderRegimeTributario(container) {
  if (!isMunAuthorized([MUN_ROLES.GESTOR])) {
    container.innerHTML = `<div class="empty-state"><div class="icon">🔒</div><p>Acesso restrito ao Gestor Municipal.</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">Regime Tributário dos Contribuintes</h1>
        <p class="page-description">Configure o enquadramento fiscal de cada contribuinte cadastrado no município.</p>
      </div>
      <button class="btn btn-secondary" onclick="window.location.hash='/gestao-acessos'">
        ← Gestão de Acessos
      </button>
    </div>

    <!-- Formulário de cadastro / edição -->
    <div class="card animate-slide-up mb-6">
      <div class="card-header">
        <h3 class="card-title">Cadastrar / Atualizar Regime</h3>
      </div>
      <div class="card-body">
        <p class="form-help" style="margin-bottom:var(--space-4);">
          Contribuintes marcados como <strong>"Isento de Guia"</strong> não receberão guias de pagamento ISSQN
          geradas automaticamente pelo sistema.
        </p>
        <div class="grid grid-3 gap-4 mb-4">
          <div class="form-group">
            <label class="form-label">CNPJ do Contribuinte <span class="text-danger">*</span></label>
            <input type="text" class="form-input form-input-mono" id="reg-cnpj"
              placeholder="00.000.000/0000-00" maxlength="18" autocomplete="off">
          </div>
          <div class="form-group">
            <label class="form-label">Regime Tributário</label>
            <select class="form-select" id="reg-regime">
              <option value="normal">Normal</option>
              <option value="simples">Simples Nacional</option>
              <option value="mei">MEI</option>
              <option value="lucro_presumido">Lucro Presumido</option>
              <option value="lucro_real">Lucro Real</option>
            </select>
          </div>
          <div class="form-group" style="display:flex;align-items:flex-end;gap:16px;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding-bottom:2px;">
              <input type="checkbox" id="reg-isento-guia" style="width:16px;height:16px;">
              <span style="font-size:var(--text-sm);">Isento de Guia</span>
            </label>
            <button class="btn btn-primary" id="btn-reg-salvar" style="white-space:nowrap;">
              💾 Salvar Regime
            </button>
            <button class="btn btn-ghost" id="btn-reg-limpar" title="Limpar formulário">✕ Limpar</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabela de regimes cadastrados -->
    <div class="card animate-slide-up">
      <div class="card-header" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <input type="text" class="form-input" id="reg-filtro"
          placeholder="Buscar por CNPJ ou regime..."
          style="flex:1;min-width:180px;max-width:320px;">
        <button class="btn btn-secondary btn-sm" id="btn-reg-buscar">🔍 Buscar</button>
        <div style="display:flex;align-items:center;gap:6px;margin-left:auto;">
          <label style="font-size:0.82rem;color:var(--color-neutral-400);white-space:nowrap;">Exibir:</label>
          <select class="form-select" id="reg-por-pagina" style="width:76px;padding:4px 8px;">
            <option value="10">10</option>
            <option value="25" selected>25</option>
            <option value="50">50</option>
            <option value="0">Todos</option>
          </select>
          <span id="reg-total-label" style="font-size:0.82rem;color:var(--color-neutral-500);white-space:nowrap;"></span>
          <button class="btn btn-ghost btn-sm" id="btn-regime-reload" title="Recarregar lista">🔄</button>
        </div>
      </div>

      <div class="table-container" style="overflow-x:auto;">
        <table class="data-table" id="reg-tabela-completa">
          <thead>
            <tr>
              <th>CNPJ</th>
              <th>Regime</th>
              <th style="width:130px;text-align:center;">Isento de Guia</th>
              <th style="width:130px;">Atualizado em</th>
              <th style="width:50px;text-align:center;"></th>
            </tr>
          </thead>
          <tbody id="reg-tabela">
            <tr><td colspan="5" style="text-align:center;padding:24px;">Carregando...</td></tr>
          </tbody>
        </table>
      </div>

      <div id="reg-pag-bar" style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-top:1px solid var(--surface-glass-border);flex-wrap:wrap;gap:8px;">
        <span id="reg-pag-info" style="font-size:0.82rem;color:var(--color-neutral-400);"></span>
        <div style="display:flex;align-items:center;gap:4px;">
          <button class="btn btn-ghost btn-sm" id="reg-pag-prev" style="padding:3px 10px;">‹</button>
          <span id="reg-pag-nums" style="display:flex;gap:3px;"></span>
          <button class="btn btn-ghost btn-sm" id="reg-pag-next" style="padding:3px 10px;">›</button>
        </div>
      </div>
    </div>
  `;

  let allRegimes = [];
  let filteredRegimes = [];
  let currentPage = 1;
  let porPagina = 25;

  // ─── Máscara CNPJ ──────────────────────────────────
  document.getElementById('reg-cnpj')?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 14) v = v.substring(0, 14);
    e.target.value = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  });

  // ─── Paginação ─────────────────────────────────────
  function renderPage() {
    const tbody = document.getElementById('reg-tabela');
    if (!tbody) return;
    tbody.innerHTML = '';

    const total = filteredRegimes.length;
    const start = (currentPage - 1) * porPagina;
    const end = porPagina === 0 ? total : Math.min(start + porPagina, total);
    const pageData = porPagina === 0 ? filteredRegimes : filteredRegimes.slice(start, end);

    const totalLabel = document.getElementById('reg-total-label');
    if (totalLabel) totalLabel.textContent = `${total} registro(s)`;

    if (total === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;">Nenhum regime encontrado.</td></tr>';
      updatePaginacao(0, 0, 0);
      return;
    }

    pageData.forEach((r) => {
      const tr = document.createElement('tr');
      const regimeLabel = REGIME_LABELS[r.regime] || r.regime;
      const regimeBadge = r.regime === 'simples'
        ? `<span class="badge badge-success" style="font-size:0.72rem;">${regimeLabel}</span>`
        : r.regime === 'mei'
        ? `<span class="badge badge-primary" style="font-size:0.72rem;">${regimeLabel}</span>`
        : `<span style="font-size:0.85rem;">${regimeLabel}</span>`;

      tr.innerHTML = `
        <td class="text-mono" style="font-weight:500;">${fmtCNPJ(r.cnpj)}</td>
        <td>${regimeBadge}</td>
        <td style="text-align:center;">${r.isento_guia
          ? '<span class="badge badge-warning" style="font-size:0.72rem;">✓ Isento</span>'
          : '<span style="color:var(--color-neutral-500);font-size:0.82rem;">—</span>'
        }</td>
        <td style="font-size:0.82rem;color:var(--color-neutral-400);">${r.atualizado_em ? new Date(r.atualizado_em).toLocaleDateString('pt-BR') : '—'}</td>
        <td style="text-align:center;">
          <button class="btn btn-ghost btn-sm btn-reg-edit" data-cnpj="${r.cnpj}" data-regime="${r.regime}" data-isento="${r.isento_guia ? '1' : '0'}"
            title="Editar regime" style="font-size:0.9rem;padding:3px 7px;">✏️</button>
          <button class="btn btn-ghost btn-sm btn-reg-del" data-cnpj="${r.cnpj}"
            title="Remover regime" style="color:var(--color-danger-400);font-size:0.9rem;padding:3px 7px;">🗑</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Eventos de editar / excluir
    tbody.querySelectorAll('.btn-reg-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const cnpjInput = document.getElementById('reg-cnpj');
        const regimeSelect = document.getElementById('reg-regime');
        const isentoCheck = document.getElementById('reg-isento-guia');
        if (cnpjInput) cnpjInput.value = fmtCNPJ(btn.dataset.cnpj);
        if (regimeSelect) regimeSelect.value = btn.dataset.regime;
        if (isentoCheck) isentoCheck.checked = btn.dataset.isento === '1';
        cnpjInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        cnpjInput?.focus();
      });
    });

    tbody.querySelectorAll('.btn-reg-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cnpj = btn.dataset.cnpj;
        if (!confirm(`Remover regime para CNPJ ${fmtCNPJ(cnpj)}?`)) return;
        try {
          const res = await fetch(`${getBackendUrl()}/municipio/contribuinte-regime/${cnpj}`, {
            method: 'DELETE',
            headers: authH()
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          toast.success('Regime removido.');
          await loadRegimes();
        } catch (e) { toast.error('Falha ao remover regime.'); }
      });
    });

    updatePaginacao(total, porPagina === 0 ? 1 : start + 1, end);
  }

  function updatePaginacao(total, from, to) {
    const info = document.getElementById('reg-pag-info');
    const numsEl = document.getElementById('reg-pag-nums');
    const prevBtn = document.getElementById('reg-pag-prev');
    const nextBtn = document.getElementById('reg-pag-next');
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
  async function loadRegimes() {
    const tbody = document.getElementById('reg-tabela');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">Carregando...</td></tr>';
    try {
      const res = await fetch(`${getBackendUrl()}/municipio/contribuinte-regime`, {
        headers: authH()
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      allRegimes = data.regimes || [];
      applyFilter();
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-danger-400);padding:20px;">Erro ao carregar: ${e.message}</td></tr>`;
    }
  }

  function applyFilter() {
    const termo = document.getElementById('reg-filtro')?.value.toLowerCase().trim() || '';
    if (!termo) {
      filteredRegimes = [...allRegimes];
    } else {
      filteredRegimes = allRegimes.filter(r =>
        r.cnpj.toLowerCase().includes(termo) ||
        (REGIME_LABELS[r.regime] || r.regime).toLowerCase().includes(termo) ||
        r.regime.toLowerCase().includes(termo)
      );
    }
    currentPage = 1;
    renderPage();
  }

  // ─── Salvar regime ─────────────────────────────────
  document.getElementById('btn-reg-salvar')?.addEventListener('click', async () => {
    const cnpj = document.getElementById('reg-cnpj')?.value?.replace(/\D/g, '') || '';
    const regime = document.getElementById('reg-regime')?.value || 'normal';
    const isentoGuia = document.getElementById('reg-isento-guia')?.checked || false;
    if (cnpj.length !== 14) { toast.warning('Informe um CNPJ válido (14 dígitos).'); return; }
    try {
      const res = await fetch(`${getBackendUrl()}/municipio/contribuinte-regime/${cnpj}`, {
        method: 'PUT',
        headers: authH({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ regime, isento_guia: isentoGuia })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Regime salvo com sucesso!');
      document.getElementById('reg-cnpj').value = '';
      document.getElementById('reg-isento-guia').checked = false;
      document.getElementById('reg-regime').value = 'normal';
      await loadRegimes();
    } catch (e) { toast.error(e.message || 'Falha ao salvar regime.'); }
  });

  document.getElementById('btn-reg-limpar')?.addEventListener('click', () => {
    document.getElementById('reg-cnpj').value = '';
    document.getElementById('reg-regime').value = 'normal';
    document.getElementById('reg-isento-guia').checked = false;
  });

  // ─── Busca e paginação ─────────────────────────────
  document.getElementById('btn-reg-buscar')?.addEventListener('click', applyFilter);
  document.getElementById('reg-filtro')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyFilter();
  });

  document.getElementById('reg-por-pagina')?.addEventListener('change', (e) => {
    porPagina = parseInt(e.target.value, 10);
    currentPage = 1;
    renderPage();
  });

  document.getElementById('reg-pag-prev')?.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderPage(); }
  });

  document.getElementById('reg-pag-next')?.addEventListener('click', () => {
    const totalPages = porPagina === 0 ? 1 : Math.ceil(filteredRegimes.length / porPagina);
    if (currentPage < totalPages) { currentPage++; renderPage(); }
  });

  document.getElementById('btn-regime-reload')?.addEventListener('click', loadRegimes);

  loadRegimes();
}
