/**
 * NFS-e Freire — Parâmetros Municipais
 */
import { toast } from '../toast.js';
import { buscarMunicipiosPorUF, formatMunicipioDisplaySync } from '../municipios-ibge.js';
import { getSession } from '../auth.js';
import { getBackendUrl } from '../api-service.js';

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

  document.getElementById('btn-param-consultar')?.addEventListener('click', async () => {
    const cod = hiddenEl?.value || displayEl?.value?.replace(/\D/g, '').slice(0, 7);
    const codServico = document.getElementById('param-codServ')?.value?.trim();

    if (!cod || cod.length !== 7) {
      toast.warning('Selecione um município válido (IBGE 7 dígitos).');
      return;
    }

    const btn = document.getElementById('btn-param-consultar');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Consultando...'; }

    try {
      const session = getSession();
      const res = await fetch(`${getBackendUrl()}/parametros-municipais/${cod}?codServico=${codServico || ''}`, {
        headers: { 'Authorization': `Bearer ${session?.token || ''}` }
      });
      const data = await res.json();

      if (!data.sucesso) throw new Error(data.erro || 'Erro na consulta');

      const cards = document.querySelectorAll('.grid.grid-3 > div');
      if (cards[0]) {
        const convenio = data.results?.convenio;
        const convStatus = convenio?.status === 200 ? 'Ativo' : (convenio?.status ? `HTTP ${convenio.status}` : 'Indisponível');
        cards[0].querySelector('[style*="font-weight"]').textContent = convStatus;
      }
      if (cards[1]) {
        const aliq = data.results?.aliquotas;
        let aliqDisplay = 'Não encontrado';
        if (aliq?.status === 200 && aliq.data) {
          const v = aliq.data;
          const pct = v.pAliq || v.aliquota || v.aliq || (Array.isArray(v) ? v[0]?.pAliq : null);
          aliqDisplay = pct ? `${parseFloat(pct).toFixed(2).replace('.', ',')}%` : JSON.stringify(v).substring(0, 30);
        } else if (aliq?.status) {
          aliqDisplay = `HTTP ${aliq.status}`;
        }
        cards[1].querySelector('[style*="font-weight"]').textContent = aliqDisplay;
      }
      if (cards[2]) {
        const reg = data.results?.regimesEspeciais;
        let regDisplay = 'Não encontrado';
        if (reg?.status === 200 && reg.data) {
          const v = reg.data;
          regDisplay = Array.isArray(v) ? `${v.length} ativos` : (v.qtd || 'Consultado');
        } else if (reg?.status) {
          regDisplay = `HTTP ${reg.status}`;
        }
        cards[2].querySelector('[style*="font-weight"]').textContent = regDisplay;
      }

      toast.success(`Parâmetros consultados para o município ${cod}!`);
    } catch (err) {
      toast.error(`Falha: ${err.message}`);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🔍 Consultar Parâmetros'; }
    }
  });
}
