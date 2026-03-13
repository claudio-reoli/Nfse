/**
 * NFS-e Freire — Parâmetros Municipais
 */
import { toast } from '../toast.js';
import { buscarMunicipiosPorUF, formatMunicipioDisplaySync } from '../municipios-ibge.js';

export function renderParametros(container) {
  container.innerHTML = `
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
            <label class="form-label">UF</label>
            <input class="form-input" id="param-uf" type="text" maxlength="2" placeholder="SP" style="text-transform: uppercase;">
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">Município (IBGE)</label>
            <div class="municipio-select-wrapper">
              <input type="text" class="form-input municipio-display" id="param-codMun-display"
                placeholder="Selecione UF e busque por nome..." list="param-codMun-list" autocomplete="off">
              <input type="hidden" id="param-codMun">
              <datalist id="param-codMun-list"></datalist>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Código do Serviço</label>
            <input class="form-input form-input-mono" id="param-codServ" type="text" placeholder="1.05">
          </div>
          <div class="form-group" style="align-self: flex-end;">
            <button class="btn btn-primary" id="btn-param-consultar">
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

  const ufEl = document.getElementById('param-uf');
  const displayEl = document.getElementById('param-codMun-display');
  const hiddenEl = document.getElementById('param-codMun');
  const datalistEl = document.getElementById('param-codMun-list');

  const loadMunOptions = async () => {
    const uf = ufEl?.value?.trim().toUpperCase();
    if (!uf || uf.length !== 2 || !datalistEl) return;
    try {
      const lista = await buscarMunicipiosPorUF(uf);
      datalistEl.innerHTML = lista.map(m => `<option value="${m.display}" data-code="${m.id}">`).join('');
    } catch (_) {}
  };

  ufEl?.addEventListener('change', loadMunOptions);
  ufEl?.addEventListener('blur', loadMunOptions);

  displayEl?.addEventListener('change', () => {
    const opt = Array.from(datalistEl?.querySelectorAll('option') || []).find(o => o.value === displayEl.value);
    if (opt) hiddenEl.value = opt.dataset.code || '';
  });
  displayEl?.addEventListener('input', () => {
    const opt = Array.from(datalistEl?.querySelectorAll('option') || []).find(o => o.value === displayEl.value);
    hiddenEl.value = opt ? (opt.dataset.code || '') : displayEl.value.replace(/\D/g, '').slice(0, 7);
  });

  document.getElementById('btn-param-consultar')?.addEventListener('click', () => {
    const cod = hiddenEl?.value || displayEl?.value?.replace(/\D/g, '').slice(0, 7);
    const codServ = document.getElementById('param-codServ')?.value;
    toast.info(`GET /parametros_municipais/${cod || '{codMun}'}/${codServ || '{codServico}'}`);
  });
}
