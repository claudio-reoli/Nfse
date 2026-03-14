/**
 * NFS-e Freire — IA Fiscal: Configurações de IA
 * Parametrização de gatilhos, alertas e thresholds dos modelos
 */
import { getBackendUrl } from '../api-service.js';
import { toast          } from '../toast.js';

function getMunToken() {
  try { const s = localStorage.getItem('nfse_session'); return s ? (JSON.parse(s).token || '') : ''; } catch { return ''; }
}

function authH() {
  const t = getMunToken();
  return t ? { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export function renderIaConfig(container) {
  const BASE = getBackendUrl();

  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">🤖 Configurações de Inteligência Artificial</h1>
        <p class="page-description">Parametrize gatilhos de alerta, limites dos modelos e horizonte de previsão</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button id="ia-cfg-refresh" class="btn btn-ghost">🔄 Recarregar</button>
        <button id="ia-cfg-salvar" class="btn btn-primary">💾 Salvar Configurações</button>
      </div>
    </div>

    <!-- Status do serviço -->
    <div id="ia-status-card" class="card animate-slide-up" style="padding:14px 18px;margin-bottom:20px;border-left:3px solid var(--color-neutral-600);">
      <div style="display:flex;align-items:center;gap:10px;">
        <div id="ia-status-dot" style="width:10px;height:10px;border-radius:50%;background:var(--color-neutral-500);flex-shrink:0;"></div>
        <div>
          <div id="ia-status-text" style="font-size:0.85rem;font-weight:600;">Verificando serviço de IA...</div>
          <div id="ia-status-sub" style="font-size:0.75rem;color:var(--color-neutral-500);"></div>
        </div>
      </div>
    </div>

    <!-- Grid principal: colapsa para 1 coluna em telas menores -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:20px;align-items:start;">

      <!-- Coluna 1: Gatilhos de Alerta -->
      <div class="card animate-slide-up" style="padding:20px;">
        <h3 class="card-title" style="margin-bottom:18px;">📢 Gatilhos de Alerta</h3>

        <div class="form-group">
          <label class="form-label">Queda no Hiato Tributário (%)</label>
          <span class="form-help" style="display:block;margin-top:-8px;margin-bottom:8px;">Alerta quando receita real fica X% abaixo da projeção</span>
          <input type="number" id="ia-cfg-hiato" class="form-input" min="1" max="50" step="0.5" placeholder="10">
          <span class="form-help">Recomendado: 10% · Padrão KPI: Tax Gap</span>
        </div>

        <div class="form-group">
          <label class="form-label">Score de Propensão ao Atraso — SPA (pts)</label>
          <span class="form-help" style="display:block;margin-top:-8px;margin-bottom:8px;">Acima deste valor → notificação de mala direta</span>
          <input type="number" id="ia-cfg-score" class="form-input" min="0" max="100" step="1" placeholder="80">
          <span class="form-help">Escala 0–100 · Alto risco: ≥ 70 · Recomendado gatilho: 80</span>
        </div>

        <div class="form-group">
          <label class="form-label">Taxa de Substituição Anômala (%)</label>
          <span class="form-help" style="display:block;margin-top:-8px;margin-bottom:8px;">Empresas com mais de X% de substituições → alerta</span>
          <input type="number" id="ia-cfg-sub" class="form-input" min="0" max="100" step="0.5" placeholder="15">
          <span class="form-help">Nota Técnica 005 · Recomendado: 15% · Evento 101103</span>
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <label class="form-label" style="margin-bottom:0;">Alertas Ativos</label>
            <label style="position:relative;display:inline-block;width:42px;height:22px;cursor:pointer;flex-shrink:0;">
              <input type="checkbox" id="ia-cfg-alertas" style="opacity:0;width:0;height:0;">
              <span id="ia-toggle-track" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:var(--surface-glass);border-radius:22px;transition:.2s;border:1px solid var(--surface-glass-border);">
                <span id="ia-toggle-thumb" style="position:absolute;height:16px;width:16px;left:3px;bottom:2px;background:#94a3b8;border-radius:50%;transition:.2s;"></span>
              </span>
            </label>
          </div>
          <span class="form-help" style="margin-top:6px;display:block;">Desative para suprimir todos os alertas visuais do painel</span>
        </div>
      </div>

      <!-- Coluna 2: Parâmetros + Resumo -->
      <div style="display:flex;flex-direction:column;gap:20px;">

        <div class="card animate-slide-up" style="padding:20px;">
          <h3 class="card-title" style="margin-bottom:18px;">🧪 Parâmetros dos Modelos</h3>

          <div class="form-group">
            <label class="form-label">Horizonte de Previsão</label>
            <span class="form-help" style="display:block;margin-top:-8px;margin-bottom:8px;">30, 60 ou 90 dias (1, 2 ou 3 meses)</span>
            <select id="ia-cfg-horizonte" class="form-input">
              <option value="1">1 mês (30 dias)</option>
              <option value="2">2 meses (60 dias)</option>
              <option value="3" selected>3 meses (90 dias)</option>
            </select>
            <span class="form-help">Modelos de horizonte longo têm menor precisão (menor R²)</span>
          </div>

          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Contaminação — Isolation Forest</label>
            <span class="form-help" style="display:block;margin-top:-8px;margin-bottom:10px;">Proporção esperada de anomalias na base (0.05 – 0.30)</span>
            <div style="display:flex;align-items:center;gap:12px;">
              <input type="range" id="ia-cfg-contamination" min="0.05" max="0.30" step="0.01" value="0.10"
                style="flex:1;accent-color:var(--color-primary-500);">
              <span id="ia-cfg-contamination-val" style="font-weight:700;min-width:38px;text-align:right;">10%</span>
            </div>
            <span class="form-help" style="margin-top:6px;display:block;">Padrão: 10% · Aumente se sua base tiver mais irregularidades</span>
          </div>
        </div>

        <!-- Resumo de Monitoramento -->
        <div class="card animate-slide-up" style="padding:20px;">
          <h3 class="card-title" style="margin-bottom:14px;">📋 Resumo de Monitoramento</h3>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>KPI</th>
                  <th>Gatilho Atual</th>
                  <th>Ação Sugerida</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Hiato Tributário</td>
                  <td id="tbl-hiato">—</td>
                  <td style="font-size:0.78rem;color:var(--color-neutral-400);">Notificar fiscalização de campo</td>
                </tr>
                <tr>
                  <td>Score SPA</td>
                  <td id="tbl-score">—</td>
                  <td style="font-size:0.78rem;color:var(--color-neutral-400);">Enviar aviso via mala direta</td>
                </tr>
                <tr>
                  <td>Substituição</td>
                  <td id="tbl-sub">—</td>
                  <td style="font-size:0.78rem;color:var(--color-neutral-400);">Bloquear data retroativa</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  `;

  // Toggle visual do switch
  const chk = document.getElementById('ia-cfg-alertas');
  const track = document.getElementById('ia-toggle-track');
  const thumb = document.getElementById('ia-toggle-thumb');
  function updateToggle() {
    if (!chk || !track || !thumb) return;
    const on = chk.checked;
    track.style.background = on ? 'rgba(99,102,241,0.5)' : 'var(--surface-glass)';
    thumb.style.background = on ? 'var(--color-primary-400)' : '#94a3b8';
    thumb.style.left       = on ? '21px' : '3px';
  }
  chk?.addEventListener('change', updateToggle);

  // Slider de contaminação
  const slider = document.getElementById('ia-cfg-contamination');
  const slVal  = document.getElementById('ia-cfg-contamination-val');
  slider?.addEventListener('input', () => {
    if (slVal) slVal.textContent = `${Math.round(parseFloat(slider.value) * 100)}%`;
  });

  async function verificarStatus() {
    const card  = document.getElementById('ia-status-card');
    const dot   = document.getElementById('ia-status-dot');
    const text  = document.getElementById('ia-status-text');
    const sub   = document.getElementById('ia-status-sub');
    try {
      const res  = await fetch(`${BASE}/ia/status`, { headers: authH() });
      const data = await res.json();
      if (data.status === 'ok') {
        dot.style.background  = 'rgba(34,197,94,0.9)';
        text.textContent      = '✅ Serviço de IA Ativo';
        sub.textContent       = `DB: ${data.db ? 'conectado' : 'desconectado'} · v${data.version} · ${new Date(data.ts).toLocaleTimeString('pt-BR')}`;
        card.style.borderLeftColor = 'rgba(34,197,94,0.8)';
      } else throw new Error();
    } catch {
      dot.style.background  = 'rgba(239,68,68,0.9)';
      text.textContent      = '❌ Serviço de IA Indisponível';
      sub.textContent       = 'Execute src/ia/start.bat ou python src/ia/main.py para iniciar o microserviço Python.';
      card.style.borderLeftColor = 'rgba(239,68,68,0.8)';
    }
  }

  async function carregarConfig() {
    try {
      const res  = await fetch(`${BASE}/ia/config`, { headers: authH() });
      if (!res.ok) return;
      const cfg = await res.json();

      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      set('ia-cfg-hiato',         cfg.gatilho_hiato_pct);
      set('ia-cfg-score',         cfg.gatilho_score_atraso);
      set('ia-cfg-sub',           cfg.gatilho_substituicao_pct);
      set('ia-cfg-horizonte',     cfg.horizonte_previsao);
      set('ia-cfg-contamination', cfg.anomaly_contamination);

      if (slVal) slVal.textContent = `${Math.round((cfg.anomaly_contamination||0.1)*100)}%`;

      if (chk) { chk.checked = cfg.alertas_ativos; updateToggle(); }

      // Atualiza tabela de resumo
      document.getElementById('tbl-hiato').textContent = `Queda > ${cfg.gatilho_hiato_pct}%`;
      document.getElementById('tbl-score').textContent = `Score > ${cfg.gatilho_score_atraso} pts`;
      document.getElementById('tbl-sub').textContent   = `Taxa > ${cfg.gatilho_substituicao_pct}%`;
    } catch { /* ignora se IA indisponível */ }
  }

  async function salvar() {
    const btn = document.getElementById('ia-cfg-salvar');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Salvando...'; }

    const payload = {
      gatilho_hiato_pct:       parseFloat(document.getElementById('ia-cfg-hiato')?.value       || 10),
      gatilho_score_atraso:    parseFloat(document.getElementById('ia-cfg-score')?.value       || 80),
      gatilho_substituicao_pct:parseFloat(document.getElementById('ia-cfg-sub')?.value         || 15),
      horizonte_previsao:      parseInt(document.getElementById('ia-cfg-horizonte')?.value    || 3),
      anomaly_contamination:   parseFloat(document.getElementById('ia-cfg-contamination')?.value || 0.10),
      alertas_ativos:          document.getElementById('ia-cfg-alertas')?.checked ?? true,
    };

    try {
      const res  = await fetch(`${BASE}/ia/config`, {
        method:  'PUT',
        headers: authH(),
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.sucesso) {
        toast.success('Configurações de IA salvas com sucesso.');
        document.getElementById('tbl-hiato').textContent = `Queda > ${payload.gatilho_hiato_pct}%`;
        document.getElementById('tbl-score').textContent = `Score > ${payload.gatilho_score_atraso} pts`;
        document.getElementById('tbl-sub').textContent   = `Taxa > ${payload.gatilho_substituicao_pct}%`;
      } else {
        toast.error('Falha ao salvar configurações.');
      }
    } catch { toast.error('Serviço de IA indisponível.'); }

    if (btn) { btn.disabled = false; btn.textContent = '💾 Salvar Configurações'; }
  }

  document.getElementById('ia-cfg-salvar')?.addEventListener('click', salvar);
  document.getElementById('ia-cfg-refresh')?.addEventListener('click', () => { verificarStatus(); carregarConfig(); });

  verificarStatus();
  carregarConfig();
}
