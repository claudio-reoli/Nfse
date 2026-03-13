/**
 * NFS-e Freire — Eventos Page
 * Cancelamento, Substituição, Manifestação, Análise Fiscal
 * Ref: requisitos-nfse-rtc-v2.md seção 7
 */
import { ENUMS } from '../fiscal-utils.js';
import { toast } from '../toast.js';
import { safeFetch, registrarEvento } from '../api-service.js';

export function renderEventos(container) {
  container.innerHTML = `
    <div class="page-header animate-slide-up">
      <div>
        <h1 class="page-title">Eventos da NFS-e</h1>
        <p class="page-description">Cancelamento, Substituição, Manifestação e Análise Fiscal — POST /nfse/{chave}/eventos</p>
      </div>
    </div>

    <!-- Event Types -->
    <div class="grid grid-3 gap-4 stagger mb-6">
      <div class="card animate-slide-up" style="cursor: pointer;" id="evt-cancelamento">
        <div class="card-body" style="text-align: center; padding: var(--space-6);">
          <div style="font-size: 2rem; margin-bottom: var(--space-3);">❌</div>
          <div style="font-weight: 700; color: var(--color-neutral-100); margin-bottom: var(--space-1);">Cancelamento</div>
          <div style="font-size: var(--text-xs); color: var(--color-neutral-500);">e101101 — Cancelar NFS-e emitida</div>
        </div>
      </div>
      <div class="card animate-slide-up" style="cursor: pointer;" id="evt-substituicao">
        <div class="card-body" style="text-align: center; padding: var(--space-6);">
          <div style="font-size: 2rem; margin-bottom: var(--space-3);">🔄</div>
          <div style="font-weight: 700; color: var(--color-neutral-100); margin-bottom: var(--space-1);">Substituição</div>
          <div style="font-size: var(--text-xs); color: var(--color-neutral-500);">e101103 — Gera cancelamento automático + NFS-e substituta</div>
        </div>
      </div>
      <div class="card animate-slide-up" style="cursor: pointer;" id="evt-manifestacao">
        <div class="card-body" style="text-align: center; padding: var(--space-6);">
          <div style="font-size: 2rem; margin-bottom: var(--space-3);">✅</div>
          <div style="font-weight: 700; color: var(--color-neutral-100); margin-bottom: var(--space-1);">Manifestação</div>
          <div style="font-size: var(--text-xs); color: var(--color-neutral-500);">Confirmação ou Rejeição</div>
        </div>
      </div>
    </div>

    <div class="grid grid-3 gap-4 stagger mb-6">
      <div class="card animate-slide-up" style="cursor: pointer;" id="evt-analise-fiscal">
        <div class="card-body" style="text-align: center; padding: var(--space-6);">
          <div style="font-size: 2rem; margin-bottom: var(--space-3);">🔍</div>
          <div style="font-weight: 700; color: var(--color-neutral-100); margin-bottom: var(--space-1);">Análise Fiscal</div>
          <div style="font-size: var(--text-xs); color: var(--color-neutral-500);">e105101 — Solicitar análise p/ cancelamento</div>
        </div>
      </div>
      <div class="card animate-slide-up" style="cursor: pointer;" id="evt-bloqueio">
        <div class="card-body" style="text-align: center; padding: var(--space-6);">
          <div style="font-size: 2rem; margin-bottom: var(--space-3);">🔒</div>
          <div style="font-weight: 700; color: var(--color-neutral-100); margin-bottom: var(--space-1);">Bloqueio / Desbloqueio</div>
          <div style="font-size: var(--text-xs); color: var(--color-neutral-500);">e204105/e204106 — Por ofício (municipal)</div>
        </div>
      </div>
      <div class="card animate-slide-up" style="cursor: pointer;" id="evt-oficio">
        <div class="card-body" style="text-align: center; padding: var(--space-6);">
          <div style="font-size: 2rem; margin-bottom: var(--space-3);">📋</div>
          <div style="font-weight: 700; color: var(--color-neutral-100); margin-bottom: var(--space-1);">Cancelamento por Ofício</div>
          <div style="font-size: var(--text-xs); color: var(--color-neutral-500);">e204104 — Cancelamento sem solicitação (municipal)</div>
        </div>
      </div>
    </div>

    <!-- Form Container -->
    <div id="evt-form-container"></div>

    <!-- Recent Events Table -->
    <div class="card animate-slide-up mt-6">
      <div class="card-header">
        <h3 class="card-title">Eventos Recentes</h3>
        <div style="display: flex; gap: var(--space-2);">
          <input class="form-input form-input-mono" id="evt-filtro-chave" type="text" maxlength="50"
                 placeholder="Filtrar por chave de acesso..." style="width: 280px; font-size: var(--text-xs);">
          <select class="form-select" id="evt-filtro-tipo" style="width: 180px; font-size: var(--text-xs);">
            <option value="">Todos os tipos</option>
            ${Object.entries(ENUMS.tpEvento).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="card-body" style="padding: 0; overflow-x: auto;">
        <table class="data-table" style="min-width: 600px;">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Chave NFS-e</th>
              <th>Autor</th>
              <th>Data</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="evt-table-body">
            <tr>
              <td><span class="badge badge-danger">Cancelamento</span></td>
              <td class="cell-mono">3526021234...6789</td>
              <td>Prestador</td>
              <td>09/03/2026</td>
              <td><span class="badge badge-success">Registrado</span></td>
            </tr>
            <tr>
              <td><span class="badge badge-primary">Confirmação</span></td>
              <td class="cell-mono">3526029876...4321</td>
              <td>Tomador</td>
              <td>08/03/2026</td>
              <td><span class="badge badge-success">Confirmada</span></td>
            </tr>
            <tr>
              <td><span class="badge badge-warning">Substituição</span></td>
              <td class="cell-mono">3526021122...9012</td>
              <td>Sistema</td>
              <td>07/03/2026</td>
              <td><span class="badge badge-success">Processada</span></td>
            </tr>
            <tr>
              <td><span class="badge" style="background: var(--surface-glass); color: var(--color-primary-300);">Rejeição</span></td>
              <td class="cell-mono">3526025566...1234</td>
              <td>Tomador</td>
              <td>06/03/2026</td>
              <td><span class="badge badge-danger">Rejeitada</span></td>
            </tr>
            <tr>
              <td><span class="badge badge-primary">Análise Fiscal</span></td>
              <td class="cell-mono">3526023344...5678</td>
              <td>Contribuinte</td>
              <td>05/03/2026</td>
              <td><span class="badge badge-warning">Pendente</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const formContainer = document.getElementById('evt-form-container');

  // ─── Cancelamento ──────────────────────
  document.getElementById('evt-cancelamento')?.addEventListener('click', () => {
    renderCancelForm(formContainer);
  });

  // ─── Substituição ──────────────────────
  document.getElementById('evt-substituicao')?.addEventListener('click', () => {
    renderSubstForm(formContainer);
  });

  // ─── Manifestação ──────────────────────
  document.getElementById('evt-manifestacao')?.addEventListener('click', () => {
    renderManifestForm(formContainer);
  });

  // ─── Análise Fiscal ────────────────────
  document.getElementById('evt-analise-fiscal')?.addEventListener('click', () => {
    renderAnaliseFiscalForm(formContainer);
  });

  // ─── Bloqueio/Desbloqueio ──────────────
  document.getElementById('evt-bloqueio')?.addEventListener('click', () => {
    renderBloqueioForm(formContainer);
  });

  // ─── Cancelamento por Ofício ───────────
  document.getElementById('evt-oficio')?.addEventListener('click', () => {
    renderOficioForm(formContainer);
  });
}

// ═══════════════════════════════════════════════════
// FORM RENDERERS
// ═══════════════════════════════════════════════════

function renderCancelForm(container) {
  container.innerHTML = `
    <div class="card animate-slide-up mb-6">
      <div class="card-header">
        <h3 class="card-title">
          <span class="section-title" style="margin:0; padding:0; border:0; font-size: inherit;">
            <span class="icon">❌</span>Cancelamento de NFS-e
          </span>
        </h3>
        <button class="btn btn-ghost btn-sm" onclick="this.closest('.card').remove()">✕</button>
      </div>
      <div class="card-body">
        <div class="form-row mb-4">
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label">Chave de Acesso da NFS-e <span class="required">*</span></label>
            <input class="form-input form-input-mono" id="cancel-chave" type="text" maxlength="50"
                   placeholder="50 dígitos da chave de acesso">
          </div>
        </div>
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Justificativa <span class="required">*</span></label>
            <select class="form-select" id="cancel-justificativa">
              ${Object.entries(ENUMS.codJustCanc).map(([k, v]) => `<option value="${k}">${k} — ${v}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Descrição do Motivo <span class="required">*</span></label>
            <input class="form-input" id="cancel-motivo" type="text" minlength="15" maxlength="255"
                   placeholder="Mínimo 15 caracteres">
          </div>
        </div>
      </div>
      <div class="card-footer">
        <button class="btn btn-secondary" onclick="this.closest('.card').remove()">Cancelar</button>
        <button class="btn btn-danger" id="cancel-btn-submit">🔒 Assinar e Registrar Cancelamento</button>
      </div>
    </div>
  `;

  document.getElementById('cancel-btn-submit')?.addEventListener('click', async () => {
    const chave = document.getElementById('cancel-chave')?.value.trim();
    const justificativa = document.getElementById('cancel-justificativa')?.value;
    const motivo = document.getElementById('cancel-motivo')?.value.trim();

    if (!chave || chave.length !== 50) return toast.error('Chave de Acesso inválida (50 dígitos).');
    if (!motivo || motivo.length < 15) return toast.error('Motivo deve ter pelo menos 15 caracteres.');

    toast.info('Enviando evento de cancelamento...');
    try {
      const resp = await safeFetch(registrarEvento, chave, { tpEvento: 'e101101', cJustCanc: justificativa, xMotivo: motivo });
      if (resp.ok) {
        toast.success(`✅ Cancelamento registrado! Seq: ${resp.data.nSeqEvento} — cStat: ${resp.data.cStat}`);
        container.innerHTML = '';
      } else {
        toast.error(`Erro: ${resp.data?.xMotivo || 'Desconhecido'}`);
      }
    } catch (err) { toast.error(`Falha: ${err.message}`); }
  });
}

function renderSubstForm(container) {
  container.innerHTML = `
    <div class="card animate-slide-up mb-6">
      <div class="card-header">
        <h3 class="card-title"><span class="section-title" style="margin:0; padding:0; border:0; font-size: inherit;">
          <span class="icon">🔄</span>Substituição de NFS-e
        </span></h3>
        <button class="btn btn-ghost btn-sm" onclick="this.closest('.card').remove()">✕</button>
      </div>
      <div class="card-body">
        <div style="padding: var(--space-3); background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.15); border-radius: var(--radius-md); margin-bottom: var(--space-4); font-size: var(--text-sm); color: var(--color-warning-400);">
          ⚠️ A substituição gera automaticamente um Evento de Cancelamento por Substituição (e101103) na NFS-e original e uma nova NFS-e substituta via <code>POST /nfse</code>.
        </div>
        <div class="form-row mb-4">
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label">Chave de Acesso da NFS-e Original <span class="required">*</span></label>
            <input class="form-input form-input-mono" id="subst-chave-orig" type="text" maxlength="50"
                   placeholder="50 dígitos — NFS-e a ser substituída">
          </div>
        </div>
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Justificativa <span class="required">*</span></label>
            <select class="form-select" id="subst-justificativa">
              ${Object.entries(ENUMS.codJustSubst).map(([k, v]) => `<option value="${k}">${k} — ${v}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Descrição do Motivo <span class="required">*</span></label>
            <input class="form-input" id="subst-motivo" type="text" maxlength="255"
                   placeholder="Descreva o motivo da substituição (mín. 15 caracteres)">
          </div>
        </div>
      </div>
      <div class="card-footer">
        <button class="btn btn-secondary" onclick="this.closest('.card').remove()">Cancelar</button>
        <button class="btn btn-warning" id="subst-btn-submit">🔄 Iniciar Substituição</button>
      </div>
    </div>
  `;

  document.getElementById('subst-btn-submit')?.addEventListener('click', async () => {
    const chaveOrig = document.getElementById('subst-chave-orig')?.value.trim();
    const justificativa = document.getElementById('subst-justificativa')?.value;
    const motivo = document.getElementById('subst-motivo')?.value.trim();

    if (!chaveOrig || chaveOrig.length !== 50) return toast.error('Chave da NFS-e original inválida (50 dígitos).');
    if (!motivo || motivo.length < 15) return toast.error('Motivo deve ter pelo menos 15 caracteres.');

    toast.info('Para concluir a substituição, emita uma nova DPS com o campo "chSubstda" preenchido com a chave da NFS-e original.');
    toast.success(`Chave da NFS-e original copiada! Acesse "Emissão de DPS" para criar a DPS substituta.`);

    // Store for use in DPS form
    sessionStorage.setItem('nfse_subst_chave', chaveOrig);
    sessionStorage.setItem('nfse_subst_motivo', justificativa);
    sessionStorage.setItem('nfse_subst_xMotivo', motivo);
  });
}

function renderManifestForm(container) {
  container.innerHTML = `
    <div class="card animate-slide-up mb-6">
      <div class="card-header">
        <h3 class="card-title"><span class="section-title" style="margin:0; padding:0; border:0; font-size: inherit;">
          <span class="icon">✅</span>Manifestação sobre NFS-e
        </span></h3>
        <button class="btn btn-ghost btn-sm" onclick="this.closest('.card').remove()">✕</button>
      </div>
      <div class="card-body">
        <div class="form-row mb-4">
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label">Chave de Acesso da NFS-e <span class="required">*</span></label>
            <input class="form-input form-input-mono" id="manif-chave" type="text" maxlength="50"
                   placeholder="50 dígitos da chave de acesso">
          </div>
        </div>
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Tipo de Manifestação <span class="required">*</span></label>
            <select class="form-select" id="manif-tipo">
              <optgroup label="Confirmação">
                <option value="e105102">Confirmação — Prestador</option>
                <option value="e105103">Confirmação — Tomador</option>
                <option value="e105104">Confirmação — Intermediário</option>
              </optgroup>
              <optgroup label="Rejeição">
                <option value="e105106">Rejeição — Prestador</option>
                <option value="e105107">Rejeição — Tomador</option>
                <option value="e105108">Rejeição — Intermediário</option>
              </optgroup>
            </select>
          </div>
          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Descrição / Motivo</label>
            <input class="form-input" id="manif-motivo" type="text" maxlength="255"
                   placeholder="Opcional — Descreva o motivo (obrigatório para rejeição)">
          </div>
        </div>
      </div>
      <div class="card-footer">
        <button class="btn btn-secondary" onclick="this.closest('.card').remove()">Cancelar</button>
        <button class="btn btn-primary" id="manif-btn-submit">🔒 Registrar Manifestação</button>
      </div>
    </div>
  `;

  document.getElementById('manif-btn-submit')?.addEventListener('click', async () => {
    const chave = document.getElementById('manif-chave')?.value.trim();
    const tipo = document.getElementById('manif-tipo')?.value;
    const motivo = document.getElementById('manif-motivo')?.value.trim();

    if (!chave || chave.length !== 50) return toast.error('Chave de Acesso inválida (50 dígitos).');

    const isRejeicao = tipo.includes('106') || tipo.includes('107') || tipo.includes('108');
    if (isRejeicao && (!motivo || motivo.length < 15)) {
      return toast.error('Motivo é obrigatório para rejeição (mín. 15 caracteres).');
    }

    toast.info('Registrando manifestação...');
    try {
      const resp = await safeFetch(registrarEvento, chave, { tpEvento: tipo, xMotivo: motivo || 'Confirmação da operação' });
      if (resp.ok) {
        const tipoNome = ENUMS.tpEvento[tipo] || tipo;
        toast.success(`✅ ${tipoNome} registrada! Seq: ${resp.data.nSeqEvento}`);
        container.innerHTML = '';
      }
    } catch (err) { toast.error(`Falha: ${err.message}`); }
  });
}

function renderAnaliseFiscalForm(container) {
  container.innerHTML = `
    <div class="card animate-slide-up mb-6">
      <div class="card-header">
        <h3 class="card-title"><span class="section-title" style="margin:0; padding:0; border:0; font-size: inherit;">
          <span class="icon">🔍</span>Solicitação de Análise Fiscal para Cancelamento
        </span></h3>
        <button class="btn btn-ghost btn-sm" onclick="this.closest('.card').remove()">✕</button>
      </div>
      <div class="card-body">
        <div style="padding: var(--space-3); background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.15); border-radius: var(--radius-md); margin-bottom: var(--space-4); font-size: var(--text-sm); color: var(--color-primary-400);">
          ℹ️ A Solicitação de Análise Fiscal (e105101) solicita ao município emissor que realize análise para eventual cancelamento. O resultado será um deferimento (e204101) ou indeferimento (e204102).
        </div>
        <div class="form-row mb-4">
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label">Chave de Acesso da NFS-e <span class="required">*</span></label>
            <input class="form-input form-input-mono" id="analise-chave" type="text" maxlength="50"
                   placeholder="50 dígitos da chave de acesso">
          </div>
        </div>
        <div class="form-row mb-4">
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label">Justificativa Detalhada <span class="required">*</span></label>
            <textarea class="form-input" id="analise-motivo" rows="3" maxlength="500"
                      placeholder="Descreva detalhadamente o motivo da solicitação (mín. 15 caracteres)"></textarea>
          </div>
        </div>
      </div>
      <div class="card-footer">
        <button class="btn btn-secondary" onclick="this.closest('.card').remove()">Cancelar</button>
        <button class="btn btn-primary" id="analise-btn-submit">📨 Enviar Solicitação</button>
      </div>
    </div>
  `;

  document.getElementById('analise-btn-submit')?.addEventListener('click', async () => {
    const chave = document.getElementById('analise-chave')?.value.trim();
    const motivo = document.getElementById('analise-motivo')?.value.trim();

    if (!chave || chave.length !== 50) return toast.error('Chave inválida.');
    if (!motivo || motivo.length < 15) return toast.error('Justificativa obrigatória (mín. 15 caracteres).');

    toast.info('Enviando solicitação de análise fiscal...');
    try {
      const resp = await safeFetch(registrarEvento, chave, { tpEvento: 'e105101', xMotivo: motivo });
      if (resp.ok) {
        toast.success(`✅ Solicitação enviada! Aguarde análise do município. Seq: ${resp.data.nSeqEvento}`);
        container.innerHTML = '';
      }
    } catch (err) { toast.error(`Falha: ${err.message}`); }
  });
}

function renderBloqueioForm(container) {
  container.innerHTML = `
    <div class="card animate-slide-up mb-6">
      <div class="card-header">
        <h3 class="card-title"><span class="section-title" style="margin:0; padding:0; border:0; font-size: inherit;">
          <span class="icon">🔒</span>Bloqueio / Desbloqueio por Ofício (Municipal)
        </span></h3>
        <button class="btn btn-ghost btn-sm" onclick="this.closest('.card').remove()">✕</button>
      </div>
      <div class="card-body">
        <div style="padding: var(--space-3); background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.15); border-radius: var(--radius-md); margin-bottom: var(--space-4); font-size: var(--text-sm); color: var(--color-warning-400);">
          ⚠️ Eventos exclusivos do Município emissor. Podem bloquear até 5 tipos de eventos simultaneamente.
        </div>
        <div class="form-row mb-4">
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label">Chave de Acesso da NFS-e <span class="required">*</span></label>
            <input class="form-input form-input-mono" id="bloq-chave" type="text" maxlength="50" placeholder="50 dígitos">
          </div>
        </div>
        <div class="form-row mb-4">
          <div class="form-group">
            <label class="form-label">Ação <span class="required">*</span></label>
            <select class="form-select" id="bloq-acao">
              <option value="e204105">🔒 Bloqueio por Ofício</option>
              <option value="e204106">🔓 Desbloqueio por Ofício</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Evento a Bloquear/Desbloquear</label>
            <select class="form-select" id="bloq-evento-alvo">
              <option value="e101101">Cancelamento de NFS-e</option>
              <option value="e101103">Cancelamento por Substituição</option>
              <option value="e204101">Cancelamento Deferido por Análise</option>
              <option value="e204102">Cancelamento Indeferido por Análise</option>
              <option value="e204104">Cancelamento por Ofício</option>
            </select>
          </div>
        </div>
        <div class="form-row mb-4">
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label">Motivo <span class="required">*</span></label>
            <input class="form-input" id="bloq-motivo" type="text" maxlength="255" placeholder="Mín. 15 caracteres">
          </div>
        </div>
      </div>
      <div class="card-footer">
        <button class="btn btn-secondary" onclick="this.closest('.card').remove()">Cancelar</button>
        <button class="btn btn-warning" id="bloq-btn-submit">🔒 Registrar</button>
      </div>
    </div>
  `;

  document.getElementById('bloq-btn-submit')?.addEventListener('click', async () => {
    const chave = document.getElementById('bloq-chave')?.value.trim();
    const acao = document.getElementById('bloq-acao')?.value;
    const eventoAlvo = document.getElementById('bloq-evento-alvo')?.value;
    const motivo = document.getElementById('bloq-motivo')?.value.trim();

    if (!chave || chave.length !== 50) return toast.error('Chave inválida.');
    if (!motivo || motivo.length < 15) return toast.error('Motivo obrigatório (mín. 15 chars).');

    try {
      const resp = await safeFetch(registrarEvento, chave, { tpEvento: acao, eventoAlvo, xMotivo: motivo });
      if (resp.ok) {
        toast.success(`✅ ${acao === 'e204105' ? 'Bloqueio' : 'Desbloqueio'} registrado! Seq: ${resp.data.nSeqEvento}`);
        container.innerHTML = '';
      }
    } catch (err) { toast.error(`Falha: ${err.message}`); }
  });
}

function renderOficioForm(container) {
  container.innerHTML = `
    <div class="card animate-slide-up mb-6">
      <div class="card-header">
        <h3 class="card-title"><span class="section-title" style="margin:0; padding:0; border:0; font-size: inherit;">
          <span class="icon">📋</span>Cancelamento por Ofício
        </span></h3>
        <button class="btn btn-ghost btn-sm" onclick="this.closest('.card').remove()">✕</button>
      </div>
      <div class="card-body">
        <div style="padding: var(--space-3); background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: var(--radius-md); margin-bottom: var(--space-4); font-size: var(--text-sm); color: var(--color-danger-400);">
          🚨 Evento exclusivo do Município emissor. Cancela a NFS-e sem solicitação do contribuinte. Pode ser realizado mesmo com manifestação de confirmação existente.
        </div>
        <div class="form-row mb-4">
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label">Chave de Acesso da NFS-e <span class="required">*</span></label>
            <input class="form-input form-input-mono" id="oficio-chave" type="text" maxlength="50" placeholder="50 dígitos">
          </div>
        </div>
        <div class="form-row mb-4">
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label">Justificativa do Cancelamento por Ofício <span class="required">*</span></label>
            <textarea class="form-input" id="oficio-motivo" rows="3" maxlength="500"
                      placeholder="Fundamento legal e justificativa detalhada"></textarea>
          </div>
        </div>
      </div>
      <div class="card-footer">
        <button class="btn btn-secondary" onclick="this.closest('.card').remove()">Cancelar</button>
        <button class="btn btn-danger" id="oficio-btn-submit">🔒 Registrar Cancelamento por Ofício</button>
      </div>
    </div>
  `;

  document.getElementById('oficio-btn-submit')?.addEventListener('click', async () => {
    const chave = document.getElementById('oficio-chave')?.value.trim();
    const motivo = document.getElementById('oficio-motivo')?.value.trim();

    if (!chave || chave.length !== 50) return toast.error('Chave inválida.');
    if (!motivo || motivo.length < 15) return toast.error('Justificativa obrigatória.');

    try {
      const resp = await safeFetch(registrarEvento, chave, { tpEvento: 'e204104', xMotivo: motivo });
      if (resp.ok) {
        toast.success(`✅ Cancelamento por Ofício registrado! Seq: ${resp.data.nSeqEvento}`);
        container.innerHTML = '';
      }
    } catch (err) { toast.error(`Falha: ${err.message}`); }
  });
}
